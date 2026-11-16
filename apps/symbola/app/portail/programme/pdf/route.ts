// PRD-EVT-06, lot 26a — programme du jour J d'un lien personnel dont la rubrique
// « Programme » est ouverte, toujours sans note interne. L'événement est celui du lien, jamais un
// identifiant de l'adresse. Lot 37b (CHR-07, D10) : la dernière version diffusée, avec son numéro ;
// rien tant qu'aucune version n'est diffusée.
import { currentLinkAccess } from "@/lib/link-session";
import { getLinkEventView, LinkAccessDeniedError } from "@/modules/events/service";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { renderPublishedProgramPdfResponse } from "@/app/events/[id]/programme/render-program-pdf";

export async function GET(): Promise<Response> {
  const access = await currentLinkAccess();
  if (!access || !(await isEventsModuleEnabled(access.organizationId))) return new Response(null, { status: 404 });
  let view;
  try {
    view = await getLinkEventView(access.organizationId, access.linkId);
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) return new Response(null, { status: 404 });
    throw error;
  }
  if (!view.program?.version) return new Response(null, { status: 404 });
  return renderPublishedProgramPdfResponse({ organizationId: access.organizationId, event: view.event, items: view.program.items, version: view.program.version, disposition: "attachment" });
}
