// Lot 12 (L12-EVT-16), lot 26a — RIB d'un prestataire partagé au tiers : la
// rubrique « Options de prestataires » du lien et les cases « montrer » et
// « partager le RIB » sont vérifiées par le module events, le fichier est lu par
// le module vendors et servi par l'app (ADR 0027).
import { refusedResponse } from "@/lib/access-refusals";
import { currentLinkAccess } from "@/lib/link-session";
import { getLinkSharedRibVendorId, LinkAccessDeniedError, VendorCandidateNotFoundError } from "@/modules/events/service";
import { getVendorRibFile, VendorFileNotFoundError } from "@/modules/vendors/service";
import { fileDownloadResponse } from "@/lib/file-response";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";

export async function GET(request: Request, { params }: { params: Promise<{ candidateId: string }> }): Promise<Response> {
  const access = await currentLinkAccess();
  if (!access) return new Response(null, { status: 404 });
  const { organizationId } = access;
  if (!(await isEventsModuleEnabled(organizationId)) || !(await isVendorsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { candidateId } = await params;
  if (!isValidId(candidateId)) return new Response(null, { status: 404 });
  try {
    const vendorId = await getLinkSharedRibVendorId(organizationId, access.linkId, candidateId);
    return fileDownloadResponse(await getVendorRibFile(organizationId, vendorId));
  } catch (error) {
    if (error instanceof LinkAccessDeniedError || error instanceof VendorCandidateNotFoundError || error instanceof VendorFileNotFoundError) {
      return refusedResponse(request);
    }
    throw error;
  }
}
