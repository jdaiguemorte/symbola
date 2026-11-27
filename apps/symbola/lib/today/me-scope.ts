// Lot 72a (HUB-08, PAR-10 ; J3) — ce que lit la portée « Moi » (scope.ts) : le nombre de membres actifs de
// l'organisation (Propriétaire et Planners) et le planner principal de chaque évènement, par le service du
// module events (ADR 0011). La bascule « Moi · L'agence » qui l'applique arrive au paquet 72c.
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { listEventLeads } from "@/modules/events/service";
import type { MeScopeInput } from "./scope";

export async function loadMeScope(organizationId: string, userId: string, eventIds: string[]): Promise<MeScopeInput> {
  const [team, leads] = await Promise.all([listTeam(appDatabase(), organizationId), listEventLeads(organizationId, eventIds)]);
  const activeMembers = team.filter((member) => !member.disabledAt && (member.role === "owner" || member.role === "member")).length;
  return { userId, activeMembers, leads };
}
