// Lot 43 (FAC-02, D3) — le PDF de la proposition, rendu côté serveur (@react-pdf/renderer, même
// rendu que le devis), avec les options choisies, ou toutes les options marquées « non retenue » si
// rien n'est choisi. Seulement par le lien d'un client de l'évènement (rubrique « Devis ») ; sinon 404.
import { currentLinkAccess } from "@/lib/link-session";
import { isQuotesModuleEnabled, isValidId } from "@/app/devis/module-access";
import { getEventProposal, getQuote, QuoteNotFoundError } from "@/modules/quotes/service";
import { renderQuotePdf } from "@/app/devis/[quoteId]/render-quote-pdf";
import { fileDownloadResponse } from "@/lib/file-response";

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }): Promise<Response> {
  const access = await currentLinkAccess();
  const { versionId } = await params;
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("quotes") || !isValidId(versionId) || !(await isQuotesModuleEnabled(access.organizationId))) {
    return new Response(null, { status: 404 });
  }
  try {
    const proposal = await getEventProposal(access.organizationId, { eventId: access.eventId, versionId });
    const quote = await getQuote(access.organizationId, proposal.quoteId);
    const version = quote.versions.find((candidate) => candidate.id === versionId)!;
    const pdf = await renderQuotePdf({ organizationId: access.organizationId, quote, version, greeting: proposal.greeting });
    return fileDownloadResponse({ data: pdf, contentType: "application/pdf", fileName: `${quote.number}-V${version.version}.pdf` });
  } catch (error) {
    if (error instanceof QuoteNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}
