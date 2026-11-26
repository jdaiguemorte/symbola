// Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) — corbeille du module events : marquer et rendre un
// évènement, rendre un élément ou un objet, lister la corbeille, purger. Les suppressions courantes
// restent dans leurs fichiers (repository, places, task-comments, documents) ; exposé seulement par
// service.ts (ADR 0011). Toute lecture ici voit la corbeille (includingDeleted, inTrash).
import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { includingDeleted } from "@symbola/db/actor";
import {
  dayPhotos,
  eventClients,
  eventDocuments,
  eventLinks,
  eventPlaces,
  events,
  eventTaskAttachments,
  eventTaskComments,
  eventTasks,
  keyMoments,
  programItems,
  programTemplates,
  taskTemplateItems,
  taskTemplates,
} from "@symbola/db/schema/events";
import { inTrash, markDeleted, UNMARKED } from "@symbola/db/soft-delete";
import { createStorageClient, deletePrivateObject } from "@symbola/files";
import { documentKeys, purgeDocuments } from "./documents";
import { purgeEventRows } from "./repository";
import { candidateQuoteKeys } from "./vendor-candidates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lot 70a (A5 ; ADR 0116) : « task », une tâche ou les tâches supprimées d'un même geste.
export type EventTrashKind = "event" | "document" | "taskTemplate" | "programTemplate" | "task";

export type TrashedEventRow = { kind: EventTrashKind; id: string; label: string | null; eventId: string | null; deletedAt: Date; deletedBy: string | null; count?: number };

async function deleteFiles(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const storage = createStorageClient();
  for (const key of new Set(keys)) await deletePrivateObject(storage, key).catch(() => undefined);
}

// —— L'évènement ————————————————————————————————————————————————————————————————————————

// Marque l'évènement à la date donnée ; les modules budget et devis marquent leurs lignes à la même
// date (lib/trash.ts). Un évènement d'essai a sa propre fin (« Terminer l'essai ») : il n'y va pas.
export async function trashEventRow(organizationId: string, eventId: string, at: Date): Promise<boolean> {
  if (!UUID.test(eventId)) return false;
  const rows = await inTrash(organizationId, (tx) =>
    tx
      .update(events)
      .set(markDeleted(at))
      .where(and(eq(events.id, eventId), isNull(events.deletedAt), eq(events.isDemo, false)))
      .returning({ id: events.id }),
  );
  return rows.length > 0;
}

// Rend l'évènement et tout son contenu (caché avec lui) ; renvoie la date de sa suppression, que
// suivent les lignes des autres modules.
export async function restoreEventRow(organizationId: string, eventId: string): Promise<Date | null> {
  if (!UUID.test(eventId)) return null;
  return inTrash(organizationId, async (tx) => {
    const [row] = await tx.select({ deletedAt: events.deletedAt }).from(events).where(and(eq(events.id, eventId), isNotNull(events.deletedAt)));
    if (!row?.deletedAt) return null;
    await tx.update(events).set(UNMARKED).where(eq(events.id, eventId));
    return row.deletedAt;
  });
}

// Un contact client d'un évènement, ou titulaire d'un lien personnel, ne va pas à la corbeille
// (ADR 0073) ; un évènement à la corbeille compte aussi : il peut revenir.
export async function isContactUsedByAnEvent(organizationId: string, contactId: string): Promise<boolean> {
  if (!UUID.test(contactId)) return false;
  return inTrash(organizationId, async (tx) => {
    const client = await tx.select({ id: eventClients.id }).from(eventClients).where(eq(eventClients.contactId, contactId)).limit(1);
    if (client.length > 0) return true;
    const link = await tx.select({ id: eventLinks.id }).from(eventLinks).where(eq(eventLinks.contactId, contactId)).limit(1);
    return link.length > 0;
  });
}

// —— Rendre un objet ————————————————————————————————————————————————————————————————————

async function unmark(organizationId: string, table: typeof eventDocuments | typeof taskTemplates | typeof programTemplates, id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const rows = await inTrash(organizationId, (tx) => tx.update(table).set(UNMARKED).where(and(eq(table.id, id), isNotNull(table.deletedAt))).returning({ id: table.id }));
  return rows.length > 0;
}

export function restoreDocumentRow(organizationId: string, documentId: string): Promise<boolean> {
  return unmark(organizationId, eventDocuments, documentId);
}

export function restoreTaskTemplateRow(organizationId: string, templateId: string): Promise<boolean> {
  return unmark(organizationId, taskTemplates, templateId);
}

export function restoreProgramTemplateRow(organizationId: string, templateId: string): Promise<boolean> {
  return unmark(organizationId, programTemplates, templateId);
}

// —— Lister la corbeille ————————————————————————————————————————————————————————————————

// Les objets du module à la corbeille (le libellé d'un évènement est composé par service.ts). Les
// documents d'un évènement à la corbeille n'y figurent pas un à un : ils suivent l'évènement.
export async function listTrashedEventRows(organizationId: string): Promise<TrashedEventRow[]> {
  return inTrash(organizationId, async (tx) => {
    const trashedEvents = await tx.select({ id: events.id, deletedAt: events.deletedAt, deletedBy: events.deletedBy }).from(events).where(isNotNull(events.deletedAt));
    const documents = await tx
      .select({ id: eventDocuments.id, label: eventDocuments.label, eventId: eventDocuments.eventId, deletedAt: eventDocuments.deletedAt, deletedBy: eventDocuments.deletedBy })
      .from(eventDocuments)
      .innerJoin(events, eq(events.id, eventDocuments.eventId))
      .where(and(isNotNull(eventDocuments.deletedAt), isNull(events.deletedAt)));
    const tasks = await tx
      .select({ id: taskTemplates.id, label: taskTemplates.name, deletedAt: taskTemplates.deletedAt, deletedBy: taskTemplates.deletedBy })
      .from(taskTemplates)
      .where(isNotNull(taskTemplates.deletedAt));
    const programs = await tx
      .select({ id: programTemplates.id, label: programTemplates.name, deletedAt: programTemplates.deletedAt, deletedBy: programTemplates.deletedBy })
      .from(programTemplates)
      .where(isNotNull(programTemplates.deletedAt));
    const rows: TrashedEventRow[] = [];
    for (const row of trashedEvents) rows.push({ kind: "event", id: row.id, label: null, eventId: row.id, deletedAt: row.deletedAt!, deletedBy: row.deletedBy });
    for (const row of documents) rows.push({ kind: "document", id: row.id, label: row.label, eventId: row.eventId, deletedAt: row.deletedAt!, deletedBy: row.deletedBy });
    for (const row of tasks) rows.push({ kind: "taskTemplate", id: row.id, label: row.label, eventId: null, deletedAt: row.deletedAt!, deletedBy: row.deletedBy });
    for (const row of programs) rows.push({ kind: "programTemplate", id: row.id, label: row.label, eventId: null, deletedAt: row.deletedAt!, deletedBy: row.deletedBy });
    // Lot 70a (A5) : les tâches supprimées d'un même geste (même date et même auteur, à la microseconde
    // près, comme « Annuler ») font une seule ligne ; celles d'un évènement à la corbeille le suivent.
    const taskGroups = await tx.execute<{ id: string; label: string; event_id: string | null; deleted_at: string; deleted_by: string | null; count: number }>(sql`
      select (array_agg(t.id order by t.position, t.id))[1] as id,
             (array_agg(t.label order by t.position, t.id))[1] as label,
             case when count(distinct coalesce(t.event_id::text, '-')) = 1 then (array_agg(t.event_id))[1] end as event_id,
             t.deleted_at, t.deleted_by, count(*)::int as count
      from ${eventTasks} as t
      where t.deleted_at is not null
        and (t.event_id is null or exists (select 1 from ${events} as e where e.id = t.event_id and e.deleted_at is null))
      group by t.deleted_at, t.deleted_by`);
    for (const row of taskGroups) {
      rows.push({ kind: "task", id: row.id, label: row.label, eventId: row.event_id, deletedAt: new Date(row.deleted_at), deletedBy: row.deleted_by, ...(row.count > 1 ? { count: row.count } : {}) });
    }
    return rows;
  });
}

// La ligne d'une tâche (et de son geste) est-elle à la corbeille ?
async function isTaskTrashed(organizationId: string, taskId: string): Promise<boolean> {
  return inTrash(organizationId, async (tx) => (await tx.select({ id: eventTasks.id }).from(eventTasks).where(and(eq(eventTasks.id, taskId), isNotNull(eventTasks.deletedAt)))).length > 0);
}

// Un objet précis est-il à la corbeille (restauration, suppression définitive) ?
export async function isEventObjectTrashed(organizationId: string, kind: EventTrashKind, id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  if (kind === "task") return isTaskTrashed(organizationId, id);
  const table = kind === "event" ? events : kind === "document" ? eventDocuments : kind === "taskTemplate" ? taskTemplates : programTemplates;
  return inTrash(organizationId, async (tx) => (await tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), isNotNull(table.deletedAt)))).length > 0);
}

// —— Purger ——————————————————————————————————————————————————————————————————————————

// Éléments d'une fiche marqués avant la date donnée (« Annuler » passé) : lignes, puis fichiers des
// pièces jointes des tâches.
export async function purgeEventElements(organizationId: string, before: Date): Promise<number> {
  return includingDeleted(async () => {
    // Lot 70a (A5 ; ADR 0116) : les tâches ne sont plus des éléments purgés dix minutes après ; elles
    // restent trente jours à la corbeille (purgeTrashedEventObjects).
    const result = await inTrash(organizationId, async (tx) => {
      const comments = await tx.delete(eventTaskComments).where(and(isNotNull(eventTaskComments.deletedAt), lt(eventTaskComments.deletedAt, before))).returning({ id: eventTaskComments.id });
      const items = await tx.delete(programItems).where(and(isNotNull(programItems.deletedAt), lt(programItems.deletedAt, before))).returning({ id: programItems.id });
      const places = await tx.delete(eventPlaces).where(and(isNotNull(eventPlaces.deletedAt), lt(eventPlaces.deletedAt, before))).returning({ id: eventPlaces.id });
      // Lot 49 (D2) : temps forts supprimés de la fiche.
      const moments = await tx.delete(keyMoments).where(and(isNotNull(keyMoments.deletedAt), lt(keyMoments.deletedAt, before))).returning({ id: keyMoments.id });
      return { count: comments.length + items.length + places.length + moments.length, keys: [] as string[] };
    });
    await deleteFiles(result.keys);
    return result.count;
  });
}

// Évènements de la corbeille marqués avant la date donnée (les autres modules purgent leurs lignes
// de ces évènements avant purgeTrashedEvents, lib/trash.ts).
export async function listTrashedEventIdsBefore(organizationId: string, before: Date): Promise<string[]> {
  return inTrash(organizationId, async (tx) =>
    (await tx.select({ id: events.id }).from(events).where(and(isNotNull(events.deletedAt), lt(events.deletedAt, before)))).map((row) => row.id),
  );
}

// Purge réelle d'évènements à la corbeille : fichiers relevés d'abord (documents, versions, pièces
// jointes, devis de prestataires consultés), puis lignes, puis fichiers.
export async function purgeTrashedEvents(organizationId: string, eventIds: string[]): Promise<void> {
  const ids = eventIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return;
  await includingDeleted(async () => {
    const trashed = await inTrash(organizationId, async (tx) =>
      (await tx.select({ id: events.id }).from(events).where(and(inArray(events.id, ids), isNotNull(events.deletedAt)))).map((row) => row.id),
    );
    if (trashed.length === 0) return;
    // Lot 51 (DPO-9) : les photos du jour J partent avec les documents de l'évènement.
    const keys = [...(await candidateQuoteKeys(organizationId, trashed)), ...(await documentKeys(organizationId, trashed)), ...(await inTrash(organizationId, async (tx) => (await tx.select({ key: dayPhotos.storageKey }).from(dayPhotos).where(inArray(dayPhotos.eventId, trashed))).flatMap((row) => (row.key ? [row.key] : []))))];
    await purgeEventRows(organizationId, trashed);
    await deleteFiles(keys);
  });
}

type ObjectFilter = { before: Date } | { kind: Exclude<EventTrashKind, "event">; id: string };

// Lot 70a (A5) : les tâches marquées avant la date (tâche horaire), ou celles du même geste qu'une tâche
// (suppression définitive) ; leurs pièces jointes partent avec elles, fichiers compris.
async function purgeTrashedTasks(organizationId: string, filter: ObjectFilter): Promise<number> {
  if (!("before" in filter) && (filter.kind !== "task" || !UUID.test(filter.id))) return 0;
  const result = await inTrash(organizationId, async (tx) => {
    const condition =
      "before" in filter
        ? and(isNotNull(eventTasks.deletedAt), lt(eventTasks.deletedAt, filter.before))
        : and(
            isNotNull(eventTasks.deletedAt),
            sql`exists (select 1 from ${eventTasks} as anchor where anchor.id = ${filter.id} and anchor.deleted_at = ${eventTasks.deletedAt} and anchor.deleted_by is not distinct from ${eventTasks.deletedBy})`,
          );
    const taskIds = (await tx.select({ id: eventTasks.id }).from(eventTasks).where(condition)).map((row) => row.id);
    if (taskIds.length === 0) return { count: 0, keys: [] as string[] };
    const attachments = await tx.select({ key: eventTaskAttachments.fileKey }).from(eventTaskAttachments).where(inArray(eventTaskAttachments.taskId, taskIds));
    await tx.delete(eventTasks).where(inArray(eventTasks.id, taskIds));
    return { count: taskIds.length, keys: attachments.map((row) => row.key) };
  });
  await deleteFiles(result.keys);
  return result.count;
}

function objectCondition(table: typeof eventDocuments | typeof taskTemplates | typeof programTemplates, kind: EventTrashKind, filter: ObjectFilter) {
  if ("before" in filter) return and(isNotNull(table.deletedAt), lt(table.deletedAt, filter.before));
  if (filter.kind !== kind || !UUID.test(filter.id)) return undefined;
  return and(isNotNull(table.deletedAt), eq(table.id, filter.id));
}

// Documents et modèles de la corbeille : ceux marqués avant la date donnée (tâche horaire), ou un
// seul (suppression définitive par la titulaire).
export async function purgeTrashedEventObjects(organizationId: string, filter: ObjectFilter): Promise<number> {
  return includingDeleted(async () => {
    let count = await purgeTrashedTasks(organizationId, filter);
    const documentCondition = objectCondition(eventDocuments, "document", filter);
    if (documentCondition) {
      const ids = await inTrash(organizationId, async (tx) => (await tx.select({ id: eventDocuments.id }).from(eventDocuments).where(documentCondition)).map((row) => row.id));
      if (ids.length > 0) {
        await purgeDocuments(organizationId, ids);
        count += ids.length;
      }
    }
    const taskCondition = objectCondition(taskTemplates, "taskTemplate", filter);
    const programCondition = objectCondition(programTemplates, "programTemplate", filter);
    count += await inTrash(organizationId, async (tx) => {
      let removed = 0;
      if (taskCondition) {
        const ids = (await tx.select({ id: taskTemplates.id }).from(taskTemplates).where(taskCondition)).map((row) => row.id);
        if (ids.length > 0) {
          await tx.delete(taskTemplateItems).where(inArray(taskTemplateItems.templateId, ids));
          removed += (await tx.delete(taskTemplates).where(inArray(taskTemplates.id, ids)).returning({ id: taskTemplates.id })).length;
        }
      }
      if (programCondition) removed += (await tx.delete(programTemplates).where(programCondition).returning({ id: programTemplates.id })).length;
      return removed;
    });
    return count;
  });
}
