// Lot 51 (JRJ-05 à JRJ-09, ARC-09 ; D2 à D5, ADR 0091) — le jour J de terrain, côté serveur :
// les actions reçues de la file de l'appareil (pointage, décalage validé, incident, case cochée,
// photo), chacune une seule fois (identifiant d'action unique par organisation : une action rejouée
// est ignorée), et l'état partagé de l'équipe. Les pointages et les incidents s'ajoutent, jamais ne
// s'écrasent ; la première coche d'une case reste. Accès aux données du module events ; exposé
// seulement par service.ts (ADR 0011).
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import {
  dayChecklistItems,
  dayChecklists,
  dayCheckpoints,
  dayIncidents,
  dayPhotos,
  dayShifts,
  events,
  keyMoments,
  programItems,
} from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type {
  DayActionStatus,
  DayCheckAction,
  DayChecklist,
  DayCheckpoint,
  DayCheckpointAction,
  DayIncident,
  DayIncidentAction,
  DayPhoto,
  DayPhotoRejection,
  DayPhotoSubject,
  DayShift,
  DayShiftAction,
} from "@symbola/contracts";
import { DAY_INCIDENT_MAX } from "@symbola/contracts";
import { itemActuals } from "@/lib/day-of/rules";
import { shiftedTimes } from "./program";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
export const DAY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

// Le résultat d'une action reçue ; `reason` dit pourquoi une action est refusée pour de bon.
export type DayActionResult = { status: DayActionStatus; reason?: string };

const APPLIED: DayActionResult = { status: "applied" };
const DUPLICATE: DayActionResult = { status: "duplicate" };
const rejected = (reason: string): DayActionResult => ({ status: "rejected", reason });

// L'heure de l'appareil : un instant valide, ni avant 2020 ni plus d'un jour dans le futur (une
// horloge folle ne fausse pas le bilan au-delà).
export function deviceInstant(value: string, now: Date): Date | null {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  if (instant.getTime() < Date.UTC(2020, 0, 1) || instant.getTime() > now.getTime() + 86_400_000) return null;
  return instant;
}

async function eventExists(tx: Tx, eventId: string): Promise<boolean> {
  const [row] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId));
  return Boolean(row);
}

// Lot 52 (EVT-06, D3) : l'auteur d'une action est un compte de l'équipe, ou le lien du renfort du jour J.
function author(input: { userId: string | null; linkId?: string | null | undefined }): { userId: string | null; linkId: string | null } {
  return input.linkId ? { userId: null, linkId: input.linkId } : { userId: input.userId, linkId: null };
}

// —— Pointage (JRJ-05, JRJ-08) ————————————————————————————————————————————————————————————

export async function recordDayCheckpoint(input: { organizationId: string; eventId: string; userId: string | null; linkId?: string | null; action: DayCheckpointAction; now?: Date }): Promise<DayActionResult> {
  const deviceAt = deviceInstant(input.action.deviceAt, input.now ?? new Date());
  if (!deviceAt) return rejected("time");
  return inOrganization(input.organizationId, async (tx) => {
    const [item] = await tx.select({ id: programItems.id }).from(programItems).where(and(eq(programItems.id, input.action.itemId), eq(programItems.eventId, input.eventId)));
    if (!item) return rejected("item");
    const inserted = await tx
      .insert(dayCheckpoints)
      .values({ organizationId: input.organizationId, eventId: input.eventId, programItemId: item.id, kind: input.action.checkpoint, deviceAt, ...author(input), actionId: input.action.actionId })
      .onConflictDoNothing({ target: [dayCheckpoints.organizationId, dayCheckpoints.actionId] })
      .returning({ id: dayCheckpoints.id });
    return inserted.length > 0 ? APPLIED : DUPLICATE;
  });
}

// —— Main courante (JRJ-07) ———————————————————————————————————————————————————————————————

// Lot 53 (HUB-15, UX-16 ; D2) : un incident noté sur le terrain part en « Alerte du jour J » aux autres
// destinataires (pas à celui qui l'a noté) ; le jour de l'évènement, elle passe outre les plages de
// silence. Le texte de l'incident reste dans l'app (ni push ni objet d'e-mail).
export async function recordDayIncident(input: { organizationId: string; eventId: string; userId: string | null; linkId?: string | null; action: DayIncidentAction; now?: Date; notify?: (incident: { incidentId: string; eventDate: string | null; isDemo: boolean }) => Promise<void> }): Promise<DayActionResult> {
  const result = await recordDayIncidentRow(input);
  if (result.status === "applied" && input.notify && result.incidentId) await input.notify({ incidentId: result.incidentId, eventDate: result.eventDate, isDemo: result.isDemo }).catch(() => undefined);
  return result.outcome;
}

async function recordDayIncidentRow(input: { organizationId: string; eventId: string; userId: string | null; linkId?: string | null; action: DayIncidentAction; now?: Date }): Promise<{ status: "applied" | "other"; outcome: DayActionResult; incidentId: string | null; eventDate: string | null; isDemo: boolean }> {
  const wrap = (outcome: DayActionResult) => ({ status: "other" as const, outcome, incidentId: null, eventDate: null, isDemo: false });
  const deviceAt = deviceInstant(input.action.deviceAt, input.now ?? new Date());
  if (!deviceAt) return wrap(rejected("time"));
  const body = input.action.body.trim();
  if (body.length === 0 || body.length > DAY_INCIDENT_MAX) return wrap(rejected("body"));
  return inOrganization(input.organizationId, async (tx) => {
    const [event] = await tx.select({ eventDate: events.eventDate, isDemo: events.isDemo }).from(events).where(eq(events.id, input.eventId));
    if (!event) return wrap(rejected("event"));
    let keyMomentId: string | null = null;
    if (input.action.keyMomentId) {
      const [moment] = await tx.select({ id: keyMoments.id }).from(keyMoments).where(and(eq(keyMoments.id, input.action.keyMomentId), eq(keyMoments.eventId, input.eventId)));
      keyMomentId = moment?.id ?? null;
    }
    const inserted = await tx
      .insert(dayIncidents)
      .values({ organizationId: input.organizationId, eventId: input.eventId, keyMomentId, body, severity: input.action.severity, deviceAt, ...author(input), actionId: input.action.actionId })
      .onConflictDoNothing({ target: [dayIncidents.organizationId, dayIncidents.actionId] })
      .returning({ id: dayIncidents.id });
    return inserted.length > 0 ? { status: "applied" as const, outcome: APPLIED, incidentId: inserted[0]!.id, eventDate: event.eventDate, isDemo: event.isDemo } : wrap(DUPLICATE);
  });
}

// —— Case d'une liste (JRJ-06) ————————————————————————————————————————————————————————————

// La première coche reste (heure, personne) : une seconde coche de la même case est ignorée.
export async function recordDayCheck(input: { organizationId: string; eventId: string; userId: string | null; linkId?: string | null; action: DayCheckAction; now?: Date }): Promise<DayActionResult> {
  const deviceAt = deviceInstant(input.action.deviceAt, input.now ?? new Date());
  if (!deviceAt) return rejected("time");
  return inOrganization(input.organizationId, async (tx) => {
    const [row] = await tx
      .select({ id: dayChecklistItems.id, checkedAt: dayChecklistItems.checkedAt })
      .from(dayChecklistItems)
      .innerJoin(dayChecklists, eq(dayChecklists.id, dayChecklistItems.checklistId))
      .where(and(eq(dayChecklistItems.id, input.action.checklistItemId), eq(dayChecklists.eventId, input.eventId)));
    if (!row) return rejected("item");
    if (row.checkedAt) return DUPLICATE;
    const updated = await tx
      .update(dayChecklistItems)
      .set({ checkedAt: deviceAt, checkedBy: input.linkId ? null : input.userId, checkedByLinkId: input.linkId ?? null, checkActionId: input.action.actionId, updatedAt: new Date() })
      .where(and(eq(dayChecklistItems.id, row.id), isNull(dayChecklistItems.checkedAt)))
      .returning({ id: dayChecklistItems.id });
    return updated.length > 0 ? APPLIED : DUPLICATE;
  });
}

// —— Décalage validé (JRJ-05) —————————————————————————————————————————————————————————————

export type DayShiftRecord = DayActionResult & { shiftId?: string };

// Le décalage validé par la planner s'enregistre et s'applique au programme en une transaction, une
// seule fois (identifiant d'action). Une séquence supprimée entre-temps, ou un début qui sortirait du
// jour, refuse l'application : la validation reste écrite (bilan), rien n'est décalé ni envoyé.
export async function recordDayShift(input: { organizationId: string; eventId: string; userId: string; action: DayShiftAction; now?: Date }): Promise<DayShiftRecord> {
  const now = input.now ?? new Date();
  const validatedAt = deviceInstant(input.action.deviceAt, now);
  if (!validatedAt) return rejected("time");
  const { minutes } = input.action;
  const itemIds = [...new Set(input.action.itemIds)];
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720 || itemIds.length === 0 || itemIds.length > 200) return rejected("shift");
  const vendorSlotIds = [...new Set(input.action.vendorSlotIds)].slice(0, 200);
  return inOrganization(input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId)).for("update");
    if (!event) return rejected("event");
    const [late] = await tx.select({ id: programItems.id }).from(programItems).where(and(eq(programItems.id, input.action.lateItemId), eq(programItems.eventId, input.eventId)));
    let keyMomentId: string | null = null;
    if (input.action.keyMomentId) {
      const [moment] = await tx.select({ id: keyMoments.id }).from(keyMoments).where(and(eq(keyMoments.id, input.action.keyMomentId), eq(keyMoments.eventId, input.eventId)));
      keyMomentId = moment?.id ?? null;
    }
    const [shift] = await tx
      .insert(dayShifts)
      .values({
        organizationId: input.organizationId,
        eventId: input.eventId,
        keyMomentId,
        lateItemId: late?.id ?? null,
        minutes,
        itemIds,
        vendorSlotIds,
        validatedAt,
        validatedBy: input.userId,
        actionId: input.action.actionId,
      })
      .onConflictDoNothing({ target: [dayShifts.organizationId, dayShifts.actionId] })
      .returning({ id: dayShifts.id });
    if (!shift) return DUPLICATE;
    const rows = await tx.select().from(programItems).where(and(eq(programItems.eventId, input.eventId), inArray(programItems.id, itemIds)));
    const plans = rows.map((row) => ({ row, times: shiftedTimes(row, minutes) }));
    const outcome = rows.length !== itemIds.length ? "items_missing" : plans.some((plan) => plan.times === null) ? "out_of_day" : "applied";
    if (outcome === "applied") {
      for (const { row, times } of plans) await tx.update(programItems).set({ ...times!, updatedAt: now }).where(eq(programItems.id, row.id));
      await tx.update(events).set({ programUpdatedAt: now }).where(eq(events.id, input.eventId));
    }
    await tx
      .update(dayShifts)
      .set({ outcome, appliedAt: outcome === "applied" ? now : null })
      .where(eq(dayShifts.id, shift.id));
    return outcome === "applied" ? { ...APPLIED, shiftId: shift.id } : { ...rejected(outcome), shiftId: shift.id };
  });
}

export async function setDayShiftVersion(organizationId: string, shiftId: string, version: number): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.update(dayShifts).set({ programVersion: version }).where(eq(dayShifts.id, shiftId)));
}

// Les e-mails d'un décalage ne partent qu'une fois : la ligne est réservée avant l'envoi.
export async function claimDayShiftNotification(organizationId: string, shiftId: string, now: Date): Promise<DayShift | null> {
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .update(dayShifts)
      .set({ notifiedAt: now })
      .where(and(eq(dayShifts.id, shiftId), eq(dayShifts.outcome, "applied"), isNull(dayShifts.notifiedAt)))
      .returning(),
  );
  return row ? toShift(row) : null;
}

export async function recordDayShiftNotification(organizationId: string, shiftId: string, count: number): Promise<void> {
  await inOrganization(organizationId, (tx) => tx.update(dayShifts).set({ notifiedCount: count }).where(eq(dayShifts.id, shiftId)));
}

// Décalages appliqués mais pas encore envoyés (un envoi interrompu se reprend à la prochaine action).
export async function findUnnotifiedDayShifts(organizationId: string, eventId: string): Promise<string[]> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ id: dayShifts.id })
      .from(dayShifts)
      .where(and(eq(dayShifts.eventId, eventId), eq(dayShifts.outcome, "applied"), isNull(dayShifts.notifiedAt))),
  );
  return rows.map((row) => row.id);
}

// —— Photos (JRJ-06, JRJ-07, JRJ-09) ——————————————————————————————————————————————————————

export type DayPhotoTarget = { subject: DayPhotoSubject; subjectId: string };

// Le sujet d'une photo : une case ou un incident de cet évènement (un incident peut être désigné
// par l'action qui l'a créé, encore en file au moment de la photo). Une échéance (reçu d'une remise)
// est vérifiée par le module budget, avant l'appel.
export async function resolveDayPhotoSubject(input: { organizationId: string; eventId: string; subject: DayPhotoSubject; subjectId: string | null; subjectActionId: string | null }): Promise<DayPhotoTarget | null> {
  if (input.subject === "handover") return input.subjectId && DAY_UUID.test(input.subjectId) ? { subject: "handover", subjectId: input.subjectId } : null;
  return inOrganization(input.organizationId, async (tx) => {
    if (input.subject === "incident") {
      const condition = input.subjectId && DAY_UUID.test(input.subjectId) ? eq(dayIncidents.id, input.subjectId) : input.subjectActionId && DAY_UUID.test(input.subjectActionId) ? eq(dayIncidents.actionId, input.subjectActionId) : null;
      if (!condition) return null;
      const [row] = await tx.select({ id: dayIncidents.id }).from(dayIncidents).where(and(condition, eq(dayIncidents.eventId, input.eventId)));
      return row ? { subject: "incident", subjectId: row.id } : null;
    }
    if (!input.subjectId || !DAY_UUID.test(input.subjectId)) return null;
    const [row] = await tx
      .select({ id: dayChecklistItems.id })
      .from(dayChecklistItems)
      .innerJoin(dayChecklists, eq(dayChecklists.id, dayChecklistItems.checklistId))
      .where(and(eq(dayChecklistItems.id, input.subjectId), eq(dayChecklists.eventId, input.eventId)));
    return row ? { subject: "checklist_item", subjectId: row.id } : null;
  });
}

export async function dayPhotoActionExists(organizationId: string, actionId: string): Promise<DayPhoto | null> {
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(dayPhotos).where(eq(dayPhotos.actionId, actionId)));
  return row ? toPhoto(row) : null;
}

// Écrit la photo (stockée, ou refusée sans fichier) ; une action déjà reçue est ignorée.
export async function insertDayPhoto(input: {
  organizationId: string;
  eventId: string;
  userId: string | null;
  linkId?: string | null;
  actionId: string;
  takenAt: Date;
  target: DayPhotoTarget;
  stored: { key: string; contentType: string; sizeBytes: number } | null;
  rejection: DayPhotoRejection | null;
}): Promise<{ photo: DayPhoto; duplicate: boolean }> {
  return inOrganization(input.organizationId, async (tx) => {
    const [row] = await tx
      .insert(dayPhotos)
      .values({
        organizationId: input.organizationId,
        eventId: input.eventId,
        subject: input.target.subject,
        subjectId: input.target.subjectId,
        state: input.stored ? "stored" : "rejected",
        rejection: input.stored ? null : (input.rejection ?? "unavailable"),
        storageKey: input.stored?.key ?? null,
        contentType: input.stored?.contentType ?? null,
        sizeBytes: input.stored?.sizeBytes ?? null,
        takenAt: input.takenAt,
        takenBy: input.linkId ? null : input.userId,
        takenByLinkId: input.linkId ?? null,
        actionId: input.actionId,
      })
      .onConflictDoNothing({ target: [dayPhotos.organizationId, dayPhotos.actionId] })
      .returning();
    if (row) return { photo: toPhoto(row), duplicate: false };
    const [existing] = await tx.select().from(dayPhotos).where(eq(dayPhotos.actionId, input.actionId));
    return { photo: toPhoto(existing!), duplicate: true };
  });
}

// Le fichier d'une photo de cet évènement (servi par l'app après contrôle des droits, ADR 0027).
export async function findDayPhotoFile(organizationId: string, eventId: string, photoId: string, options: { withoutHandovers?: boolean } = {}): Promise<{ key: string; contentType: string } | null> {
  if (!DAY_UUID.test(photoId)) return null;
  const [row] = await inOrganization(organizationId, (tx) =>
    tx
      .select({ key: dayPhotos.storageKey, contentType: dayPhotos.contentType, subject: dayPhotos.subject })
      .from(dayPhotos)
      .where(and(eq(dayPhotos.id, photoId), eq(dayPhotos.eventId, eventId), eq(dayPhotos.state, "stored"))),
  );
  if (options.withoutHandovers && row?.subject === "handover") return null;
  return row?.key && row.contentType ? { key: row.key, contentType: row.contentType } : null;
}

// Les fichiers des photos des évènements donnés (purge avec l'évènement, DPO-9).
export async function dayPhotoKeys(organizationId: string, eventIds: string[]): Promise<string[]> {
  if (eventIds.length === 0) return [];
  const rows = await inOrganization(organizationId, (tx) => tx.select({ key: dayPhotos.storageKey }).from(dayPhotos).where(inArray(dayPhotos.eventId, eventIds)));
  return rows.map((row) => row.key).filter((key): key is string => key !== null);
}

// —— État partagé (JRJ-08) ————————————————————————————————————————————————————————————————

function toPhoto(row: typeof dayPhotos.$inferSelect): DayPhoto {
  return {
    id: row.id,
    subject: row.subject as DayPhotoSubject,
    subjectId: row.subjectId,
    state: row.state as DayPhoto["state"],
    rejection: (row.rejection as DayPhotoRejection | null) ?? null,
    takenAt: row.takenAt.toISOString(),
    // Lot 52 : un compte de l'équipe, ou le lien du renfort (nommé par l'état partagé).
    takenBy: row.takenBy ?? row.takenByLinkId ?? "",
  };
}

function toShift(row: typeof dayShifts.$inferSelect): DayShift {
  return {
    id: row.id,
    keyMomentId: row.keyMomentId,
    lateItemId: row.lateItemId,
    minutes: row.minutes,
    itemIds: row.itemIds,
    vendorSlotIds: row.vendorSlotIds,
    validatedAt: row.validatedAt.toISOString(),
    validatedBy: row.validatedBy,
    outcome: (row.outcome as DayShift["outcome"]) ?? null,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    programVersion: row.programVersion,
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
    notifiedCount: row.notifiedCount,
  };
}

export type DayRecords = {
  checkpoints: DayCheckpoint[];
  shifts: DayShift[];
  incidents: DayIncident[];
  checklists: DayChecklist[];
  photos: DayPhoto[];
};

export async function findDayRecords(organizationId: string, eventId: string): Promise<DayRecords | null> {
  if (!DAY_UUID.test(eventId)) return null;
  return inOrganization(organizationId, async (tx) => {
    if (!(await eventExists(tx, eventId))) return null;
    const checkpointRows = await tx.select().from(dayCheckpoints).where(eq(dayCheckpoints.eventId, eventId)).orderBy(asc(dayCheckpoints.deviceAt), asc(dayCheckpoints.id));
    const shiftRows = await tx.select().from(dayShifts).where(eq(dayShifts.eventId, eventId)).orderBy(asc(dayShifts.validatedAt));
    const incidentRows = await tx.select().from(dayIncidents).where(eq(dayIncidents.eventId, eventId)).orderBy(desc(dayIncidents.deviceAt));
    const photoRows = await tx.select().from(dayPhotos).where(eq(dayPhotos.eventId, eventId)).orderBy(asc(dayPhotos.takenAt));
    const listRows = await tx.select().from(dayChecklists).where(eq(dayChecklists.eventId, eventId)).orderBy(asc(dayChecklists.position), asc(dayChecklists.createdAt));
    const itemRows =
      listRows.length > 0
        ? await tx
            .select()
            .from(dayChecklistItems)
            .where(
              inArray(
                dayChecklistItems.checklistId,
                listRows.map((list) => list.id),
              ),
            )
            .orderBy(asc(dayChecklistItems.position), asc(dayChecklistItems.createdAt))
        : [];
    const photos = photoRows.map(toPhoto);
    const photosOf = (subject: DayPhotoSubject, id: string) => photos.filter((photo) => photo.subject === subject && photo.subjectId === id);
    return {
      checkpoints: checkpointRows.map((row) => ({ id: row.id, itemId: row.programItemId, kind: row.kind as DayCheckpoint["kind"], deviceAt: row.deviceAt.toISOString(), userId: row.userId ?? row.linkId ?? "" })),
      shifts: shiftRows.map(toShift),
      incidents: incidentRows.map((row) => ({
        id: row.id,
        actionId: row.actionId,
        keyMomentId: row.keyMomentId,
        body: row.body,
        severity: (row.severity as DayIncident["severity"]) ?? null,
        deviceAt: row.deviceAt.toISOString(),
        userId: row.userId ?? row.linkId ?? "",
        photos: photosOf("incident", row.id),
      })),
      checklists: listRows.map((list) => ({
        id: list.id,
        keyMomentId: list.keyMomentId,
        name: list.name,
        phase: list.phase as DayChecklist["phase"],
        position: list.position,
        items: itemRows
          .filter((item) => item.checklistId === list.id)
          .map((item) => ({ id: item.id, label: item.label, position: item.position, checkedAt: item.checkedAt?.toISOString() ?? null, checkedBy: item.checkedBy ?? item.checkedByLinkId ?? (item.checkedAt ? "" : null), photos: photosOf("checklist_item", item.id) })),
      })),
      photos,
    };
  });
}

export function actualsOf(records: DayRecords) {
  return itemActuals(records.checkpoints);
}
