// Lot 47 (PRE-04, SEC-21 ; D3, D4 ; ADR 0085) — le prestataire dépose son devis depuis son
// téléphone (photo ou PDF), par son lien, sans compte : origine, session du lien, débit et taille
// vérifiés avant la lecture (receiveLinkUpload) ; type par le contenu, antivirus et stockage privé
// par le service, qui revérifie que le lien est en consultation et que la planner n'a pas tranché.
import { isStorageFullError, storageFullMessage } from "@/lib/storage-full";
import { getTranslations } from "next-intl/server";
import { parseAmountToCents } from "@symbola/i18n";
import { attachVendorQuoteByLink, CandidateQuoteRejectedError, LinkAccessDeniedError, VendorBriefInvalidError } from "@/modules/events/service";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { receiveLinkUpload, uploadResponse } from "@/lib/uploads/receive";

export async function POST(request: Request): Promise<Response> {
  const received = await receiveLinkUpload(request, "vendor");
  if (!received.ok) return received.response;
  const { access, formData } = received;
  const t = await getTranslations("VendorAnswer");
  if (!(await isEventsModuleEnabled(access.organizationId))) return uploadResponse({ error: t("errors.closed") });
  const file = formData.get("quote");
  if (!(file instanceof File) || file.size === 0) return uploadResponse({ error: t("errors.fileMissing") });
  const amount = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (amount === undefined) return uploadResponse({ error: t("errors.amount") });
  try {
    await attachVendorQuoteByLink({ organizationId: access.organizationId, linkId: access.linkId, content: new Uint8Array(await file.arrayBuffer()), quoteAmountCents: amount, message: String(formData.get("message") ?? "") });
  } catch (error) {
    // Lot 54 (DOC-06) : quota de stockage plein, préavis passé.
    if (isStorageFullError(error)) return uploadResponse({ error: await storageFullMessage("link") });
    if (error instanceof CandidateQuoteRejectedError) return uploadResponse({ error: t(error.reason === "too_large" ? "errors.tooLarge" : error.reason === "infected" ? "errors.infected" : "errors.unsupported") });
    if (error instanceof VendorBriefInvalidError) return uploadResponse({ error: t("errors.message") });
    if (error instanceof LinkAccessDeniedError) return uploadResponse({ error: t("errors.closed") });
    throw error;
  }
  return uploadResponse({ success: true });
}
