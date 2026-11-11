// DEV-04 — PDF d'un avoir émis. Lot 23b (DOC-08, ADR 0061) : l'original déposé
// à l'émission, servi seulement si son empreinte est intacte ; sinon 409.
import { getCreditNotePdf, InvoiceNotFoundError, OriginalAlteredError } from "@/modules/quotes/service";
import { isValidId } from "../../../module-access";
import { authorizedPlanner } from "../../../planner-access";
import { renderCreditNotePdf } from "../../../factures/render-invoice-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ creditNoteId: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { creditNoteId } = await params;
  if (!isValidId(creditNoteId)) return new Response(null, { status: 404 });
  let found;
  try {
    found = await getCreditNotePdf(planner.organizationId, creditNoteId, (creditNote, vatApplicable) =>
      renderCreditNotePdf(planner.organizationId, creditNote, vatApplicable),
    );
  } catch (error) {
    if (error instanceof InvoiceNotFoundError) return new Response(null, { status: 404 });
    if (error instanceof OriginalAlteredError) return new Response(null, { status: 409 });
    throw error;
  }
  return new Response(new Uint8Array(found.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${found.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
