// Lot 31b (JUR-07, DOC-03 ; réponse 1 de l'avocat) — le client lit son contrat avant de commander
// et de signer : PDF du contrat envoyé en signature, pour l'événement de sa session de lien
// (lien client, rubrique devis) ; jamais un contrat d'un autre événement ni d'une autre
// organisation, et jamais un contrat qui n'est pas parti en signature.
import { currentLinkAccess } from "@/lib/link-session";
import { isValidId } from "@/app/events/module-access";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { ContractNotFoundError, getClientContract } from "@/modules/quotes/service";
import { renderContractPdf } from "@/app/devis/[quoteId]/render-contract-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ contractId: string }> }): Promise<Response> {
  const access = await currentLinkAccess();
  const { contractId } = await params;
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("quotes") || !isValidId(contractId) || !(await isQuotesModuleEnabled(access.organizationId))) {
    return new Response(null, { status: 404 });
  }
  try {
    const { quote, contract } = await getClientContract(access.organizationId, access.eventId, contractId);
    const pdf = await renderContractPdf({ organizationId: access.organizationId, quote, contract });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${quote.number}-contrat.pdf"`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    if (error instanceof ContractNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}
