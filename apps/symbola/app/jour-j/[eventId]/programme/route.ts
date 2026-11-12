// Lot 29a (JRJ-02, JRJ-04 ; décision D5) — PDF du programme, version de l'équipe (notes
// internes comprises), ouvert dans le navigateur plutôt que téléchargé : gardé avec l'écran
// du jour J, il se lit sans réseau. Mêmes contrôles que l'écran : session de la planner,
// module souscrit, évènement de l'organisation, confirmé (ou réalisé) et daté.
import { EventNotFoundError, getEvent, getEventProgram } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { renderProgramPdfResponse } from "@/app/events/[id]/programme/render-program-pdf";
import { isDayOfOpen } from "../day-of-view";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  const { eventId } = await params;
  if (!isValidId(eventId) || !(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });

  const event = await getEvent(organizationId, eventId);
  if (!event || !isDayOfOpen(event)) return new Response(null, { status: 404 });
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
