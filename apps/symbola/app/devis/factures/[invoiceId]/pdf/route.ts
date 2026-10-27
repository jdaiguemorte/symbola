// DEV-04 — PDF d'une facture émise, rendu depuis sa copie figée. Contrôles
// côté serveur : session planner, organisation, module souscrit.
import { getInvoice, InvoiceNotFoundError } from "@/modules/quotes/service";
import { isValidId } from "../../../module-access";
import { authorizedPlanner } from "../../../planner-access";
import { renderInvoicePdf } from "../../render-invoice-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { invoiceId } = await params;
  if (!isValidId(invoiceId)) return new Response(null, { status: 404 });
  let invoice;
  try {
    invoice = await getInvoice(planner.organizationId, invoiceId);
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
  const pdf = await renderInvoicePdf(planner.organizationId, invoice);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
