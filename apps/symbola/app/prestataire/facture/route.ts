// Lot 47 (PRE-04, SEC-21 ; D3 ; ADR 0085) — le prestataire retenu dépose sa facture par son lien :
// mêmes contrôles que le devis ; elle est rangée dans les documents de l'évènement (non partagée)
// et signalée à la planner. Elle ne crée rien dans sa facturation.
import { isStorageFullError, storageFullMessage } from "@/lib/storage-full";
import { getTranslations } from "next-intl/server";
import { attachVendorInvoiceByLink, CandidateQuoteRejectedError, LinkAccessDeniedError } from "@/modules/events/service";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { receiveLinkUpload, uploadResponse } from "@/lib/uploads/receive";

export async function POST(request: Request): Promise<Response> {
  const received = await receiveLinkUpload(request, "vendor");
  if (!received.ok) return received.response;
  const { access, formData } = received;
  const t = await getTranslations("VendorAnswer");
  if (!(await isEventsModuleEnabled(access.organizationId))) return uploadResponse({ error: t("errors.closed") });
  const file = formData.get("invoice");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("errors.fileMissing") });
  try {
    await attachVendorInvoiceByLink({ organizationId: access.organizationId, linkId: access.linkId, content: new Uint8Array(await file.arrayBuffer()), label: t("invoiceLabel", { name: access.personName }) });
  } catch (error) {
    // Lot 54 (DOC-06) : quota de stockage plein, préavis passé.
    if (isStorageFullError(error)) return uploadResponse({ error: await storageFullMessage("link") });
    if (error instanceof CandidateQuoteRejectedError) return uploadResponse({ error: t(error.reason === "too_large" ? "errors.tooLarge" : error.reason === "infected" ? "errors.infected" : "errors.unsupported") });
    if (error instanceof LinkAccessDeniedError) return uploadResponse({ error: t("errors.closed") });
    throw error;
  }
  return uploadResponse({ success: true });
}
