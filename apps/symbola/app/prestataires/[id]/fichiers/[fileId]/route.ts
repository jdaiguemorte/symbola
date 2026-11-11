// Lot 11 (L11-PRE-01) — plaquette ou RIB d'une fiche : session, organisation et
// module vérifiés, fichier servi par l'app (ADR 0027).
import { refusedResponse } from "@/lib/access-refusals";
import { getVendorFile, VendorFileNotFoundError } from "@/modules/vendors/service";
import { fileDownloadResponse } from "@/lib/file-response";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "../../../module-access";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isVendorsModuleEnabled(organizationId))) return new Response(null, { status: 404 });
  const { fileId } = await params;
  if (!isValidId(fileId)) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await getVendorFile(organizationId, fileId));
  } catch (error) {
    if (error instanceof VendorFileNotFoundError) return refusedResponse(request);
    throw error;
  }
}
