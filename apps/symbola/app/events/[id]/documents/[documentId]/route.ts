// Lot 29b (JRJ-04, décision D8) — ouverture d'un document de l'événement depuis la
// fiche : session de la planner, organisation (RLS) et module, puis fichier servi
// par l'app depuis le stockage privé (ADR 0027 : jamais d'URL vers le stockage).
import { refusedResponse } from "@/lib/access-refusals";
import { EventDocumentNotFoundError, getEventDocumentFile } from "@/modules/events/service";
import { fileDownloadResponse } from "@/lib/file-response";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../../../module-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { documentId } = await params;
  if (!isValidId(documentId)) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await getEventDocumentFile(organizationId, documentId));
  } catch (error) {
    if (error instanceof EventDocumentNotFoundError) return refusedResponse(request);
    throw error;
  }
}
