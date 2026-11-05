// Lot 12 (EVT-16) — RIB d'un prestataire partagé aux clients : l'accès du
// client à l'événement et les cases « montrer » et « partager le RIB » sont
// vérifiés par le module events, le fichier est lu par le module vendors et
// servi par l'app (ADR 0027).
import { ClientVendorOptionsAccessDeniedError, getClientSharedRibVendorId, VendorCandidateNotFoundError } from "@/modules/events/service";
import { getVendorRibFile, VendorFileNotFoundError } from "@/modules/vendors/service";
import { fileDownloadResponse } from "@/lib/file-response";
import { getClientAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }): Promise<Response> {
  const auth = await getClientAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId)) || !(await isVendorsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { id, candidateId } = await params;
  if (!isValidId(id) || !isValidId(candidateId)) return new Response(null, { status: 404 });
  try {
    const vendorId = await getClientSharedRibVendorId(organizationId, auth.user.id, id, candidateId);
    return fileDownloadResponse(await getVendorRibFile(organizationId, vendorId));
  } catch (error) {
    if (error instanceof ClientVendorOptionsAccessDeniedError || error instanceof VendorCandidateNotFoundError || error instanceof VendorFileNotFoundError) {
      return new Response(null, { status: 404 });
    }
    throw error;
  }
}
