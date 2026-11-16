// PRD-EVT-05 — export PDF A4 du programme du jour J, en deux variantes :
// « mariés » (sans notes internes) et « prestataires » (l'équipe, notes internes comprises).
// Contrôles côté serveur : session, rôle planner, organisation, module souscrit, identifiant
// valide. Lot 37b (DAT-14, D8) : `?version=N` rend une version diffusée, telle qu'elle a été
// diffusée, avec son numéro ; `&apercu=1` l'ouvre dans le navigateur (lot 37a, D5).
import { refusedResponse } from "@/lib/access-refusals";
import { z } from "zod";
import { EventNotFoundError, getEvent, getEventProgram, getEventProgramVersion } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { wantsPreview } from "@/lib/file-response";
import { isEventsModuleEnabled, isValidId } from "../../../module-access";
import { renderProgramPdfResponse, renderPublishedProgramPdfResponse } from "../render-program-pdf";

const variantSchema = z.enum(["couple", "vendors"]);
const versionSchema = z.string().regex(/^[1-9]\d{0,5}$/).transform(Number);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });

  const { id } = await params;
  const search = new URL(request.url).searchParams;
  if (!isValidId(id)) return new Response(null, { status: 404 });

  if (search.has("version")) {
    const number = versionSchema.safeParse(search.get("version"));
    if (!number.success) return new Response(null, { status: 404 });
    const event = await getEvent(organizationId, id);
    if (!event) return refusedResponse(request);
    const version = await getEventProgramVersion(organizationId, id, number.data);
    if (!version) return refusedResponse(request);
    return renderPublishedProgramPdfResponse({ organizationId, event, items: version.items, version, disposition: wantsPreview(request) ? "inline" : "attachment" });
  }

  const variant = variantSchema.safeParse(search.get("variant"));
  if (!variant.success) return new Response(null, { status: 404 });
  const event = await getEvent(organizationId, id);
  if (!event) return refusedResponse(request);
  let program;
  try {
    program = await getEventProgram(organizationId, id);
  } catch (error) {
    if (error instanceof EventNotFoundError) return refusedResponse(request);
    throw error;
  }
  return renderProgramPdfResponse({ organizationId, event, program, variant: variant.data });
}
