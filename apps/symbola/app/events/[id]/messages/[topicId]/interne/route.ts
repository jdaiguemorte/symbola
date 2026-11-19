// Lot 55 (MSG-03 ; D3 ; ADR 0101) — zone « Note interne » : l'équipe seulement. Cette route n'appelle
// que postInternalNote, qui ne prévient personne au-dehors ; aucun champ ne choisit la visibilité (un
// champ « visibility » glissé dans la requête est ignoré).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { canSeeEvent } from "@/lib/event-visibility";
import { messageErrorResponse, messageFilesOf } from "@/lib/messages/receive";
import { EventArchivedError, postInternalNote } from "@/modules/events/service";
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
    await postInternalNote({ organizationId: user.organizationId, eventId, topicId, userId: user.id, body: String(formData.get("body") ?? ""), files });
    revalidatePath(`/events/${eventId}/messages/${topicId}`);
    return uploadResponse({ success: true });
  } catch (error) {
    if (error instanceof EventArchivedError) return uploadResponse({ error: t("errors.archived") });
    const refused = await messageErrorResponse(error);
    if (refused) return refused;
    throw error;
  }
}
