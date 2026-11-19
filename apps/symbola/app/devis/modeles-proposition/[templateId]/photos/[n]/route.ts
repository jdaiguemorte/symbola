// Lot 43 (FAC-02, D2 ; ADR 0027) — aperçu d'une photo d'un modèle de proposition, pour l'équipe.
import { fileDownloadResponse } from "@/lib/file-response";
import { getProposalTemplatePhoto, ProposalPhotoError } from "@/modules/quotes/service";
import { isValidId } from "../../../../module-access";
import { authorizedPlanner } from "../../../../planner-access";

export async function GET(_request: Request, { params }: { params: Promise<{ templateId: string; n: string }> }): Promise<Response> {
  const planner = await authorizedPlanner();
  if (!planner) return new Response(null, { status: 401 });
  const { templateId, n } = await params;
  const index = Number(n);
  if (!isValidId(templateId) || !Number.isInteger(index) || index < 1 || index > 3) return new Response(null, { status: 404 });
  try {
    return fileDownloadResponse(await getProposalTemplatePhoto(planner.organizationId, templateId, index), { inline: true });
  } catch (error) {
    if (error instanceof ProposalPhotoError) return new Response(null, { status: 404 });
    throw error;
  }
}
