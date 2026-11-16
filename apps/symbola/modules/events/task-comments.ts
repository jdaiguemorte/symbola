// Lot 34b (CHR-02, D13) — fil de commentaires d'une tâche (auteur, date, texte), lu et écrit par
// l'équipe. Exposé seulement par service.ts (ADR 0011).
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { inTrash, markDeleted, UNMARKED } from "@symbola/db/soft-delete";
import { appDatabase } from "@symbola/db/client";
import { eventTaskComments, eventTasks } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { EventTaskComment } from "@symbola/contracts";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type CommentRow = typeof eventTaskComments.$inferSelect;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TASK_COMMENT_MAX = 2000;

export class TaskCommentNotFoundError extends Error {
  constructor() {
    super("commentaire introuvable");
    this.name = "TaskCommentNotFoundError";
  }
}

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return await withOrganization(appDatabase(), organizationId, fn);
}

function toComment(row: CommentRow): EventTaskComment {
  return { id: row.id, taskId: row.taskId, authorUserId: row.authorUserId, body: row.body, createdAt: row.createdAt.toISOString() };
}

// Texte de 1 à 2 000 caractères, retours à la ligne gardés.
export function commentBody(raw: string): string {
  const body = raw.replace(/\r\n/g, "\n").trim();
  if (body.length === 0 || body.length > TASK_COMMENT_MAX) throw new RangeError("commentaire vide ou trop long");
  return body;
}

export async function listComments(organizationId: string, taskId: string): Promise<EventTaskComment[]> {
  if (!UUID.test(taskId)) return [];
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(eventTaskComments).where(eq(eventTaskComments.taskId, taskId)).orderBy(asc(eventTaskComments.createdAt)));
  return rows.map(toComment);
}

// Null : la tâche n'est pas de l'organisation.
export async function addComment(input: { organizationId: string; taskId: string; authorUserId: string; body: string }): Promise<EventTaskComment | null> {
  const body = commentBody(input.body);
  if (!UUID.test(input.taskId)) return null;
  return inOrganization(input.organizationId, async (tx) => {
    const [task] = await tx.select({ id: eventTasks.id, eventId: eventTasks.eventId }).from(eventTasks).where(eq(eventTasks.id, input.taskId));
    if (!task) return null;
    const [row] = await tx.insert(eventTaskComments).values({ organizationId: input.organizationId, eventId: task.eventId, taskId: task.id, authorUserId: input.authorUserId, body }).returning();
    return toComment(row!);
  });
}

// Seul l'auteur retire son commentaire.
export async function removeComment(input: { organizationId: string; commentId: string; authorUserId: string }): Promise<void> {
  if (!UUID.test(input.commentId)) throw new TaskCommentNotFoundError();
  // Lot 39a (UX-07 ; ADR 0073) : marqué, « Annuler » le démarque ; la purge l'efface.
  const rows = await inTrash(input.organizationId, (tx) =>
    tx
      .update(eventTaskComments)
      .set(markDeleted())
      .where(and(eq(eventTaskComments.id, input.commentId), eq(eventTaskComments.authorUserId, input.authorUserId), isNull(eventTaskComments.deletedAt)))
      .returning({ id: eventTaskComments.id }),
  );
  if (rows.length === 0) throw new TaskCommentNotFoundError();
}

// Seul son auteur rétablit le commentaire qu'il vient de retirer.
export async function restoreComment(input: { organizationId: string; commentId: string; authorUserId: string }): Promise<boolean> {
  const rows = await inTrash(input.organizationId, (tx) =>
    tx
      .update(eventTaskComments)
      .set(UNMARKED)
      .where(and(eq(eventTaskComments.id, input.commentId), eq(eventTaskComments.authorUserId, input.authorUserId), isNotNull(eventTaskComments.deletedAt)))
      .returning({ id: eventTaskComments.id }),
  );
  return rows.length > 0;
}
