// Lot 48a (PRE-05) — fichier d'une pièce : session, organisation et module vérifiés, fichier servi par
// l'app (ADR 0027) ; la pièce doit être celle de la fiche de l'adresse.
import { refusedResponse } from "@/lib/access-refusals";
import { getVendorDocumentFile, VendorDocumentNotFoundError } from "@/modules/vendors/service";
import { fileDownloadResponse } from "@/lib/file-response";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "../../../module-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; documentId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isVendorsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { id, documentId } = await params;
  if (!isValidId(id) || !isValidId(documentId)) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await getVendorDocumentFile(organizationId, documentId, { vendorId: id }));
  } catch (error) {
    if (error instanceof VendorDocumentNotFoundError) return refusedResponse(request);
    throw error;
  }
}
