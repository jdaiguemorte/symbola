// Lot 52 (EVT-06, SEC-12, SEC-13 ; D2 ; ADR 0094) — ce qu'une personne de l'équipe voit des évènements :
// tout pour la Propriétaire, et pour les Planners quand le réglage « toutes les Planners voient tous les
// évènements » est activé (par défaut) ; sinon, seulement les évènements de son équipe. Un évènement
// hors de vue répond comme un évènement inexistant.
import { appDatabase } from "@symbola/db/client";
import { canViewEvent, visibleEventIds } from "@/modules/events/service";
import { getEventVisibility } from "@/modules/hub/service";

type Viewer = { user: { id: string; role: string; organizationId: string } };

async function viewerOf(auth: Viewer) {
  const { allPlannersSeeAll } = await getEventVisibility(appDatabase(), auth.user.organizationId);
  return { userId: auth.user.id, role: auth.user.role === "owner" ? ("owner" as const) : ("member" as const), allPlannersSeeAll };
}

// null : tous les évènements de l'organisation.
export async function visibleEventScope(auth: Viewer): Promise<Set<string> | null> {
  return visibleEventIds(auth.user.organizationId, await viewerOf(auth));
}

export async function canSeeEvent(auth: Viewer, eventId: string): Promise<boolean> {
  return canViewEvent(auth.user.organizationId, await viewerOf(auth), eventId);
}

export function withinScope<T>(scope: Set<string> | null, rows: T[], idOf: (row: T) => string | null): T[] {
  return scope ? rows.filter((row) => {
    const id = idOf(row);
    return id === null || scope.has(id);
  }) : rows;
}
