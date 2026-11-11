// Lot 11 (L11-PRE-01) — plaquette ou RIB joint à une fiche du carnet. Lot 16
// (L16-SEC-02, ADR 0044) : par cette route dédiée plutôt qu'une action serveur ;
// origine, session, limite de débit et taille sont vérifiées avant la lecture
// du fichier (lib/uploads/receive.ts).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { attachVendorFile, VendorFileRejectedError, VendorNotFoundError } from "@/modules/vendors/service";
import { isValidId } from "@/app/events/module-access";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { isVendorsModuleEnabled } from "../../module-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const received = await receiveUpload(request);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("VendorBook");
  if (!(await isVendorsModuleEnabled(user.organizationId))) return uploadResponse({ error: t("unauthorized") });
  const { id: vendorId } = await params;
  if (!isValidId(vendorId)) return uploadResponse({ error: t("notFound") });
  const kind = formData.get("kind") === "rib" ? "rib" : "brochure";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("fileMissing") });
  try {
    await attachVendorFile({ organizationId: user.organizationId, vendorId, kind, fileName: file.name, content: new Uint8Array(await file.arrayBuffer()), uploadedByUserId: user.id });
  } catch (error) {
    if (error instanceof VendorFileRejectedError) return uploadResponse({ error: t(error.reason === "too_large" ? "fileTooLarge" : error.reason === "infected" ? "fileInfected" : "fileUnsupported") });
    if (error instanceof VendorNotFoundError) return uploadResponse({ error: t("notFound") });
    throw error;
  }
  revalidatePath(`/prestataires/${vendorId}`);
  return uploadResponse({ success: true });
}
