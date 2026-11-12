// Lot 11 (L11-EVT-11), lot 26a — devis d'une option montrée au tiers : la
// rubrique « Options de prestataires » du lien et la case « montrer aux
// clients » sont vérifiées par le module events ; fichier servi par l'app
// (ADR 0027). Un objet d'un autre événement répond comme inexistant (SEC-13).
import { refusedResponse } from "@/lib/access-refusals";
import { currentLinkAccess } from "@/lib/link-session";
import { getLinkVendorQuoteFile, LinkAccessDeniedError, VendorCandidateNotFoundError } from "@/modules/events/service";
import { fileDownloadResponse } from "@/lib/file-response";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export async function GET(request: Request, { params }: { params: Promise<{ candidateId: string }> }): Promise<Response> {
  const access = await currentLinkAccess();
  if (!access || !(await isEventsModuleEnabled(access.organizationId))) return new Response(null, { status: 404 });
  const { candidateId } = await params;
  if (!isValidId(candidateId)) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await getLinkVendorQuoteFile(access.organizationId, access.linkId, candidateId));
  } catch (error) {
    if (error instanceof LinkAccessDeniedError || error instanceof VendorCandidateNotFoundError) return refusedResponse(request);
    throw error;
  }
}
