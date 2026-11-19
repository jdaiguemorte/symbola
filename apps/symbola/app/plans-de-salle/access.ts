// Lot 60 (L60-PLA-01 à L60-PLA-05 ; ARC-06, ARC-07, SEC-12, SEC-13) — accès aux écrans des plans de
// salle côté équipe : session, organisation, module Plans de salle ouvert (fermé par défaut, ADR 0079),
// et le module dont dépend l'objet : le carnet de prestataires pour un lieu, les évènements pour le
// plan d'un évènement (que la Planner doit pouvoir voir, lot 52). Contrôlé côté serveur à chaque
// requête ; un objet hors de portée répond comme un objet absent.
import { appDatabase } from "@symbola/db/client";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { canSeeEvent } from "@/lib/event-visibility";
import { isModuleEnabled } from "@/modules/hub/service";
import { getLayoutEditor, FloorplanNotFoundError } from "@/modules/floorplans/service";

export type FloorplansAccess = { organizationId: string; userId: string; role: string };

export async function isFloorplansAvailable(organizationId: string, dependsOn: "vendors" | "events"): Promise<boolean> {
  const db = appDatabase();
  return (await isModuleEnabled(db, organizationId, "floorplans")) && (await isModuleEnabled(db, organizationId, dependsOn));
}

export async function floorplansAccess(dependsOn: "vendors" | "events"): Promise<FloorplansAccess | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isFloorplansAvailable(auth.user.organizationId, dependsOn))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id, role: auth.user.role };
}

export async function canSeeFloorplanEvent(access: FloorplansAccess, eventId: string): Promise<boolean> {
  return canSeeEvent({ user: { id: access.userId, role: access.role, organizationId: access.organizationId } }, eventId);
}

// Accès à un plan précis : le module dont il dépend (lieu ou évènement) et, pour un évènement, sa
// visibilité. null : le plan n'existe pas pour cette personne.
export async function layoutAccess(layoutId: string): Promise<(FloorplansAccess & { eventId: string | null }) | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  const organizationId = auth.user.organizationId;
  if (!(await isModuleEnabled(appDatabase(), organizationId, "floorplans"))) return null;
  let eventId: string | null;
  try {
    eventId = (await getLayoutEditor(organizationId, layoutId)).layout.eventId;
  } catch (error) {
    if (error instanceof FloorplanNotFoundError) return null;
    throw error;
  }
  const access = { organizationId, userId: auth.user.id, role: auth.user.role };
  if (!(await isFloorplansAvailable(organizationId, eventId ? "events" : "vendors"))) return null;
  if (eventId && !(await canSeeFloorplanEvent(access, eventId))) return null;
  return { ...access, eventId };
}
