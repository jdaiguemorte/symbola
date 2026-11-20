// Lot 55 (MSG-03 ; D3 ; ADR 0102) — zone « Message partagé » : part aux destinataires nommés sur le
// bouton (empreinte comparée par le service ; refus s'ils ont changé). Route dédiée pour les pièces
// jointes (L16-SEC-02) : origine, session de l'équipe, débit et taille avant la lecture du fichier.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { canSeeEvent } from "@/lib/event-visibility";
import { messageErrorResponse, messageFilesOf } from "@/lib/messages/receive";
import { EventArchivedError, postSharedMessage } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; topicId: string }> }): Promise<Response> {
  const received = await receiveUpload(request);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("MessageThread");
  const { id: eventId, topicId } = await params;
  if (!isValidId(eventId) || !isValidId(topicId) || !(await isEventsModuleEnabled(user.organizationId)) || !(await canSeeEvent({ user }, eventId))) return uploadResponse({ error: t("errors.notFound") });
  const files = await messageFilesOf(formData);
  if (!files) return uploadResponse({ error: t("errors.files") });
  try {
    const { notified } = await postSharedMessage({ organizationId: user.organizationId, eventId, topicId, userId: user.id, body: String(formData.get("body") ?? ""), files, recipientsDigest: String(formData.get("recipientsDigest") ?? "") });
    revalidatePath(`/events/${eventId}/messages/${topicId}`);
    return uploadResponse({ success: true, ...(notified === 0 ? { error: t("notNotified") } : {}) });
  } catch (error) {
    if (error instanceof EventArchivedError) return uploadResponse({ error: t("errors.archived") });
    const refused = await messageErrorResponse(error);
    if (refused) return refused;
    throw error;
  }
}
