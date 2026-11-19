// Lot 48a (PRE-05 ; D3, ADR 0093) — le prestataire dépose, par son lien, une pièce que la planner lui a
// demandée (assurance, Kbis…). Mêmes contrôles qu'un envoi par lien (origine, session du lien, débit,
// taille, type par le contenu, antivirus) ; la fiche vient du lien, la pièce doit lui être demandée.
// Elle arrive « à vérifier » chez la planner.
import { getTranslations } from "next-intl/server";
import { linkVendorRecordId } from "@/modules/events/service";
import { receiveVendorDocumentByLink, VendorDocumentNotFoundError, VendorDocumentRejectedError } from "@/modules/vendors/service";
import { isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { receiveLinkUpload, uploadResponse } from "@/lib/uploads/receive";

export async function POST(request: Request): Promise<Response> {
  const received = await receiveLinkUpload(request, "vendor");
  if (!received.ok) return received.response;
  const { access, formData } = received;
  const t = await getTranslations("VendorSpace");
  if (!(await isVendorsModuleEnabled(access.organizationId))) return uploadResponse({ error: t("documentsClosed") });
  const vendorId = await linkVendorRecordId(access.organizationId, access.linkId);
  const documentId = String(formData.get("documentId") ?? "");
  if (!vendorId || !isValidId(documentId)) return uploadResponse({ error: t("documentsClosed") });
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("documentsFileMissing") });
  try {
    await receiveVendorDocumentByLink({
      organizationId: access.organizationId,
      vendorId,
      documentId,
      linkId: access.linkId,
      fileName: file.name,
      content: new Uint8Array(await file.arrayBuffer()),
      validUntil: String(formData.get("validUntil") ?? "") || null,
    });
  } catch (error) {
    if (error instanceof VendorDocumentRejectedError) return uploadResponse({ error: t(error.reason === "too_large" ? "documentsTooLarge" : error.reason === "infected" ? "documentsInfected" : "documentsUnsupported") });
    if (error instanceof VendorDocumentNotFoundError) return uploadResponse({ error: t("documentsClosed") });
    if (error instanceof RangeError) return uploadResponse({ error: t("documentsDateInvalid") });
    throw error;
  }
  return uploadResponse({ success: true });
}
