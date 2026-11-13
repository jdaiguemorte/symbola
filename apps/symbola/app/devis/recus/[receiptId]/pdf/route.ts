// Lot 31c (JUR-08, D21) — PDF d'un reçu d'arrhes. Contrôles côté serveur : session planner,
// organisation (RLS), module souscrit ; un reçu d'une autre organisation n'existe pas pour elle.
import { refusedResponse } from "@/lib/access-refusals";
import { getReceipt, ReceiptNotFoundError } from "@/modules/quotes/service";
import { isValidId } from "../../../module-access";
import { authorizedPlanner } from "../../../planner-access";
import { renderReceiptPdf } from "../../render-receipt-pdf";

export async function GET(request: Request, { params }: { params: Promise<{ receiptId: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { receiptId } = await params;
  if (!isValidId(receiptId)) return new Response(null, { status: 404 });
  let receipt;
  try {
    receipt = await getReceipt(planner.organizationId, receiptId);
  } catch (error) {
    if (error instanceof ReceiptNotFoundError) return refusedResponse(request);
    throw error;
  }
  const pdf = await renderReceiptPdf(planner.organizationId, receipt);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receipt.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
