// Lot 55 (MSG-03, POR-06 ; ADR 0101) — lecture d'un message envoyé avec ses pièces jointes (route
// dédiée, lib/uploads/receive.ts) et traduction des refus en messages de l'écran.
import { getTranslations } from "next-intl/server";
import { MESSAGE_ATTACHMENTS_MAX, type MessageFileInput } from "@symbola/contracts";
import { EventDocumentRejectedError, MessageInputError, MessageNotFoundError } from "@/modules/events/service";
import { uploadResponse } from "@/lib/uploads/receive";

export async function messageFilesOf(formData: FormData): Promise<MessageFileInput[] | null> {
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MESSAGE_ATTACHMENTS_MAX) return null;
  return Promise.all(files.map(async (file) => ({ label: file.name.replace(/\.[^.]+$/, "").slice(0, 200) || file.name.slice(0, 200), content: new Uint8Array(await file.arrayBuffer()) })));
}

// Le refus d'un message, dit à la personne ; null : une autre erreur, qui remonte.
export async function messageErrorResponse(error: unknown): Promise<Response | null> {
  const t = await getTranslations("MessageThread");
  if (error instanceof MessageInputError) return uploadResponse({ error: t(`errors.${error.reason}`) });
  if (error instanceof MessageNotFoundError) return uploadResponse({ error: t("errors.notFound") });
  if (error instanceof EventDocumentRejectedError) {
    const tDocuments = await getTranslations("EventDocuments");
    return uploadResponse({ error: tDocuments(error.reason === "too_large" ? "fileTooLarge" : error.reason === "infected" ? "fileInfected" : error.reason === "label" ? "labelInvalid" : "fileUnsupported") });
  }
  return null;
}
