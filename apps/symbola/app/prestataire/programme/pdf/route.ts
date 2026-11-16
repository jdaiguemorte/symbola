// Lot 37b (CHR-07, D9 ; ADR 0071) — le programme d'un prestataire en PDF : la dernière version
// diffusée, vue de son poste (ses séquences en entier, le déroulé du jour en titres et horaires),
// avec son numéro. Session du lien prestataire, puis le service relit le lien ; l'évènement est
// celui du lien, jamais un identifiant de l'adresse. Rien tant qu'aucune version n'est diffusée.
import { currentLinkAccess } from "@/lib/link-session";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { getVendorLinkView, LinkAccessDeniedError } from "@/modules/events/service";
import { renderVendorProgramPdfResponse } from "@/app/events/[id]/programme/render-program-pdf";

export async function GET(): Promise<Response> {
  const access = await currentLinkAccess();
  if (!access || access.audience !== "vendor" || !(await isEventsModuleEnabled(access.organizationId))) return new Response(null, { status: 404 });
  let view;
  try {
    view = await getVendorLinkView(access.organizationId, access.linkId);
  } catch (error) {
    if (error instanceof LinkAccessDeniedError) return new Response(null, { status: 404 });
    throw error;
  }
  const version = view.program.version;
  if (!version) return new Response(null, { status: 404 });
  const response = await renderVendorProgramPdfResponse({
    organizationId: access.organizationId,
    event: { clients: view.clientFirstNames.map((firstName) => ({ firstName })), eventDate: view.eventDate, isDemo: false },
    program: { ...view.program, version },
    slotLabel: view.slotLabel,
  });
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
