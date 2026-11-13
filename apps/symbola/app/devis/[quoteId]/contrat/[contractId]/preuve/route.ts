// Lot 31b (réponses 1 et 5 de l'avocat, partie N) — dossier de preuve de Symbola, lisible : relu
// dans le stockage privé, son empreinte vérifiée (ADR 0027, lot 23b). Contrôles côté serveur :
// session planner, organisation, module souscrit, contrat de ce devis.
import { refusedResponse } from "@/lib/access-refusals";
import { ContractNotFoundError, getContractEvidence, getQuote, OriginalAlteredError, QuoteNotFoundError, SignatureDocumentNotFoundError } from "@/modules/quotes/service";
import { isValidId } from "../../../../module-access";
import { authorizedPlanner } from "../../../../planner-access";
import { renderEvidencePdf } from "../../../render-contract-pdf";

export async function GET(request: Request, { params }: { params: Promise<{ quoteId: string; contractId: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { quoteId, contractId } = await params;
  if (!isValidId(quoteId) || !isValidId(contractId)) return new Response(null, { status: 404 });
  try {
    const quote = await getQuote(planner.organizationId, quoteId);
    const evidence = await getContractEvidence(planner.organizationId, quoteId, contractId);
    const pdf = await renderEvidencePdf(evidence);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quote.number}-dossier-de-preuve.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof QuoteNotFoundError || error instanceof ContractNotFoundError || error instanceof SignatureDocumentNotFoundError) return refusedResponse(request);
    if (error instanceof OriginalAlteredError) return new Response(null, { status: 409 });
    throw error;
  }
}
