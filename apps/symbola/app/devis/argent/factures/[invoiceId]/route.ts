// Lot 48b (PRE-07, D8) — PDF Factur-X d'une facture de commission au prestataire : session planner,
// organisation, module des devis ; l'original déposé à l'émission (ADR 0061), jamais reconstruit s'il
// est altéré.
// Lot 52 (HUB-04 ; décision de Julien du 19/11, ADR 0094) : le Comptable invité par la Propriétaire la
// lit aussi, en lecture seule, comme les autres factures ; l'émission et les changements lui restent
// refusés (actions de /devis/argent, réservées à la planner).
import { refusedResponse } from "@/lib/access-refusals";
import { wantsPreview } from "@/lib/file-response";
import { getCommissionInvoicePdf, InvoiceNotFoundError, OriginalAlteredError } from "@/modules/quotes/service";
import { isValidId } from "../../../module-access";
import { authorizedAccountingReader } from "../../../planner-access";
import { renderInvoicePdf } from "../../../factures/render-invoice-pdf";

export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }): Promise<Response> {
  const planner = await authorizedAccountingReader();
  if (!planner) return new Response(null, { status: 401 });
  const { invoiceId } = await params;
  if (!isValidId(invoiceId)) return new Response(null, { status: 404 });
  let found;
  try {
    found = await getCommissionInvoicePdf(planner.organizationId, invoiceId, (invoice) => renderInvoicePdf(planner.organizationId, invoice));
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) return refusedResponse(request);
    if (error instanceof OriginalAlteredError) return new Response(null, { status: 409 });
    throw error;
  }
  return new Response(new Uint8Array(found.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${wantsPreview(request) ? "inline" : "attachment"}; filename="${found.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
