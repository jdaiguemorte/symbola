// Lot 51 (JRJ-08 ; D4, ADR 0091) — l'état partagé du jour J, relu par le téléphone toutes les 15
// secondes en ligne et à chaque retour au premier plan : pointages (première heure retenue),
// décalages, incidents, listes, remises, et les heures du programme après décalage. Jamais en cache.
import { getDayState, getEventProgram } from "@/modules/events/service";
import { listDayHandovers } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { dayOfAccess } from "../access";

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }): Promise<Response> {
  const { eventId } = await params;
  const access = await dayOfAccess(request, eventId, { write: false });
  if (!access.ok) return access.response;
  const { organizationId } = access;
  const [state, program, handovers] = await Promise.all([
    getDayState(organizationId, eventId),
    getEventProgram(organizationId, eventId),
    (await isBudgetModuleEnabled(organizationId)) ? listDayHandovers(organizationId, eventId) : Promise.resolve(null),
  ]);
  if (!state) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(
    { state, items: program.items.map((item) => ({ id: item.id, startTime: item.startTime, endTime: item.endTime, keyMomentId: item.keyMomentId })), handovers },
    { headers: { "Cache-Control": "no-store" } },
  );
}
