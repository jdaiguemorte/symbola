// Lot 37a (POR-04, POR-10, DOC-01 ; D5, D6 ; ADR 0070) — un document partagé avec les clients,
// ouvert depuis le portail : session du lien client, puis le service relit le lien et ne sert que
// les documents de son évènement partagés avec les clients (un document non partagé répond comme
// un document absent). « ?apercu=1 » l'affiche dans le navigateur.
import { currentLinkAccess } from "@/lib/link-session";
import { fileResponse } from "@/lib/file-response";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { EventDocumentNotFoundError, getLinkSharedDocumentFile, LinkAccessDeniedError } from "@/modules/events/service";

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }): Promise<Response> {
  const access = await currentLinkAccess();
  const { documentId } = await params;
  if (!access || access.audience !== "client" || !isValidId(documentId) || !(await isEventsModuleEnabled(access.organizationId))) return new Response(null, { status: 404 });
  try {
    const response = fileResponse(await getLinkSharedDocumentFile(access.organizationId, access.linkId, documentId), request);
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (error instanceof EventDocumentNotFoundError || error instanceof LinkAccessDeniedError) return new Response(null, { status: 404 });
    throw error;
  }
}
