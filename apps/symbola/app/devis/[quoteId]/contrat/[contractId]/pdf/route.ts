// Lot 31b (FAC-04, D7) — PDF d'un contrat généré (texte figé), téléchargé par la planner.
// Contrôles côté serveur : session planner, organisation, module souscrit, identifiants valides ;
// un contrat d'un autre devis ou d'une autre organisation n'est pas trouvé.
import { refusedResponse } from "@/lib/access-refusals";
import { getQuote, listQuoteContracts, QuoteNotFoundError } from "@/modules/quotes/service";
import { isValidId } from "../../../../module-access";
import { authorizedPlanner } from "../../../../planner-access";
import { renderContractPdf } from "../../../render-contract-pdf";

export async function GET(request: Request, { params }: { params: Promise<{ quoteId: string; contractId: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { quoteId, contractId } = await params;
  if (!isValidId(quoteId) || !isValidId(contractId)) return new Response(null, { status: 404 });
  try {
    const quote = await getQuote(planner.organizationId, quoteId);
    const contract = (await listQuoteContracts(planner.organizationId, quoteId)).find((candidate) => candidate.id === contractId);
    if (!contract) return refusedResponse(request);
    const pdf = await renderContractPdf({ organizationId: planner.organizationId, quote, contract });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quote.number}-contrat-V${contract.version}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof QuoteNotFoundError) return refusedResponse(request);
    throw error;
  }
}
