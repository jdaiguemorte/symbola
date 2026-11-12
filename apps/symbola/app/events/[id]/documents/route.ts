// Lot 29b (JRJ-04, décision D8) — envoi d'un document de l'événement (plan de table,
// plans, plan B). Par une route dédiée plutôt qu'une action serveur (L16-SEC-02,
// ADR 0044) : origine, session de la planner, limite de débit et taille vérifiées
// avant la lecture du fichier (lib/uploads/receive.ts) ; type par le contenu et
// antivirus par le module (packages/files).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { attachEventDocument, EventDocumentRejectedError, EventNotFoundError, EVENT_DOCUMENT_LABEL_MAX } from "@/modules/events/service";
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
    await attachEventDocument({ organizationId: user.organizationId, eventId, label, content: new Uint8Array(await file.arrayBuffer()), uploadedByUserId: user.id });
  } catch (error) {
    if (error instanceof EventDocumentRejectedError) {
      return uploadResponse({ error: t(error.reason === "too_large" ? "fileTooLarge" : error.reason === "infected" ? "fileInfected" : error.reason === "label" ? "labelInvalid" : "fileUnsupported") });
    }
    if (error instanceof EventNotFoundError) return uploadResponse({ error: t("notFound") });
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  return uploadResponse({ success: true });
}
