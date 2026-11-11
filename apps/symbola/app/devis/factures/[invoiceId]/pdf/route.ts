// DEV-04 — PDF d'une facture émise. Contrôles côté serveur : session planner,
// organisation, module souscrit. Lot 23b (DOC-08, ADR 0061) : l'original déposé
// à l'émission, servi seulement si son empreinte est intacte ; sinon 409 et
// rien n'est reconstruit à sa place.
import { getInvoicePdf, InvoiceNotFoundError, OriginalAlteredError } from "@/modules/quotes/service";
import { isValidId } from "../../../module-access";
import { authorizedPlanner } from "../../../planner-access";
import { renderInvoicePdf } from "../../render-invoice-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { invoiceId } = await params;
  if (!isValidId(invoiceId)) return new Response(null, { status: 404 });
  let found;
  try {
    found = await getInvoicePdf(planner.organizationId, invoiceId, (invoice) => renderInvoicePdf(planner.organizationId, invoice));
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
