// Lot 63d (CHR-02, UX-07 ; recette du 21/11/2026, maquette M6) — actions groupées sur les tâches choisies
// dans un tableau (écran « Tâches », rétroplanning d'un évènement) : décaler de N jours, changer le
// responsable, la catégorie ou la priorité, supprimer. Seules les tâches visibles de l'organisation
// changent (la base cache les autres) ; une tâche déplacée est fixée, comme à la main (DAT-07).
// La suppression groupée va à la corbeille d'un seul geste : « Annuler » les rend toutes. Exposé
// seulement par service.ts (ADR 0011).
import { and, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { inTrash, markDeleted, UNMARKED } from "@symbola/db/soft-delete";
import { eventTasks } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { BulkTaskChange } from "@symbola/contracts";
import { isVisibleCategory, TaskCategoryNotFoundError } from "./task-categories";

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

export async function changeTasks(organizationId: string, taskIds: string[], change: BulkTaskChange): Promise<number> {
  const ids = validIds(taskIds);
  if (ids.length === 0) return 0;
  if (change.kind === "shift" && (!Number.isInteger(change.days) || change.days === 0 || Math.abs(change.days) > BULK_SHIFT_MAX_DAYS)) throw new BulkTaskChangeInvalidError();
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const now = new Date();
    const selected = inArray(eventTasks.id, ids);
    let rows: { id: string }[];
    switch (change.kind) {
      case "shift":
        rows = await tx
          .update(eventTasks)
          .set({ dueDate: sql`${eventTasks.dueDate} + ${change.days}::integer`, fixedAt: sql`coalesce(${eventTasks.fixedAt}, now())`, updatedAt: now })
          .where(selected)
          .returning({ id: eventTasks.id });
        break;
      case "responsible":
        // Une tâche hors évènement reste à la planner (contrainte event_tasks_standalone_check).
        rows = await tx
          .update(eventTasks)
          .set({ responsible: change.responsible, vendorCandidateId: null, updatedAt: now })
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
    }
    return rows.length;
  });
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
