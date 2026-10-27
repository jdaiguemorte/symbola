// EVT-05 — export PDF A4 du programme du jour J, en deux variantes :
// « mariés » (sans notes internes) et « prestataires ». Contrôles côté
// serveur : session, rôle planner, organisation, module souscrit,
// identifiant valide.
import { z } from "zod";
import { EventNotFoundError, getEvent, getEventProgram } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../../../module-access";
import { renderProgramPdfResponse } from "../render-program-pdf";

const variantSchema = z.enum(["couple", "vendors"]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return new Response(null, { status: 404 });

  const { id } = await params;
  const variant = variantSchema.safeParse(new URL(request.url).searchParams.get("variant"));
  if (!isValidId(id) || !variant.success) return new Response(null, { status: 404 });

  const event = await getEvent(organizationId, id);
  if (!event) return new Response(null, { status: 404 });
  let program;
  try {
    program = await getEventProgram(organizationId, id);
  } catch (error) {
    if (error instanceof EventNotFoundError) return new Response(null, { status: 404 });
    throw error;
  }
  return renderProgramPdfResponse({ organizationId, event, program, variant: variant.data });
}
