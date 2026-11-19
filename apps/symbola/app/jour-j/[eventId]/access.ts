// Lot 51 (JRJ-05 à JRJ-09, ARC-09, SEC-12, SEC-13 ; ADR 0091) — accès commun aux routes du jour J de
// terrain (file d'actions, photos, état partagé) : session de l'équipe (titulaire ou membre), module
// Évènements souscrit, évènement de l'organisation confirmé (ou en préparation, ou réalisé) et daté ;
// pour une écriture, même origine que l'app. Sinon une réponse JSON, sans dire si l'évènement existe ;
// une session expirée répond 401 (le téléphone garde sa file et invite à se reconnecter).
// Lot 52 (EVT-06 ; D2, D3 ; ADR 0094) : une Planner qui ne voit pas l'évènement (réglage de visibilité)
// reçoit la réponse d'un évènement inexistant ; le renfort du jour J y entre par la session de son lien,
// pour son seul évènement et ses dates. Un lien retiré ou expiré répond 401 « link », que l'appareil
// montre au renfort ; ses actions en file attendent, refusées.
import { isSameOrigin } from "@/lib/uploads/receive";
import { resolveDayOfViewer, type DayOfViewer } from "@/lib/day-of/viewer";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { getEvent, type EventDetail } from "@/modules/events/service";
import { isDayOfOpen } from "./day-of-view";

export type DayOfAccess =
  | { ok: true; organizationId: string; userId: string | null; linkId: string | null; viewer: DayOfViewer; event: EventDetail & { eventDate: string } }
  | { ok: false; response: Response };

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function dayOfAccess(request: Request, eventId: string, options: { write: boolean }): Promise<DayOfAccess> {
  if (options.write && !isSameOrigin(request.headers)) return { ok: false, response: json(403, { error: "origin" }) };
  if (!isValidId(eventId)) return { ok: false, response: json(404, { error: "not_found" }) };
  const resolved = await resolveDayOfViewer(eventId);
  if ("refused" in resolved) {
    if (resolved.refused === "link") return { ok: false, response: json(401, { error: "link" }) };
    if (resolved.refused === "not_found") return { ok: false, response: json(404, { error: "not_found" }) };
    return { ok: false, response: json(401, { error: "session" }) };
  }
  const { viewer } = resolved;
  if (!(await isEventsModuleEnabled(viewer.organizationId))) return { ok: false, response: json(404, { error: "not_found" }) };
  const event = await getEvent(viewer.organizationId, eventId);
  if (!event || !isDayOfOpen(event)) return { ok: false, response: json(404, { error: "not_found" }) };
  return {
    ok: true,
    organizationId: viewer.organizationId,
    userId: viewer.kind === "team" ? viewer.userId : null,
    linkId: viewer.kind === "helper" ? viewer.linkId : null,
    viewer,
    event: event as EventDetail & { eventDate: string },
  };
}
