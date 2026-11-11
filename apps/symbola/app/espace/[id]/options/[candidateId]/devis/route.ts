// Lot 11 (L11-EVT-11) — devis d'une option montrée aux clients : l'accès du
// client à l'événement et la case « montrer aux clients » sont vérifiés par
// le module events ; fichier servi par l'app (ADR 0027).
import { refusedResponse } from "@/lib/access-refusals";
import { ClientVendorOptionsAccessDeniedError, getClientVendorQuoteFile, VendorCandidateNotFoundError } from "@/modules/events/service";
import { fileDownloadResponse } from "@/lib/file-response";
import { getClientAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }): Promise<Response> {
  const auth = await getClientAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { id, candidateId } = await params;
  if (!isValidId(id) || !isValidId(candidateId)) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await getClientVendorQuoteFile(organizationId, auth.user.id, id, candidateId));
  } catch (error) {
    if (error instanceof ClientVendorOptionsAccessDeniedError || error instanceof VendorCandidateNotFoundError) return refusedResponse(request);
    throw error;
  }
}
