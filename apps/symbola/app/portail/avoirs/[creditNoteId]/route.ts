// Lot 37a (POR-04, D6 ; ADR 0070) — un avoir émis pour l'évènement, au portail de ses clients,
// d'office, comme sa facture : l'original déposé à l'émission (DOC-08), seulement s'il est d'un
// devis de l'évènement du lien, sinon comme une pièce absente.
import { currentLinkAccess } from "@/lib/link-session";
import { wantsPreview } from "@/lib/file-response";
import { isValidId } from "@/app/events/module-access";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { renderCreditNotePdf } from "@/app/devis/factures/render-invoice-pdf";
import { getEventCreditNotePdf, InvoiceNotFoundError, OriginalAlteredError } from "@/modules/quotes/service";

export async function GET(request: Request, { params }: { params: Promise<{ creditNoteId: string }> }): Promise<Response> {
  const access = await currentLinkAccess();
  const { creditNoteId } = await params;
  if (!access || access.audience !== "client" || !isValidId(creditNoteId) || !(await isQuotesModuleEnabled(access.organizationId))) return new Response(null, { status: 404 });
  let found;
  try {
    found = await getEventCreditNotePdf(access.organizationId, access.eventId, creditNoteId, (creditNote, vatApplicable) => renderCreditNotePdf(access.organizationId, creditNote, vatApplicable));
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) return new Response(null, { status: 404 });
    if (error instanceof OriginalAlteredError) return new Response(null, { status: 409 });
    throw error;
  }
  return new Response(new Uint8Array(found.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${wantsPreview(request) ? "inline" : "attachment"}; filename="${found.number}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
    },
  });
}
