// Lot 73a (PRE-02, BUD-01, UX-07 ; spécification du lot 73, § 4.2 ; décisions P12 et P5 de Julien du
// 27/11/2026) — « Ajouter à un mariage… » et « Créer et ajouter », côté service ; « Annuler » pendant dix
// secondes ; les évènements proposés ; les mariages à venir où une fiche est retenue (état de ses pièces) ;
// « Annuler » une relance notée. Accès aux données du module Évènements, exposé par service.ts seul
// (ADR 0011).
// - Tout l'ajout tient dans une transaction : le poste créé (« Nouveau poste »), les prestataires ajoutés,
//   leur rétention et la publication de events.vendor_slot.booked (outbox), que le module Budget consomme
//   pour engager la ligne. Aucun événement nouveau (§ 4.4).
// - « Retenu » suit la règle de « Retenir » (selectCandidate) : les concurrents encore en lice sont écartés,
//   un prestataire déjà retenu le reste. Sur un poste pourvu, l'appelant choisit (P12) : « replace » fait
//   repasser l'ancien retenu en comparaison (son engagé est libéré, events.vendor_retention.released),
//   « retain_also » garde les deux.
// - Un évènement annulé, clôturé, archivé, supprimé, d'une autre organisation ou hors de la vue de la
//   personne (lot 52) répond comme un évènement inexistant (SEC-13).
import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventActivities, eventTeamMembers, eventVendorCandidateNotes, eventVendorCandidates, events, eventVendorSlots, taskChangeSnapshots, vendorReminders, type VendorAdditionSnapshotPayload } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { emitDomainEvent } from "@symbola/db/events/emit";
import {
  ENGAGED_CANDIDATE_STATUSES,
  EVT_VENDOR_RETENTION_RELEASED,
  EVT_VENDOR_RETENTION_RELEASED_VERSION,
  UNDO_SECONDS,
  VENDOR_ADDITION_MODES,
  vendorRetentionReleasedPayloadSchema,
  type AddVendorToEventSlotInput,
  type VendorAdditionEvent,
  type VendorAdditionResult,
  type VendorCandidateStatus,
  type VendorRetainedEvent,
} from "@symbola/contracts";
import { EventNotFoundError } from "./errors";
import { seesAllEvents } from "./team";
import { publishRetention } from "./vendor-candidates";
import { backInTheRunning, releaseRetained } from "./vendor-coordination";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type CandidateRow = typeof eventVendorCandidates.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOSED: ("cancelled" | "closed")[] = ["cancelled", "closed"];
const ENGAGED: VendorCandidateStatus[] = [...ENGAGED_CANDIDATE_STATUSES];
const IN_THE_RUNNING: VendorCandidateStatus[] = ["shortlisted", "contacted", "quote_received"];
// « Annuler » s'affiche dix secondes ; le serveur garde un peu plus, le temps de l'aller et retour.
export const VENDOR_UNDO_GRACE_SECONDS = UNDO_SECONDS + 20;
const SLOT_LABEL_MAX = 120;

const isEngaged = (status: VendorCandidateStatus) => ENGAGED.includes(status);

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

// L'évènement, s'il reçoit encore des prestataires et si la personne le voit ; sinon « inexistant ».
async function writableEvent(tx: Tx, eventId: string, viewer: AddVendorToEventSlotInput["viewer"]): Promise<void> {
  if (!UUID.test(eventId)) throw new EventNotFoundError();
  const [event] = await tx
    .select({ id: events.id, status: events.status, archivedAt: events.archivedAt })
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)));
  if (!event || CLOSED.includes(event.status as "cancelled" | "closed") || event.archivedAt !== null) throw new EventNotFoundError();
  if (viewer && !seesAllEvents(viewer)) {
    const [member] = await tx.select({ id: eventTeamMembers.id }).from(eventTeamMembers).where(and(eq(eventTeamMembers.eventId, eventId), eq(eventTeamMembers.userId, viewer.userId)));
    if (!member) throw new EventNotFoundError();
  }
}

async function slotOf(tx: Tx, organizationId: string, input: AddVendorToEventSlotInput): Promise<{ id: string; label: string; created: boolean }> {
  if (input.slotId) {
    if (!UUID.test(input.slotId)) throw new EventNotFoundError();
    const [slot] = await tx.select({ id: eventVendorSlots.id, label: eventVendorSlots.label }).from(eventVendorSlots).where(and(eq(eventVendorSlots.id, input.slotId), eq(eventVendorSlots.eventId, input.eventId)));
    if (!slot) throw new EventNotFoundError();
    return { ...slot, created: false };
  }
  const label = (input.newSlotLabel ?? "").trim();
  if (label.length < 1 || label.length > SLOT_LABEL_MAX) throw new RangeError("libellé du poste invalide");
  const [{ next } = { next: 0 }] = await tx.select({ next: sql<number>`coalesce(max(${eventVendorSlots.position}) + 1, 0)::int` }).from(eventVendorSlots).where(eq(eventVendorSlots.eventId, input.eventId));
  const [slot] = await tx.insert(eventVendorSlots).values({ organizationId, eventId: input.eventId, label, position: next }).returning({ id: eventVendorSlots.id, label: eventVendorSlots.label });
  if (!slot) throw new Error("création du poste échouée");
  return { ...slot, created: true };
}

function previousOf(row: CandidateRow): VendorAdditionSnapshotPayload["changed"][number] {
  return { id: row.id, status: row.status, dismissalReason: row.dismissalReason, retainedAt: row.retainedAt?.toISOString() ?? null };
}

function checkVendors(input: AddVendorToEventSlotInput): { vendorId: string; vendorName: string }[] {
  if (!VENDOR_ADDITION_MODES.includes(input.mode)) throw new RangeError("manière d'ajouter inconnue");
  const seen = new Set<string>();
  const vendors = input.vendors.flatMap((vendor) => {
    const name = vendor.vendorName.trim();
    if (!UUID.test(vendor.vendorId) || !name) throw new RangeError("fiche du carnet invalide");
    if (seen.has(vendor.vendorId)) return [];
    seen.add(vendor.vendorId);
    return [{ vendorId: vendor.vendorId, vendorName: name.slice(0, 200) }];
  });
  if (vendors.length === 0) throw new RangeError("aucune fiche à ajouter");
  // Plusieurs fiches vont toutes en comparaison : « Retenu » n'est proposé que pour une seule.
  if (input.mode !== "compare" && vendors.length > 1) throw new RangeError("une seule fiche se retient à la fois");
  return vendors;
}

export async function addVendorToEventSlot(input: AddVendorToEventSlotInput): Promise<VendorAdditionResult> {
  const vendors = checkVendors(input);
  if (!UUID.test(input.userId)) throw new RangeError("auteur invalide");
  const now = input.now ?? new Date();
  return inOrganization(input.organizationId, async (tx) => {
    await writableEvent(tx, input.eventId, input.viewer);
    const slot = await slotOf(tx, input.organizationId, input);
    const candidates = await tx.select().from(eventVendorCandidates).where(eq(eventVendorCandidates.vendorSlotId, slot.id)).orderBy(asc(eventVendorCandidates.position)).for("update");
    const created: string[] = [];
    const changed: VendorAdditionSnapshotPayload["changed"] = [];
    let position = candidates.reduce((max, row) => Math.max(max, row.position + 1), 0);
    const insertCandidate = async (vendor: { vendorId: string; vendorName: string }): Promise<CandidateRow> => {
      const [row] = await tx
        .insert(eventVendorCandidates)
        .values({ organizationId: input.organizationId, eventId: input.eventId, vendorSlotId: slot.id, vendorId: vendor.vendorId, vendorName: vendor.vendorName, position: position++ })
        .returning();
      if (!row) throw new Error("ajout du prestataire échoué");
      created.push(row.id);
      return row;
    };
    const setStatus = async (row: CandidateRow, status: VendorCandidateStatus, dismissalReason: string | null): Promise<CandidateRow> => {
      if (!changed.some((entry) => entry.id === row.id)) changed.push(previousOf(row));
      const [updated] = await tx.update(eventVendorCandidates).set({ status, dismissalReason, updatedAt: now }).where(eq(eventVendorCandidates.id, row.id)).returning();
      return updated!;
    };

    const candidateIds: string[] = [];
    let replaced: { candidateId: string; vendorName: string } | null = null;
    if (input.mode === "compare") {
      for (const vendor of vendors) {
        const existing = candidates.find((row) => row.vendorId === vendor.vendorId);
        // Déjà sur le poste : rien ne change (un prestataire écarté revient en comparaison).
        const row = existing ? (existing.status === "dismissed" ? await setStatus(existing, backInTheRunning(existing), null) : existing) : await insertCandidate(vendor);
        candidateIds.push(row.id);
      }
    } else {
      const vendor = vendors[0]!;
      const existing = candidates.find((row) => row.vendorId === vendor.vendorId);
      const others = candidates.filter((row) => row.id !== existing?.id && isEngaged(row.status));
      // P12 : sur un poste déjà pourvu, « Retenir » demande « Remplacer {nom} » ou « Retenir aussi ».
      if (input.mode === "retain" && others.length > 0 && !(existing && isEngaged(existing.status))) {
        return { status: "choice_required", retained: others.map((row) => ({ candidateId: row.id, vendorName: row.vendorName })) };
      }
      const target = existing ?? (await insertCandidate(vendor));
      candidateIds.push(target.id);
      if (!isEngaged(target.status)) {
        // Règle de « Retenir » : les concurrents encore en lice sont écartés.
        for (const row of candidates.filter((entry) => entry.id !== target.id && IN_THE_RUNNING.includes(entry.status))) await setStatus(row, "dismissed", null);
        const retained = await setStatus(target, "retained", null);
        await publishRetention(tx, input.organizationId, retained, input.userId);
      }
      if (input.mode === "replace") {
        for (const row of others) {
          if (!changed.some((entry) => entry.id === row.id)) changed.push(previousOf(row));
          await releaseRetained(tx, input.organizationId, row, { status: backInTheRunning(row), dismissalReason: null }, input.userId, now);
          replaced ??= { candidateId: row.id, vendorName: row.vendorName };
        }
      }
    }
    const payload: VendorAdditionSnapshotPayload = { kind: "vendor_addition", eventId: input.eventId, slotId: slot.id, slotCreated: slot.created, created, changed };
    const [snapshot] = await tx
      .insert(taskChangeSnapshots)
      .values({ organizationId: input.organizationId, userId: input.userId, payload, expiresAt: new Date(now.getTime() + VENDOR_UNDO_GRACE_SECONDS * 1000), createdAt: now })
      .returning({ id: taskChangeSnapshots.id });
    const [{ comparing } = { comparing: 0 }] = await tx
      .select({ comparing: sql<number>`count(*)::int` })
      .from(eventVendorCandidates)
      .where(and(eq(eventVendorCandidates.vendorSlotId, slot.id), inArray(eventVendorCandidates.status, IN_THE_RUNNING)));
    return { status: "added", eventId: input.eventId, slotId: slot.id, slotLabel: slot.label, slotCreated: slot.created, mode: input.mode, candidateIds, comparingCount: comparing, replaced, undoId: snapshot!.id };
  });
}

async function publishRelease(tx: Tx, organizationId: string, row: CandidateRow, userId: string): Promise<void> {
  const [event] = await tx.select({ isDemo: events.isDemo }).from(events).where(eq(events.id, row.eventId));
  if (!event || event.isDemo) return;
  await emitDomainEvent(tx, {
    organizationId,
    name: EVT_VENDOR_RETENTION_RELEASED,
    version: EVT_VENDOR_RETENTION_RELEASED_VERSION,
    payload: vendorRetentionReleasedPayloadSchema.parse({ eventId: row.eventId, vendorSlotId: row.vendorSlotId, candidateId: row.id, amountCents: row.quoteAmountCents, releasedByUserId: userId }),
  });
}

// « Annuler » dans les dix secondes : l'état d'avant revient, une seule fois, pour la personne qui a fait
// l'ajout, dans son organisation. Un prestataire qui n'est plus retenu libère son engagé (événement
// existant) ; un prestataire de nouveau retenu le réengage. Rend false quand il n'y a plus rien à annuler.
export async function undoVendorAddition(input: { organizationId: string; userId: string; undoId: string; now?: Date }): Promise<boolean> {
  if (!UUID.test(input.undoId) || !UUID.test(input.userId)) return false;
  const now = input.now ?? new Date();
  return inOrganization(input.organizationId, async (tx) => {
    const [snapshot] = await tx
      .delete(taskChangeSnapshots)
      .where(and(eq(taskChangeSnapshots.id, input.undoId), eq(taskChangeSnapshots.userId, input.userId), gt(taskChangeSnapshots.expiresAt, now), sql`${taskChangeSnapshots.payload} ->> 'kind' = 'vendor_addition'`))
      .returning();
    if (!snapshot || snapshot.payload.kind !== "vendor_addition") return false;
    const payload = snapshot.payload;
    const ids = [...payload.created, ...payload.changed.map((entry) => entry.id)];
    const rows = ids.length > 0 ? await tx.select().from(eventVendorCandidates).where(and(inArray(eventVendorCandidates.id, ids), eq(eventVendorCandidates.vendorSlotId, payload.slotId))).for("update") : [];
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of payload.created) {
      const row = byId.get(id);
      if (!row) continue;
      if (isEngaged(row.status)) await publishRelease(tx, input.organizationId, row, input.userId);
      await tx.delete(eventVendorCandidates).where(eq(eventVendorCandidates.id, id));
    }
    // D'abord ceux qui ne sont plus retenus (libération), puis ceux qui le redeviennent (réengagement).
    const order = [...payload.changed].sort((a, b) => Number(isEngaged(a.status)) - Number(isEngaged(b.status)));
    for (const previous of order) {
      const row = byId.get(previous.id);
      if (!row) continue;
      const [restored] = await tx
        .update(eventVendorCandidates)
        .set({ status: previous.status, dismissalReason: previous.dismissalReason as CandidateRow["dismissalReason"], retainedAt: previous.retainedAt ? new Date(previous.retainedAt) : null, updatedAt: now })
        .where(eq(eventVendorCandidates.id, row.id))
        .returning();
      if (!restored) continue;
      if (isEngaged(row.status) && !isEngaged(previous.status)) await publishRelease(tx, input.organizationId, row, input.userId);
      if (!isEngaged(row.status) && isEngaged(previous.status)) await publishRetention(tx, input.organizationId, restored, input.userId);
    }
    if (payload.slotCreated) {
      const [{ left } = { left: 0 }] = await tx.select({ left: sql<number>`count(*)::int` }).from(eventVendorCandidates).where(eq(eventVendorCandidates.vendorSlotId, payload.slotId));
      if (left === 0) await tx.delete(eventVendorSlots).where(eq(eventVendorSlots.id, payload.slotId));
    }
    return true;
  });
}

// « Ajouter à un mariage… » : les évènements à venir (date passée exclue ; sans date, à la fin), demandes
// comprises, ni annulés, ni clôturés, ni archivés ; ceux de l'équipe seulement pour une Planner qui ne voit
// pas tout (lot 52). Avec leurs postes, le nombre en comparaison et les retenus de chacun.
export async function listEventsForVendorAddition(organizationId: string, input: { today: string; viewer?: AddVendorToEventSlotInput["viewer"] }): Promise<VendorAdditionEvent[]> {
  return inOrganization(organizationId, async (tx) => {
    const conditions = [isNull(events.deletedAt), isNull(events.archivedAt), notInArray(events.status, CLOSED), or(isNull(events.eventDate), gte(events.eventDate, input.today))];
    if (input.viewer && !seesAllEvents(input.viewer)) {
      conditions.push(sql`exists (select 1 from ${eventTeamMembers} where ${eventTeamMembers.eventId} = ${events.id} and ${eventTeamMembers.userId} = ${input.viewer.userId})`);
    }
    const rows = await tx
      .select({ id: events.id, eventDate: events.eventDate, status: events.status, isDemo: events.isDemo })
      .from(events)
      .where(and(...conditions))
      .orderBy(sql`${events.eventDate} asc nulls last`, asc(events.createdAt));
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const slots = await tx.select({ id: eventVendorSlots.id, eventId: eventVendorSlots.eventId, label: eventVendorSlots.label }).from(eventVendorSlots).where(inArray(eventVendorSlots.eventId, ids)).orderBy(asc(eventVendorSlots.position), asc(eventVendorSlots.createdAt));
    const candidates = await tx
      .select({ id: eventVendorCandidates.id, slotId: eventVendorCandidates.vendorSlotId, status: eventVendorCandidates.status, vendorName: eventVendorCandidates.vendorName, vendorId: eventVendorCandidates.vendorId })
      .from(eventVendorCandidates)
      .where(and(inArray(eventVendorCandidates.eventId, ids), inArray(eventVendorCandidates.status, [...IN_THE_RUNNING, ...ENGAGED])))
      .orderBy(asc(eventVendorCandidates.position));
    return rows.map((row) => ({
      eventId: row.id,
      eventDate: row.eventDate,
      status: row.status as VendorAdditionEvent["status"],
      isDemo: row.isDemo,
      slots: slots
        .filter((slot) => slot.eventId === row.id)
        .map((slot) => {
          const own = candidates.filter((candidate) => candidate.slotId === slot.id);
          return {
            id: slot.id,
            label: slot.label,
            comparingCount: own.filter((candidate) => IN_THE_RUNNING.includes(candidate.status)).length,
            retained: own.filter((candidate) => isEngaged(candidate.status)).map((candidate) => ({ candidateId: candidate.id, vendorName: candidate.vendorName, vendorId: candidate.vendorId })),
          };
        }),
    }));
  });
}

// L'état des pièces d'une fiche (module Prestataires) : les mariages à venir, hors exemples, annulés et
// clôturés, où chaque fiche est retenue. Aucun nom : la raison dit « avant le mariage de … » seulement si
// l'appelant donne le nom d'un mariage que la personne voit.
export async function listUpcomingRetainedEventsByVendor(organizationId: string, vendorIds: string[], today: string): Promise<Map<string, VendorRetainedEvent[]>> {
  const ids = vendorIds.filter((id) => UUID.test(id));
  const byVendor = new Map<string, VendorRetainedEvent[]>();
  if (ids.length === 0) return byVendor;
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .selectDistinct({ vendorId: eventVendorCandidates.vendorId, eventId: events.id, eventDate: events.eventDate })
      .from(eventVendorCandidates)
      .innerJoin(events, eq(events.id, eventVendorCandidates.eventId))
      .where(
        and(
          inArray(eventVendorCandidates.vendorId, ids),
          inArray(eventVendorCandidates.status, ENGAGED),
          eq(events.isDemo, false),
          isNull(events.deletedAt),
          notInArray(events.status, CLOSED),
          isNotNull(events.eventDate),
          gte(events.eventDate, today),
        ),
      ),
  );
  for (const row of rows) {
    if (!row.vendorId || !row.eventDate) continue;
    const list = byVendor.get(row.vendorId) ?? [];
    list.push({ eventId: row.eventId, eventDate: row.eventDate });
    byVendor.set(row.vendorId, list);
  }
  for (const list of byVendor.values()) list.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  return byVendor;
}

// « Annuler » dix secondes après « Noter la relance » : la relance, sa note et sa ligne d'activité
// disparaissent ; seulement pour la personne qui l'a notée, dans son organisation, peu après.
export async function undoVendorReminder(input: { organizationId: string; userId: string; reminderId: string; now?: Date }): Promise<boolean> {
  if (!UUID.test(input.reminderId) || !UUID.test(input.userId)) return false;
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - VENDOR_UNDO_GRACE_SECONDS * 1000);
  return inOrganization(input.organizationId, async (tx) => {
    const [reminder] = await tx
      .delete(vendorReminders)
      .where(and(eq(vendorReminders.id, input.reminderId), eq(vendorReminders.createdBy, input.userId), gt(vendorReminders.createdAt, since)))
      .returning();
    if (!reminder) return false;
    if (reminder.noteId) await tx.delete(eventVendorCandidateNotes).where(eq(eventVendorCandidateNotes.id, reminder.noteId));
    // La ligne d'activité de la même écriture (même prestataire, même instant).
    await tx
      .delete(eventActivities)
      .where(and(eq(eventActivities.vendorCandidateId, reminder.candidateId), eq(eventActivities.kind, "vendor_reminded"), gte(eventActivities.createdAt, reminder.createdAt), lt(eventActivities.createdAt, new Date(reminder.createdAt.getTime() + 1000))));
    return true;
  });
}
