// Lot 29b (JRJ-04, décision D8) — envoi d'un document de l'événement (plan de table,
// plans, plan B). Par une route dédiée plutôt qu'une action serveur (L16-SEC-02,
// ADR 0044) : origine, session de la planner, limite de débit et taille vérifiées
// avant la lecture du fichier (lib/uploads/receive.ts) ; type par le contenu et
// antivirus par le module (packages/files).
import { isStorageFullError, storageFullMessage } from "@/lib/storage-full";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { EventDocumentRejectedError, EventNotFoundError, EVENT_DOCUMENT_LABEL_MAX } from "@/modules/events/service";
import { BudgetLineNotFoundError, QuoteFileInfectedError, QuoteFileTooLargeError, QuoteFileUnsupportedTypeError } from "@/modules/budget/service";
import { depositKindOf, depositTypedDocument } from "@/lib/documents/typed-deposit";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { isEventsModuleEnabled, isValidId } from "../../module-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const received = await receiveUpload(request);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("EventDocuments");
  if (!(await isEventsModuleEnabled(user.organizationId))) return uploadResponse({ error: t("unauthorized") });
  const { id: eventId } = await params;
  if (!isValidId(eventId)) return uploadResponse({ error: t("notFound") });
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("fileMissing") });
  // Sans intitulé, le nom du fichier sans son extension.
  const label = String(formData.get("label") ?? "").trim() || file.name.replace(/\.[^.]+$/, "").slice(0, EVENT_DOCUMENT_LABEL_MAX);
  try {
    // Lot 37a (D3) : le dossier choisi, sinon « Divers » ; un dossier d'un autre évènement est refusé.
    const folder = String(formData.get("folderId") ?? "");
    const folderId = isValidId(folder) ? folder : null;
    // Lot 63c (DOC-01, BUD-04 ; M8) : le type dit où va la pièce ; une pièce d'un prestataire se
    // rattache à sa ligne du budget.
    const candidate = String(formData.get("candidateId") ?? "");
    const result = await depositTypedDocument({
      organizationId: user.organizationId,
      userId: user.id,
      eventId,
      locale: (await getLocale()) === "en" ? "en" : "fr",
      kind: depositKindOf(String(formData.get("kind") ?? "other")),
      candidateId: isValidId(candidate) ? candidate : null,
      folderId,
      label,
      content: new Uint8Array(await file.arrayBuffer()),
    });
    revalidatePath(`/events/${eventId}`);
    if (result.destination === "budget_line") {
      revalidatePath(`/budget/${eventId}`, "layout");
      return uploadResponse({ success: true, message: t("depositedOnLine", { line: result.lineLabel }) });
    }
    return uploadResponse({ success: true });
  } catch (error) {
    if (error instanceof QuoteFileTooLargeError) return uploadResponse({ error: t("fileTooLarge") });
    if (error instanceof QuoteFileUnsupportedTypeError) return uploadResponse({ error: t("fileUnsupported") });
    if (error instanceof QuoteFileInfectedError) return uploadResponse({ error: t("fileInfected") });
    if (error instanceof BudgetLineNotFoundError) return uploadResponse({ error: t("notFound") });
    // Lot 54 (DOC-06) : quota de stockage plein, préavis passé.
    if (isStorageFullError(error)) return uploadResponse({ error: await storageFullMessage() });
    if (error instanceof EventDocumentRejectedError) {
      return uploadResponse({ error: t(error.reason === "too_large" ? "fileTooLarge" : error.reason === "infected" ? "fileInfected" : error.reason === "label" ? "labelInvalid" : error.reason === "folder" ? "folderInvalid" : "fileUnsupported") });
    }
    if (error instanceof EventNotFoundError) return uploadResponse({ error: t("notFound") });
    throw error;
  }
}
