// Lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15, SEC-17 ; ADR 0053) — accès aux
// données des liens personnels des tiers. Jamais importé hors de
// modules/events/ (ADR 0011) : les autres modules passent par service.ts.
// Chaque lecture et écriture se fait sous RLS, dans l'organisation du lien.
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { appendAudit } from "@symbola/db/audit";
import { withOrganization } from "@symbola/db/with-organization";
import {
  eventActivities,
  eventClients,
  eventLinkCodes,
  eventLinks,
  eventLinkSessions,
  eventLinkSharedSlots,
  events,
  eventTasks,
  eventVendorCandidates,
  eventVendorSlots,
} from "@symbola/db/schema/events";
import type { EventLinkRights, EventStatus, LinkAudience, LinkRubric } from "@symbola/contracts";
import { isLinkCodeUsable, LINK_CODE_MAX_ATTEMPTS, sameLinkCodeHash } from "./link-otp";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

export type EventLinkRow = typeof eventLinks.$inferSelect;
export type EventLinkSessionRow = typeof eventLinkSessions.$inferSelect;
export type EventTaskRow = typeof eventTasks.$inferSelect;

export type LinkEventInfo = { eventDate: string | null; status: EventStatus; isDemo: boolean };

// Un lien, ses catégories partagées et ce qu'il faut savoir de son événement
// pour juger s'il vaut encore.
export type LinkWithContext = { link: EventLinkRow; sharedSlotIds: string[]; event: LinkEventInfo };

export function rightsOf(context: LinkWithContext): EventLinkRights {
  return {
    rubrics: context.link.rubrics as LinkRubric[],
    budgetScope: context.link.budgetScope === "selected" ? "selected" : "all",
    sharedSlotIds: context.sharedSlotIds,
  };
}

async function sharedSlotsByLink(tx: Tx, linkIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (linkIds.length === 0) return result;
  const rows = await tx
    .select({ linkId: eventLinkSharedSlots.linkId, vendorSlotId: eventLinkSharedSlots.vendorSlotId })
    .from(eventLinkSharedSlots)
    .where(inArray(eventLinkSharedSlots.linkId, linkIds))
    .orderBy(asc(eventLinkSharedSlots.createdAt));
  for (const row of rows) result.set(row.linkId, [...(result.get(row.linkId) ?? []), row.vendorSlotId]);
  return result;
}

const eventInfoColumns = { id: events.id, eventDate: events.eventDate, status: events.status, isDemo: events.isDemo };

async function withContext(tx: Tx, rows: EventLinkRow[]): Promise<LinkWithContext[]> {
  if (rows.length === 0) return [];
  const eventIds = [...new Set(rows.map((row) => row.eventId))];
  const infos = await tx.select(eventInfoColumns).from(events).where(inArray(events.id, eventIds));
  const infoById = new Map(infos.map((info) => [info.id, { eventDate: info.eventDate, status: info.status, isDemo: info.isDemo }]));
  const slots = await sharedSlotsByLink(
    tx,
    rows.map((row) => row.id),
  );
  return rows.flatMap((link) => {
    const event = infoById.get(link.eventId);
    return event ? [{ link, sharedSlotIds: slots.get(link.id) ?? [], event }] : [];
  });
}

// Le client représenté et les catégories partagées appartiennent-ils bien à
// l'événement du lien ?
async function checkReferences(
  tx: Tx,
  eventId: string,
  eventClientId: string | null,
  slotIds: string[],
  vendorCandidateId: string | null = null,
): Promise<"ok" | "invalid_client" | "invalid_slot" | "invalid_vendor"> {
  // Lot 26b (D9) : le prestataire d'un lien « vendor » est consulté sur cet événement.
  if (vendorCandidateId) {
    const [candidate] = await tx
      .select({ id: eventVendorCandidates.id })
      .from(eventVendorCandidates)
      .where(and(eq(eventVendorCandidates.id, vendorCandidateId), eq(eventVendorCandidates.eventId, eventId)));
    if (!candidate) return "invalid_vendor";
  }
  if (eventClientId) {
    const [client] = await tx
      .select({ id: eventClients.id })
      .from(eventClients)
      .where(and(eq(eventClients.id, eventClientId), eq(eventClients.eventId, eventId)));
    if (!client) return "invalid_client";
  }
  if (slotIds.length > 0) {
    const found = await tx
      .select({ id: eventVendorSlots.id })
      .from(eventVendorSlots)
      .where(and(inArray(eventVendorSlots.id, slotIds), eq(eventVendorSlots.eventId, eventId)));
    if (found.length !== slotIds.length) return "invalid_slot";
  }
  return "ok";
}

export type LinkFields = {
  personName: string;
  email: string;
  eventClientId: string | null;
  rights: EventLinkRights;
  customExpiresOn: string | null;
  otpRequired: boolean;
};

// Lot 26b (D9) : un lien de prestataire n'ouvre aucune rubrique du portail ni
// ne représente un client ; ses droits sont ceux de l'espace du prestataire.
const NO_RIGHTS: EventLinkRights = { rubrics: [], budgetScope: "all", sharedSlotIds: [] };

function fieldsForAudience(audience: LinkAudience, fields: LinkFields): LinkFields {
  return audience === "vendor" ? { ...fields, eventClientId: null, rights: NO_RIGHTS } : fields;
}

export type InsertLinkResult =
  | { status: "saved"; context: LinkWithContext }
  | { status: "event_not_found" | "demo_event" | "invalid_client" | "invalid_slot" | "invalid_vendor" };

export async function insertLinkRow(
  input: LinkFields & { organizationId: string; eventId: string; audience: LinkAudience; vendorCandidateId: string | null; tokenHash: string },
): Promise<InsertLinkResult> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [event] = await tx.select(eventInfoColumns).from(events).where(eq(events.id, input.eventId));
    if (!event) return { status: "event_not_found" };
    // AIDE-02 : jamais d'e-mail à un tiers depuis un essai.
    if (event.isDemo) return { status: "demo_event" };
    const vendorCandidateId = input.audience === "vendor" ? input.vendorCandidateId : null;
    if (input.audience === "vendor" && !vendorCandidateId) return { status: "invalid_vendor" };
    const fields = fieldsForAudience(input.audience, input);
    const references = await checkReferences(tx, input.eventId, fields.eventClientId, fields.rights.sharedSlotIds, vendorCandidateId);
    if (references !== "ok") return { status: references };

    const [link] = await tx
      .insert(eventLinks)
      .values({
        organizationId: input.organizationId,
        eventId: input.eventId,
        audience: input.audience,
        personName: fields.personName,
        email: fields.email,
        eventClientId: fields.eventClientId,
        vendorCandidateId,
        rubrics: fields.rights.rubrics,
        budgetScope: fields.rights.budgetScope,
        customExpiresOn: fields.customExpiresOn,
        otpRequired: fields.otpRequired,
        tokenHash: input.tokenHash,
      })
      .returning();
    if (!link) throw new Error("création du lien échouée");
    if (fields.rights.sharedSlotIds.length > 0) {
      await tx
        .insert(eventLinkSharedSlots)
        .values(fields.rights.sharedSlotIds.map((vendorSlotId) => ({ organizationId: input.organizationId, linkId: link.id, vendorSlotId })));
    }
    // SEC-19 : partage au journal (identifiants seulement, SEC-20).
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.link.created", objectId: input.eventId, details: { linkId: link.id, audience: input.audience } });
    return {
      status: "saved",
      context: { link, sharedSlotIds: fields.rights.sharedSlotIds, event: { eventDate: event.eventDate, status: event.status, isDemo: event.isDemo } },
    };
  });
}

export async function findEventLinkRows(organizationId: string, eventId: string): Promise<LinkWithContext[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) =>
    withContext(tx, await tx.select().from(eventLinks).where(eq(eventLinks.eventId, eventId)).orderBy(asc(eventLinks.createdAt))),
  );
}

export async function findLinkRow(organizationId: string, linkId: string): Promise<LinkWithContext | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [context] = await withContext(tx, await tx.select().from(eventLinks).where(eq(eventLinks.id, linkId)));
    return context ?? null;
  });
}

export async function findLinkByTokenHash(organizationId: string, tokenHash: string): Promise<LinkWithContext | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [context] = await withContext(tx, await tx.select().from(eventLinks).where(eq(eventLinks.tokenHash, tokenHash)));
    return context ?? null;
  });
}

export type UpdateLinkResult = { status: "saved"; context: LinkWithContext } | { status: "not_found" | "invalid_client" | "invalid_slot" | "invalid_vendor" };

// Un lien retiré ne se modifie plus. Les catégories partagées sont mises à
// jour par différence (pas de suppression inutile au journal). Lot 26b : demander
// un code à l'ouverture coupe les sessions déjà ouvertes, qui devront le saisir.
export async function updateLinkRow(organizationId: string, linkId: string, input: LinkFields): Promise<UpdateLinkResult> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [current] = await tx
      .select()
      .from(eventLinks)
      .where(and(eq(eventLinks.id, linkId), isNull(eventLinks.revokedAt)));
    if (!current) return { status: "not_found" };
    const fields = fieldsForAudience(current.audience, input);
    const references = await checkReferences(tx, current.eventId, fields.eventClientId, fields.rights.sharedSlotIds);
    if (references !== "ok") return { status: references };

    const [link] = await tx
      .update(eventLinks)
      .set({
        personName: fields.personName,
        email: fields.email,
        eventClientId: fields.eventClientId,
        rubrics: fields.rights.rubrics,
        budgetScope: fields.rights.budgetScope,
        customExpiresOn: fields.customExpiresOn,
        otpRequired: fields.otpRequired,
      })
      .where(eq(eventLinks.id, linkId))
      .returning();
    if (fields.otpRequired && !current.otpRequired) await tx.delete(eventLinkSessions).where(eq(eventLinkSessions.linkId, linkId));
    const existing = (await sharedSlotsByLink(tx, [linkId])).get(linkId) ?? [];
    const removed = existing.filter((id) => !fields.rights.sharedSlotIds.includes(id));
    const added = fields.rights.sharedSlotIds.filter((id) => !existing.includes(id));
    if (removed.length > 0) {
      await tx.delete(eventLinkSharedSlots).where(and(eq(eventLinkSharedSlots.linkId, linkId), inArray(eventLinkSharedSlots.vendorSlotId, removed)));
    }
    if (added.length > 0) {
      await tx.insert(eventLinkSharedSlots).values(added.map((vendorSlotId) => ({ organizationId, linkId, vendorSlotId })));
    }
    await appendAudit(tx, { organizationId, action: "events.link.updated", objectId: current.eventId, details: { linkId } });
    const [context] = await withContext(tx, [link!]);
    return { status: "saved", context: context! };
  });
}

// Renouveler : nouveau jeton, l'ancien et ses sessions cessent aussitôt ;
// customExpiresOn (facultatif) prolonge un lien expiré.
export async function replaceLinkTokenRow(organizationId: string, linkId: string, tokenHash: string, customExpiresOn?: string): Promise<LinkWithContext | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [link] = await tx
      .update(eventLinks)
      .set({ tokenHash, renewalRequestedAt: null, ...(customExpiresOn ? { customExpiresOn } : {}) })
      .where(and(eq(eventLinks.id, linkId), isNull(eventLinks.revokedAt)))
      .returning();
    if (!link) return null;
    await tx.delete(eventLinkSessions).where(eq(eventLinkSessions.linkId, linkId));
    await tx.delete(eventLinkCodes).where(eq(eventLinkCodes.linkId, linkId));
    await appendAudit(tx, { organizationId, action: "events.link.renewed", objectId: link.eventId, details: { linkId } });
    const [context] = await withContext(tx, [link]);
    return context ?? null;
  });
}

// Retirer : le jeton disparaît et les sessions ouvertes sont coupées (SEC-06).
export async function revokeLinkRow(organizationId: string, linkId: string): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [link] = await tx
      .update(eventLinks)
      .set({ revokedAt: new Date(), tokenHash: null, renewalRequestedAt: null })
      .where(and(eq(eventLinks.id, linkId), isNull(eventLinks.revokedAt)))
      .returning({ eventId: eventLinks.eventId });
    if (!link) return false;
    await tx.delete(eventLinkSessions).where(eq(eventLinkSessions.linkId, linkId));
    await tx.delete(eventLinkCodes).where(eq(eventLinkCodes.linkId, linkId));
    await appendAudit(tx, { organizationId, action: "events.link.revoked", objectId: link.eventId, details: { linkId } });
    return true;
  });
}

// Ouverture : une session (haché seul), date de dernière ouverture, journal.
// L'appelant fixe l'auteur (le lien) par withActor.
export async function insertLinkSessionRow(input: { organizationId: string; linkId: string; eventId: string; tokenHash: string; expiresAt: Date; now: Date }): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, input.organizationId, async (tx) => {
    await tx.insert(eventLinkSessions).values({
      organizationId: input.organizationId,
      linkId: input.linkId,
      tokenHash: input.tokenHash,
      createdAt: input.now,
      lastSeenAt: input.now,
      expiresAt: input.expiresAt,
    });
    await tx.update(eventLinks).set({ lastOpenedAt: input.now }).where(eq(eventLinks.id, input.linkId));
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.link.opened", objectId: input.eventId, details: { linkId: input.linkId } });
  });
}

export async function findLinkSessionRow(organizationId: string, tokenHash: string): Promise<{ session: EventLinkSessionRow; context: LinkWithContext } | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [session] = await tx.select().from(eventLinkSessions).where(eq(eventLinkSessions.tokenHash, tokenHash));
    if (!session) return null;
    const [context] = await withContext(tx, await tx.select().from(eventLinks).where(eq(eventLinks.id, session.linkId)));
    return context ? { session, context } : null;
  });
}

export async function touchLinkSessionRow(organizationId: string, sessionId: string, lastSeenAt: Date, expiresAt: Date): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, (tx) => tx.update(eventLinkSessions).set({ lastSeenAt, expiresAt }).where(eq(eventLinkSessions.id, sessionId)));
}

export async function deleteLinkSessionRow(organizationId: string, tokenHash: string): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, (tx) => tx.delete(eventLinkSessions).where(eq(eventLinkSessions.tokenHash, tokenHash)));
}

// Décision D5 : la demande est notée sur le lien (une fois) et inscrite au
// journal ; true si elle est nouvelle.
export async function markLinkRenewalRequestedRow(organizationId: string, linkId: string, now: Date): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [link] = await tx
      .update(eventLinks)
      .set({ renewalRequestedAt: now })
      .where(and(eq(eventLinks.id, linkId), isNull(eventLinks.revokedAt), isNull(eventLinks.renewalRequestedAt)))
      .returning({ eventId: eventLinks.eventId });
    if (!link) return false;
    await appendAudit(tx, { organizationId, action: "events.link.renewal_requested", objectId: link.eventId, details: { linkId } });
    return true;
  });
}

// Demandes de nouveau lien en attente, pour l'accueil (« Aujourd'hui »).
export async function findPendingRenewalRows(organizationId: string): Promise<{ linkId: string; eventId: string; personName: string; requestedAt: Date }[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const rows = await tx
      .select({ linkId: eventLinks.id, eventId: eventLinks.eventId, personName: eventLinks.personName, requestedAt: eventLinks.renewalRequestedAt })
      .from(eventLinks)
      .where(and(isNull(eventLinks.revokedAt), sql`${eventLinks.renewalRequestedAt} is not null`))
      .orderBy(asc(eventLinks.renewalRequestedAt));
    return rows.map((row) => ({ ...row, requestedAt: row.requestedAt! }));
  });
}

export async function findLinkNameRows(organizationId: string, linkIds: string[]): Promise<Record<string, string>> {
  if (linkIds.length === 0) return {};
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const rows = await tx.select({ id: eventLinks.id, personName: eventLinks.personName }).from(eventLinks).where(inArray(eventLinks.id, linkIds));
    return Object.fromEntries(rows.map((row) => [row.id, row.personName]));
  });
}

export type LinkTaskToggleResult = { status: "saved"; task: EventTaskRow } | { status: "denied" };

// Le tiers ne coche que les tâches « mariés » de l'événement de son lien ;
// chaque changement va au fil d'activité, dans la même transaction.
export async function toggleLinkTaskRow(input: { organizationId: string; linkId: string; eventId: string; taskId: string; done: boolean }): Promise<LinkTaskToggleResult> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [task] = await tx.select().from(eventTasks).where(and(eq(eventTasks.id, input.taskId), eq(eventTasks.eventId, input.eventId)));
    if (!task || task.responsible !== "clients") return { status: "denied" };
    if ((task.doneAt !== null) === input.done) return { status: "saved", task };
    const [updated] = await tx
      .update(eventTasks)
      .set({ doneAt: input.done ? new Date() : null, updatedAt: new Date() })
      .where(eq(eventTasks.id, input.taskId))
      .returning();
    await tx.insert(eventActivities).values({
      organizationId: input.organizationId,
      eventId: input.eventId,
      actorLinkId: input.linkId,
      kind: input.done ? "task_done" : "task_undone",
      taskId: input.taskId,
      taskLabel: task.label,
    });
    return { status: "saved", task: updated! };
  });
}

// Lot 26b (POR-01, décision D6) — codes à usage unique.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Nouveau code : les codes encore valables du lien cessent, ceux de plus d'un
// jour sont effacés ; au-delà de maxPerHour codes dans l'heure, rien ne part.
// L'appelant fixe l'auteur (le lien) par withActor.
export async function issueLinkCodeRow(input: {
  organizationId: string;
  linkId: string;
  eventId: string;
  codeHash: string;
  expiresAt: Date;
  now: Date;
  maxPerHour: number;
}): Promise<"issued" | "throttled"> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    await tx.delete(eventLinkCodes).where(and(eq(eventLinkCodes.linkId, input.linkId), lt(eventLinkCodes.createdAt, new Date(input.now.getTime() - DAY_MS))));
    const [recent] = await tx
      .select({ total: count() })
      .from(eventLinkCodes)
      .where(and(eq(eventLinkCodes.linkId, input.linkId), gte(eventLinkCodes.createdAt, new Date(input.now.getTime() - HOUR_MS))));
    if ((recent?.total ?? 0) >= input.maxPerHour) return "throttled";
    await tx
      .update(eventLinkCodes)
      .set({ consumedAt: input.now })
      .where(and(eq(eventLinkCodes.linkId, input.linkId), isNull(eventLinkCodes.consumedAt)));
    await tx.insert(eventLinkCodes).values({
      organizationId: input.organizationId,
      linkId: input.linkId,
      codeHash: input.codeHash,
      createdAt: input.now,
      expiresAt: input.expiresAt,
    });
    await appendAudit(tx, { organizationId: input.organizationId, action: "events.link.code_sent", objectId: input.eventId, details: { linkId: input.linkId } });
    return "issued";
  });
}

export type LinkCodeAttempt = { status: "accepted" } | { status: "wrong"; attemptsLeft: number } | { status: "expired" };

// Un essai sur le dernier code du lien, verrouillé le temps de la
// transaction : chaque essai compte, le bon code ne sert qu'une fois, le
// cinquième échec le bloque.
export async function attemptLinkCodeRow(input: { organizationId: string; linkId: string; eventId: string; codeHash: string; now: Date }): Promise<LinkCodeAttempt> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [code] = await tx
      .select()
      .from(eventLinkCodes)
      .where(and(eq(eventLinkCodes.linkId, input.linkId), isNull(eventLinkCodes.consumedAt)))
      .orderBy(desc(eventLinkCodes.createdAt))
      .limit(1)
      .for("update");
    if (!code || !isLinkCodeUsable(code, input.now)) return { status: "expired" };
    const attempts = code.attempts + 1;
    if (sameLinkCodeHash(code.codeHash, input.codeHash)) {
      await tx.update(eventLinkCodes).set({ attempts, consumedAt: input.now }).where(eq(eventLinkCodes.id, code.id));
      return { status: "accepted" };
    }
    const locked = attempts >= LINK_CODE_MAX_ATTEMPTS;
    await tx
      .update(eventLinkCodes)
      .set({ attempts, ...(locked ? { consumedAt: input.now } : {}) })
      .where(eq(eventLinkCodes.id, code.id));
    if (locked) {
      await appendAudit(tx, { organizationId: input.organizationId, action: "events.link.code_locked", objectId: input.eventId, details: { linkId: input.linkId } });
    }
    return { status: "wrong", attemptsLeft: LINK_CODE_MAX_ATTEMPTS - attempts };
  });
}

// Lot 26b (D9) : le prestataire consulté d'un lien « vendor » et son poste.
export async function findLinkVendorRow(
  organizationId: string,
  vendorCandidateId: string,
): Promise<{ eventId: string; vendorSlotId: string; vendorName: string; slotLabel: string } | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx
      .select({ eventId: eventVendorCandidates.eventId, vendorSlotId: eventVendorCandidates.vendorSlotId, vendorName: eventVendorCandidates.vendorName, slotLabel: eventVendorSlots.label })
      .from(eventVendorCandidates)
      .innerJoin(eventVendorSlots, eq(eventVendorSlots.id, eventVendorCandidates.vendorSlotId))
      .where(eq(eventVendorCandidates.id, vendorCandidateId));
    return row ?? null;
  });
}
