// Lot 43 (FAC-02, UX-17) — une photo de la proposition dans l'aperçu « vu par le client » de la planner.
import { fileDownloadResponse } from "@/lib/file-response";
import { getEventProposal, getProposalPhoto, getQuote, QuoteNotFoundError } from "@/modules/quotes/service";
import { isValidId } from "../../../../module-access";
import { authorizedPlanner } from "../../../../planner-access";

export async function GET(_request: Request, { params }: { params: Promise<{ quoteId: string; n: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { quoteId, n } = await params;
  const index = Number(n);
  if (!isValidId(quoteId) || !Number.isInteger(index) || index < 1 || index > 3) return new Response(null, { status: 404 });
  try {
    const quote = await getQuote(planner.organizationId, quoteId);
    const proposal = await getEventProposal(planner.organizationId, { eventId: quote.eventId, versionId: quote.current.id });
    return fileDownloadResponse(await getProposalPhoto(planner.organizationId, { eventId: quote.eventId, versionId: proposal.versionId, index }), { inline: true });
  } catch (error) {
    if (error instanceof QuoteNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}
