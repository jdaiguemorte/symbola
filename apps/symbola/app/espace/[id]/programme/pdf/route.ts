// EVT-06 — le marié télécharge le programme du jour J, toujours en
// variante « mariés » (sans notes internes), seulement pour un événement
// auquel il a accès.
import { ClientAccessDeniedError, getClientEventView } from "@/modules/events/service";
import { getClientAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { renderProgramPdfResponse } from "@/app/events/[id]/programme/render-program-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await getClientAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return new Response(null, { status: 401 });
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return new Response(null, { status: 404 });
  const { id } = await params;
  if (!isValidId(id)) return new Response(null, { status: 404 });

  let view;
  try {
    view = await getClientEventView(auth.user.organizationId, auth.user.id, id);
  } catch (error) {
    if (error instanceof ClientAccessDeniedError) return new Response(null, { status: 404 });
    throw error;
  }
  return renderProgramPdfResponse({
    organizationId: auth.user.organizationId,
    event: view.event,
    program: view.program,
    variant: "couple",
  });
}
