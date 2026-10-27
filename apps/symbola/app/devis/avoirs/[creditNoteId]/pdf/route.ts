// DEV-04 — PDF d'un avoir émis, rendu depuis sa copie figée.
import { getCreditNote, getInvoice, InvoiceNotFoundError } from "@/modules/quotes/service";
import { isValidId } from "../../../module-access";
import { authorizedPlanner } from "../../../planner-access";
import { renderCreditNotePdf } from "../../../factures/render-invoice-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ creditNoteId: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { creditNoteId } = await params;
  if (!isValidId(creditNoteId)) return new Response(null, { status: 404 });
  let creditNote;
  let invoice;
  try {
    creditNote = await getCreditNote(planner.organizationId, creditNoteId);
    invoice = await getInvoice(planner.organizationId, creditNote.invoiceId);
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
  const pdf = await renderCreditNotePdf(planner.organizationId, creditNote, invoice.vatApplicable);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${creditNote.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
