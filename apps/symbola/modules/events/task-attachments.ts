// Lot 34b (CHR-02, D13) — pièces jointes d'une tâche, réservées à l'équipe. Mêmes contrôles que les
// documents de l'événement (lot 29b) : le fichier est contrôlé à l'envoi par @symbola/files (type
// par le contenu, taille, antivirus, stockage privé) et servi par l'app après contrôle des droits
// (ADR 0027). Exposé seulement par service.ts (ADR 0011).
import { asc, eq } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventTaskAttachments, eventTasks } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import type { AttachTaskFileInput, EventTaskAttachment, FileDownload } from "@symbola/contracts";
import { documentLabel, EVENT_DOCUMENT_MAX_SIZE_BYTES, EventDocumentRejectedError } from "./documents";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type AttachmentRow = typeof eventTaskAttachments.$inferSelect;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TaskAttachmentNotFoundError extends Error {
  constructor() {
    super("pièce jointe introuvable");
    this.name = "TaskAttachmentNotFoundError";
  }
}

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return await withOrganization(appDatabase(), organizationId, fn);
}

function toAttachment(row: AttachmentRow): EventTaskAttachment {
  return { id: row.id, taskId: row.taskId, eventId: row.eventId, label: row.label, mime: row.mime, sizeBytes: row.sizeBytes, createdAt: row.createdAt.toISOString() };
}

export async function listAttachments(organizationId: string, taskId: string): Promise<EventTaskAttachment[]> {
  if (!UUID.test(taskId)) return [];
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(eventTaskAttachments).where(eq(eventTaskAttachments.taskId, taskId)).orderBy(asc(eventTaskAttachments.createdAt)));
  return rows.map(toAttachment);
}

// Lot 37a (DOC-01, D2) : toutes les pièces des tâches d'un évènement, pour son espace documents.
export async function listEventAttachments(organizationId: string, eventId: string): Promise<EventTaskAttachment[]> {
  if (!UUID.test(eventId)) return [];
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(eventTaskAttachments).where(eq(eventTaskAttachments.eventId, eventId)).orderBy(asc(eventTaskAttachments.createdAt)));
  return rows.map(toAttachment);
}

// Le fichier est contrôlé et rangé avant la ligne : un refus n'enregistre rien. Null : la tâche
// n'est pas de l'organisation.
export async function attachFile(input: AttachTaskFileInput): Promise<EventTaskAttachment | null> {
  const label = documentLabel(input.label);
  if (!UUID.test(input.taskId)) return null;
  const task = await inOrganization(input.organizationId, async (tx) => (await tx.select({ id: eventTasks.id, eventId: eventTasks.eventId }).from(eventTasks).where(eq(eventTasks.id, input.taskId)))[0]);
  // Lot 53 (CHR-10) : une tâche hors évènement n'a pas de pièce jointe.
  if (!task?.eventId) return null;
  const eventId = task.eventId;
  const upload = await uploadFile({ organizationId: input.organizationId, buffer: Buffer.from(input.content), maxSizeBytes: EVENT_DOCUMENT_MAX_SIZE_BYTES });
  if (upload.status === "rejected") throw new EventDocumentRejectedError(upload.reason);
  try {
    const [row] = await inOrganization(input.organizationId, (tx) =>
      tx
        .insert(eventTaskAttachments)
        .values({ organizationId: input.organizationId, eventId, taskId: task.id, label, fileKey: upload.key, mime: upload.mime, sizeBytes: upload.size, uploadedByUserId: input.uploadedByUserId })
        .returning(),
    );
    return toAttachment(row!);
  } catch (error) {
    // Ligne refusée : le fichier rangé ne reste pas orphelin.
    await deletePrivateObject(createStorageClient(), upload.key).catch(() => undefined);
    throw error;
  }
}

// La ligne d'abord, le fichier ensuite (supprimer un fichier absent ne fait rien).
export async function removeAttachment(organizationId: string, attachmentId: string): Promise<void> {
  if (!UUID.test(attachmentId)) throw new TaskAttachmentNotFoundError();
  const fileKey = await inOrganization(organizationId, async (tx) => (await tx.delete(eventTaskAttachments).where(eq(eventTaskAttachments.id, attachmentId)).returning())[0]?.fileKey ?? null);
  if (!fileKey) throw new TaskAttachmentNotFoundError();
  await deletePrivateObject(createStorageClient(), fileKey).catch(() => undefined);
}

export async function getAttachmentFile(organizationId: string, attachmentId: string): Promise<FileDownload> {
  if (!UUID.test(attachmentId)) throw new TaskAttachmentNotFoundError();
  const row = await inOrganization(organizationId, async (tx) => (await tx.select().from(eventTaskAttachments).where(eq(eventTaskAttachments.id, attachmentId)))[0]);
  if (!row) throw new TaskAttachmentNotFoundError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), row.fileKey);
    const extension = row.fileKey.split(".").pop() ?? "bin";
    const safeName = row.label.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80) || "piece-jointe";
    return { data, contentType: row.mime, fileName: `${safeName}.${extension}` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new TaskAttachmentNotFoundError();
    throw error;
  }
}
