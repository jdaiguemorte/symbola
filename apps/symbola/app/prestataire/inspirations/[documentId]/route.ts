// Lot 47 (PRE-03, PRE-04 ; D3) — une inspiration du brief, ouverte par le lien d'un prestataire en
// consultation : session du lien prestataire, puis le service relit le lien et ne sert que les
// documents choisis pour le brief de son poste (un autre répond comme un document absent).
import { currentLinkAccess } from "@/lib/link-session";
import { fileResponse } from "@/lib/file-response";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { getLinkVendorBriefDocumentFile, LinkAccessDeniedError } from "@/modules/events/service";

export async function GET(request: Request, { params }: { params: Promise<{ documentId: string }> }): Promise<Response> {
  const access = await currentLinkAccess();
  const { documentId } = await params;
  if (!access || access.audience !== "vendor" || !isValidId(documentId) || !(await isEventsModuleEnabled(access.organizationId))) return new Response(null, { status: 404 });
  try {
    const response = fileResponse(await getLinkVendorBriefDocumentFile(access.organizationId, access.linkId, documentId), request);
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) return new Response(null, { status: 404 });
    throw error;
  }
}
