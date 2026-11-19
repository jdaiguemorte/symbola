// Lot 55 (MSG-03 ; ADR 0027, ADR 0101) — pièce jointe d'un message, ouverte par l'équipe : session de
// la planner, organisation (RLS), module et évènement visible, puis fichier servi par l'app depuis le
// stockage privé. « ?apercu=1 » l'affiche dans le navigateur.
import { refusedResponse } from "@/lib/access-refusals";
import { fileResponse } from "@/lib/file-response";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { canSeeEvent } from "@/lib/event-visibility";
import { getMessageAttachmentFile, MessageNotFoundError } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  const { id: eventId, attachmentId } = await params;
  if (!isValidId(eventId) || !isValidId(attachmentId) || !(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  if (!(await canSeeEvent({ user: { id: auth.user.id, role: auth.user.role, organizationId } }, eventId))) return refusedResponse(request);
  try {
    return fileResponse(await getMessageAttachmentFile(organizationId, attachmentId, eventId), request);
  } catch (error) {
    if (error instanceof MessageNotFoundError) return refusedResponse(request);
    throw error;
  }
}
