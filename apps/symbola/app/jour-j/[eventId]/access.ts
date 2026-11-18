// Lot 51 (JRJ-05 à JRJ-09, ARC-09, SEC-12, SEC-13 ; ADR 0091) — accès commun aux routes du jour J de
// terrain (file d'actions, photos, état partagé) : session de l'équipe (titulaire ou membre), module
// Évènements souscrit, évènement de l'organisation confirmé (ou en préparation, ou réalisé) et daté ;
// pour une écriture, même origine que l'app. Sinon une réponse JSON, sans dire si l'évènement existe ;
// une session expirée répond 401 (le téléphone garde sa file et invite à se reconnecter).
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isSameOrigin } from "@/lib/uploads/receive";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { getEvent, type EventDetail } from "@/modules/events/service";
import { isDayOfOpen } from "./day-of-view";

export type DayOfAccess = { ok: true; organizationId: string; userId: string; event: EventDetail & { eventDate: string } } | { ok: false; response: Response };

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function dayOfAccess(request: Request, eventId: string, options: { write: boolean }): Promise<DayOfAccess> {
  if (options.write && !isSameOrigin(request.headers)) return { ok: false, response: json(403, { error: "origin" }) };
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { ok: false, response: json(401, { error: "session" }) };
  const organizationId = auth.user.organizationId;
  if (!isValidId(eventId) || !(await isEventsModuleEnabled(organizationId))) return { ok: false, response: json(404, { error: "not_found" }) };
  const event = await getEvent(organizationId, eventId);
  if (!event || !isDayOfOpen(event)) return { ok: false, response: json(404, { error: "not_found" }) };
  return { ok: true, organizationId, userId: auth.user.id, event: event as EventDetail & { eventDate: string } };
}
