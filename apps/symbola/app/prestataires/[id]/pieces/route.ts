// Lot 48a (PRE-05, D3) — pièce déposée par la planner sur une fiche (assurance, Kbis, plan du lieu…),
// vérifiée d'office. Comme les fichiers de la fiche (ADR 0044) : origine, session, limite de débit et
// taille vérifiées avant la lecture (lib/uploads/receive.ts) ; type par le contenu et antivirus.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { addVendorDocument, VendorDocumentNotFoundError, VendorDocumentRejectedError } from "@/modules/vendors/service";
import { isValidId } from "@/app/events/module-access";
import { receiveUpload, uploadResponse } from "@/lib/uploads/receive";
import { isVendorsModuleEnabled } from "../../module-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const received = await receiveUpload(request);
  if (!received.ok) return received.response;
  const { user, formData } = received;
  const t = await getTranslations("VendorRecords");
  if (!(await isVendorsModuleEnabled(user.organizationId))) return uploadResponse({ error: t("unauthorized") });
  const { id: vendorId } = await params;
  const kindId = String(formData.get("kindId") ?? "");
  if (!isValidId(vendorId) || !isValidId(kindId)) return uploadResponse({ error: t("notFound") });
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("fileMissing") });
  try {
    await addVendorDocument({
      organizationId: user.organizationId,
      vendorId,
      kindId,
      fileName: file.name,
      content: new Uint8Array(await file.arrayBuffer()),
      validUntil: String(formData.get("validUntil") ?? "") || null,
      userId: user.id,
    });
  } catch (error) {
    if (error instanceof VendorDocumentRejectedError) return uploadResponse({ error: t(error.reason === "too_large" ? "fileTooLarge" : error.reason === "infected" ? "fileInfected" : "fileUnsupported") });
    if (error instanceof VendorDocumentNotFoundError) return uploadResponse({ error: t("notFound") });
    if (error instanceof RangeError) return uploadResponse({ error: t("validUntilInvalid") });
    throw error;
  }
  revalidatePath(`/prestataires/${vendorId}`);
  return uploadResponse({ success: true });
}
