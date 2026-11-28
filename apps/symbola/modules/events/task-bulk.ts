// Lot 63d (CHR-02, UX-07 ; recette du 21/11/2026, maquette M6) — actions groupées sur les tâches choisies
// dans un tableau (écran « Tâches », rétroplanning d'un évènement) : décaler de N jours, changer le
// responsable, la catégorie ou la priorité, supprimer. Seules les tâches visibles de l'organisation
// changent (la base cache les autres) ; une tâche déplacée est fixée, comme à la main (DAT-07).
// La suppression groupée va à la corbeille d'un seul geste : « Annuler » les rend toutes. Exposé
// seulement par service.ts (ADR 0011).
import { and, eq, gt, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { inTrash, markDeleted, UNMARKED } from "@symbola/db/soft-delete";
import { events, eventTasks, taskChangeSnapshots, type TaskChangeSnapshotPayload } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { BulkTaskChange } from "@symbola/contracts";
import { isVisibleCategory, TaskCategoryNotFoundError } from "./task-categories";
import { assertAssignable, emitTaskAssignments, stillAssignable } from "./task-assignment";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Un tableau des tâches tient quelques centaines de lignes ; au-delà, la demande n'est pas un geste.
export const BULK_TASKS_MAX = 500;
// Décaler de plus d'un an n'est plus un report.
export const BULK_SHIFT_MAX_DAYS = 366;

export class BulkTaskChangeInvalidError extends Error {
  constructor() {
    super("action groupée refusée");
    this.name = "BulkTaskChangeInvalidError";
  }
}

function validIds(taskIds: string[]): string[] {
  const ids = [...new Set(taskIds)].filter((id) => UUID.test(id));
  if (ids.length > BULK_TASKS_MAX) throw new BulkTaskChangeInvalidError();
  return ids;
}

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function assertChange(change: BulkTaskChange): void {
  if (change.kind === "shift" && (!Number.isInteger(change.days) || change.days === 0 || Math.abs(change.days) > BULK_SHIFT_MAX_DAYS)) throw new BulkTaskChangeInvalidError();
  if (change.kind === "setDate" && (!DAY.test(change.date) || Number.isNaN(Date.parse(`${change.date}T00:00:00Z`)))) throw new BulkTaskChangeInvalidError();
  if (change.kind === "assign" && !UUID.test(change.userId)) throw new BulkTaskChangeInvalidError();
}

// Le changement dans la transaction de l'appelant. « assign » : le membre est vérifié ici, dans la même
// transaction (membre actif de l'organisation) ; actorId : le membre qui agit (A19).
async function applyChange(tx: Tx, organizationId: string, ids: string[], change: BulkTaskChange, actorId: string | null): Promise<number> {
  const now = new Date();
  const selected = inArray(eventTasks.id, ids);
  let rows: { id: string }[];
  switch (change.kind) {
    case "shift":
      rows = await tx
        .update(eventTasks)
        // Lot 74b (B7) : redatée à la main, une tâche « à dater » redevient ordinaire.
        .set({ dueDate: sql`${eventTasks.dueDate} + ${change.days}::integer`, fixedAt: sql`coalesce(${eventTasks.fixedAt}, now())`, dueDateKnown: true, updatedAt: now })
        .where(selected)
        .returning({ id: eventTasks.id });
      break;
    // Lot 70a (§ 3.3) : « Toutes au <date> » ; déplacée à la main, la tâche est fixée (DAT-07).
    case "setDate":
      rows = await tx
        .update(eventTasks)
        .set({ dueDate: change.date, fixedAt: sql`coalesce(${eventTasks.fixedAt}, now())`, dueDateKnown: true, updatedAt: now })
        .where(selected)
        .returning({ id: eventTasks.id });
      break;
    case "responsible":
      // Une tâche hors évènement reste à la planner (contrainte event_tasks_standalone_check). Lot 70a : vers
      // les clients, la personne s'efface ; reprise à l'agence, la tâche revient à qui agit si elle n'avait
      // personne (A3).
      rows = await tx
        .update(eventTasks)
        .set({
          responsible: change.responsible,
          vendorCandidateId: null,
          assigneeUserId: change.responsible === "planner" ? sql`case when ${eventTasks.responsible} = 'planner' then ${eventTasks.assigneeUserId} else ${actorId}::uuid end` : null,
          updatedAt: now,
        })
        .where(change.responsible === "planner" ? selected : and(selected, isNotNull(eventTasks.eventId)))
        .returning({ id: eventTasks.id });
      break;
    case "category":
      if (change.categoryId !== null && !(UUID.test(change.categoryId) && (await isVisibleCategory(tx, change.categoryId)))) throw new TaskCategoryNotFoundError();
      rows = await tx.update(eventTasks).set({ categoryId: change.categoryId, updatedAt: now }).where(selected).returning({ id: eventTasks.id });
      break;
    case "priority":
      rows = await tx.update(eventTasks).set({ priority: change.priority, updatedAt: now }).where(selected).returning({ id: eventTasks.id });
      break;
    // Lot 70a (CHR-04) : « Fait » sur une sélection ; l'auteur de la coche est posé par la base (0212).
    case "done":
      rows = await tx.update(eventTasks).set({ doneAt: now, updatedAt: now }).where(and(selected, isNull(eventTasks.doneAt))).returning({ id: eventTasks.id });
      break;
    // Lot 70a (CHR-02 ; A19) : « Confier à un membre » ; une notification par destinataire pour le lot.
    case "assign": {
      await assertAssignable(tx, organizationId, change.userId);
      const before = await tx
        .select({ id: eventTasks.id, eventId: eventTasks.eventId, assigneeUserId: eventTasks.assigneeUserId, doneAt: eventTasks.doneAt, isDemo: events.isDemo })
        .from(eventTasks)
        .leftJoin(events, eq(events.id, eventTasks.eventId))
        .where(selected);
      rows = await tx
        .update(eventTasks)
        .set({ responsible: "planner", vendorCandidateId: null, assigneeUserId: change.userId, updatedAt: now })
        .where(selected)
        .returning({ id: eventTasks.id });
      const changed = new Set(rows.map((row) => row.id));
      await emitTaskAssignments(
        tx,
        before
          .filter((row) => changed.has(row.id))
          .map((row) => ({ organizationId, taskId: row.id, eventId: row.eventId, before: row.assigneeUserId, after: change.userId, done: row.doneAt !== null, isDemo: row.isDemo ?? false, actorId })),
      );
      break;
    }
  }
  return rows.length;
}

export async function changeTasks(organizationId: string, taskIds: string[], change: BulkTaskChange, actorId: string | null = null): Promise<number> {
  const ids = validIds(taskIds);
  if (ids.length === 0) return 0;
  assertChange(change);
  return withOrganization(appDatabase(), organizationId, (tx) => applyChange(tx, organizationId, ids, change, actorId));
}

// —— Lot 70a (UX-07 ; C-09, A18) : « Annuler » un changement de date ou de personne ——————————————————————

export const TASK_UNDO_MINUTES = 10;
export type UndoableTaskChange = Extract<BulkTaskChange, { kind: "shift" | "setDate" | "assign" | "responsible" }>;

// Garde les valeurs d'avant (date, état « fixée », responsable, prestataire, personne) puis change, dans la
// même transaction ; l'identifiant rendu sert à « Annuler » pendant dix minutes au plus, par la même
// personne, dans la même organisation.
export async function changeTasksKeepingUndo(input: { organizationId: string; userId: string; taskIds: string[]; change: UndoableTaskChange; actorId: string | null; now?: Date }): Promise<{ changed: number; undoId: string | null }> {
  const ids = validIds(input.taskIds);
  if (ids.length === 0) return { changed: 0, undoId: null };
  assertChange(input.change);
  const now = input.now ?? new Date();
  return withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const before = await tx
      .select({ id: eventTasks.id, dueDate: eventTasks.dueDate, fixedAt: eventTasks.fixedAt, dueDateKnown: eventTasks.dueDateKnown, responsible: eventTasks.responsible, vendorCandidateId: eventTasks.vendorCandidateId, assigneeUserId: eventTasks.assigneeUserId })
      .from(eventTasks)
      .where(inArray(eventTasks.id, ids));
    if (before.length === 0) return { changed: 0, undoId: null };
    const payload: TaskChangeSnapshotPayload = {
      kind: input.change.kind === "assign" || input.change.kind === "responsible" ? "assignee" : "date",
      tasks: before.map((row) => ({ ...row, fixedAt: row.fixedAt?.toISOString() ?? null })),
    };
    const [snapshot] = await tx
      .insert(taskChangeSnapshots)
      .values({ organizationId: input.organizationId, userId: input.userId, payload, expiresAt: new Date(now.getTime() + TASK_UNDO_MINUTES * 60 * 1000), createdAt: now })
      .returning({ id: taskChangeSnapshots.id });
    const changed = await applyChange(tx, input.organizationId, ids, input.change, input.actorId);
    return { changed, undoId: snapshot!.id };
  });
}

// Rend les valeurs d'avant, une seule fois ; ni d'une autre personne, ni d'une autre organisation, ni
// passé le délai. Renvoie le nombre de tâches rendues. Revue du 70a : seuls les champs que le geste a
// changés reviennent (la date et l'état « fixée », ou le responsable et la personne) : annuler un report
// ne défait pas la personne choisie entre-temps. Une personne qui n'est plus active ne revient pas (A4).
export async function undoTasksChange(input: { organizationId: string; userId: string; undoId: string; now?: Date }): Promise<number> {
  if (!UUID.test(input.undoId) || !UUID.test(input.userId)) return 0;
  const now = input.now ?? new Date();
  return withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const [snapshot] = await tx
      .delete(taskChangeSnapshots)
      .where(and(eq(taskChangeSnapshots.id, input.undoId), eq(taskChangeSnapshots.userId, input.userId), gt(taskChangeSnapshots.expiresAt, now), sql`${taskChangeSnapshots.payload} ->> 'kind' <> 'vendor_addition'`))
      .returning();
    // Lot 73a : la même table garde l'état d'avant d'un ajout à un mariage, qui ne s'annule pas ici.
    if (!snapshot || snapshot.payload.kind === "vendor_addition") return 0;
    const payload = snapshot.payload;
    let restored = 0;
    for (const task of payload.tasks) {
      const values =
        payload.kind === "date"
          ? { dueDate: task.dueDate, fixedAt: task.fixedAt ? new Date(task.fixedAt) : null, dueDateKnown: task.dueDateKnown !== false }
          : { responsible: task.responsible, vendorCandidateId: task.vendorCandidateId, assigneeUserId: task.responsible === "planner" ? await stillAssignable(tx, input.organizationId, task.assigneeUserId) : null };
      const rows = await tx
        .update(eventTasks)
        .set({ ...values, updatedAt: now })
        .where(eq(eventTasks.id, task.id))
        .returning({ id: eventTasks.id });
      restored += rows.length;
    }
    return restored;
  });
}

// Tâche horaire : les valeurs d'avant de plus de dix minutes.
export async function purgeTaskChangeSnapshots(organizationId: string, now: Date = new Date()): Promise<number> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.delete(taskChangeSnapshots).where(lt(taskChangeSnapshots.expiresAt, now)).returning({ id: taskChangeSnapshots.id }));
  return rows.length;
}

// Toutes à la corbeille dans la même transaction : même date et même auteur de suppression.
export async function removeTasks(organizationId: string, taskIds: string[]): Promise<number> {
  const ids = validIds(taskIds);
  if (ids.length === 0) return 0;
  const rows = await inTrash(organizationId, (tx) =>
    tx.update(eventTasks).set(markDeleted()).where(and(inArray(eventTasks.id, ids), isNull(eventTasks.deletedAt))).returning({ id: eventTasks.id }),
  );
  return rows.length;
}

// « Annuler » d'une suppression groupée : les tâches supprimées du même geste que celle-ci (même date,
// même auteur), dans l'organisation. Renvoie le nombre de tâches rendues.
export async function restoreTasksDeletedWith(organizationId: string, taskId: string): Promise<number> {
  if (!UUID.test(taskId)) return 0;
  // Comparaison dans la base : la date de suppression y est à la microseconde, plus fine qu'une Date.
  const rows = await inTrash(organizationId, (tx) =>
    tx
      .update(eventTasks)
      .set(UNMARKED)
      .where(
        and(
          isNotNull(eventTasks.deletedAt),
          sql`exists (select 1 from ${eventTasks} as anchor where anchor.id = ${taskId} and anchor.deleted_at = ${eventTasks.deletedAt} and anchor.deleted_by is not distinct from ${eventTasks.deletedBy})`,
        ),
      )
      .returning({ id: eventTasks.id }),
  );
  return rows.length;
}
