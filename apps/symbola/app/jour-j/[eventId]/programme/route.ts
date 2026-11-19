// Lot 29a (JRJ-02, JRJ-04 ; décision D5) — PDF du programme, version de l'équipe (notes
// internes comprises), ouvert dans le navigateur plutôt que téléchargé : gardé avec l'écran
// du jour J, il se lit sans réseau. Mêmes contrôles que l'écran : session de la planner,
// module souscrit, évènement de l'organisation, confirmé (ou réalisé) et daté.
// Lot 52 (EVT-06, D3) : aussi le renfort du jour J de cet évènement (accès commun des routes).
import { EventNotFoundError, getEventProgram } from "@/modules/events/service";
import { renderProgramPdfResponse } from "@/app/events/[id]/programme/render-program-pdf";
import { dayOfAccess } from "../access";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const { eventId } = await params;
  const access = await dayOfAccess(request, eventId, { write: false });
  if (!access.ok) return new Response(null, { status: access.response.status });
  const { organizationId, event } = access;
  let program;
  try {
    program = await getEventProgram(organizationId, eventId);
  } catch (error) {
    if (error instanceof EventNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
  const pdf = await renderProgramPdfResponse({ organizationId, event, program, variant: "vendors" });
  const headers = new Headers(pdf.headers);
  headers.set("Content-Disposition", (headers.get("Content-Disposition") ?? "").replace(/^attachment/, "inline"));
  return new Response(pdf.body, { status: pdf.status, headers });
}
