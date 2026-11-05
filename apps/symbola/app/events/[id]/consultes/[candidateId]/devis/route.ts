// Lot 11 (EVT-10) — devis d'un prestataire consulté, ouvert par l'équipe :
// session, organisation et module vérifiés, fichier servi par l'app depuis
// le stockage privé (ADR 0027).
import { getVendorCandidateQuoteFile, VendorCandidateNotFoundError } from "@/modules/events/service";
import { fileDownloadResponse } from "@/lib/file-response";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../../../../module-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { candidateId } = await params;
  if (!isValidId(candidateId)) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await getVendorCandidateQuoteFile(organizationId, candidateId));
  } catch (error) {
    if (error instanceof VendorCandidateNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}
