// Lot 43 (FAC-02, D2 ; ADR 0027) — une photo de la page de proposition, servie par l'app après contrôle
// du lien (client de l'évènement, rubrique « Devis ») ; jamais d'adresse publique du stockage.
import { currentLinkAccess } from "@/lib/link-session";
import { fileDownloadResponse } from "@/lib/file-response";
import { isQuotesModuleEnabled, isValidId } from "@/app/devis/module-access";
import { getProposalPhoto, QuoteNotFoundError } from "@/modules/quotes/service";

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string; n: string }> }): Promise<Response> {
  const access = await currentLinkAccess();
  const { versionId, n } = await params;
  const index = Number(n);
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("quotes") || !isValidId(versionId) || !Number.isInteger(index) || index < 1 || index > 3 || !(await isQuotesModuleEnabled(access.organizationId))) {
    return new Response(null, { status: 404 });
  }
  try {
    return fileDownloadResponse(await getProposalPhoto(access.organizationId, { eventId: access.eventId, versionId, index }), { inline: true });
  } catch (error) {
    if (error instanceof QuoteNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
}
