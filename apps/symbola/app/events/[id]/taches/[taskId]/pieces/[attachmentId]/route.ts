// Lot 34b (CHR-02, D13) — ouverture d'une pièce jointe de tâche depuis la fiche : session de la
// planner, organisation (RLS) et module, puis fichier servi par l'app depuis le stockage privé
// (ADR 0027 : jamais d'URL vers le stockage). Réservée à l'équipe : aucun lien de tiers n'y mène.
// Lot 37a (DOC-01, D5) : « ?apercu=1 » l'affiche dans le navigateur (lib/file-response.ts).
import { refusedResponse } from "@/lib/access-refusals";
import { getTaskAttachmentFile, TaskAttachmentNotFoundError } from "@/modules/events/service";
import { fileResponse } from "@/lib/file-response";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; taskId: string; attachmentId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { attachmentId } = await params;
  if (!isValidId(attachmentId)) return new Response(null, { status: 404 });
  try {
    return fileResponse(await getTaskAttachmentFile(organizationId, attachmentId), request);
  } catch (error) {
    if (error instanceof TaskAttachmentNotFoundError) return refusedResponse(request);
    throw error;
  }
}
