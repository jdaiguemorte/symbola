"use server";

// Lot 34b (CHR-02, D13) — commentaires et pièces jointes d'une tâche, réservés à l'équipe :
// commenter, retirer son commentaire, retirer une pièce jointe. L'envoi d'une pièce jointe passe
// par la route dédiée taches/[taskId]/pieces/route.ts. Contrôles côté serveur : session de
// l'équipe, organisation, module Évènements ; la RLS borne la tâche à l'organisation.
import { offerUndo } from "@/lib/undo";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { addTaskComment, EventTaskNotFoundError, removeTaskAttachment, removeTaskComment, TaskAttachmentNotFoundError, TaskCommentNotFoundError } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type TaskCommentFormState = { error?: string; success?: boolean };

async function team(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

export async function addTaskCommentAction(_previous: TaskCommentFormState, formData: FormData): Promise<TaskCommentFormState> {
  const t = await getTranslations("Events");
  const access = await team();
  if (!access) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(eventId) || !isValidId(taskId)) return { error: t("taskNotFound") };
  try {
    await addTaskComment({ organizationId: access.organizationId, taskId, authorUserId: access.userId, body: String(formData.get("body") ?? "") });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("taskCommentInvalid") };
    if (error instanceof EventTaskNotFoundError) return { error: t("taskNotFound") };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function removeTaskCommentAction(formData: FormData): Promise<void> {
  const access = await team();
  const eventId = String(formData.get("eventId") ?? "");
  const commentId = String(formData.get("commentId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(commentId)) return;
  try {
    await removeTaskComment({ organizationId: access.organizationId, commentId, authorUserId: access.userId });
    await offerUndo({ kind: "taskComment", id: commentId });
  } catch (error) {
    if (!(error instanceof TaskCommentNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}

export async function removeTaskAttachmentAction(formData: FormData): Promise<void> {
  const access = await team();
  const eventId = String(formData.get("eventId") ?? "");
  const attachmentId = String(formData.get("attachmentId") ?? "");
  if (!access || !isValidId(eventId) || !isValidId(attachmentId)) return;
  try {
    await removeTaskAttachment(access.organizationId, attachmentId);
  } catch (error) {
    if (!(error instanceof TaskAttachmentNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}
