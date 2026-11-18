// Lot 49 (INV-02, POR-10 ; D5) — la rubrique « Invités » du portail du client : fermée par défaut,
// ouverte par la planner lien par lien, seulement à un lien du client, et seulement si les modules
// Évènements et Invités sont ouverts et l'analyse d'impact confirmée. Le client ne lit et n'écrit
// que les invités de l'évènement de son lien ; jamais de régime nominatif (D8).
import type { LinkAccess } from "@/modules/events/service";
import { getGuestModuleState } from "@/modules/guests/service";
import { isGuestsAvailable } from "@/app/events/[id]/invites/access";
import { currentLinkAccess } from "@/lib/link-session";

export function guestsRubricOpen(access: Pick<LinkAccess, "audience" | "rights">): boolean {
  return access.audience === "client" && access.rights.rubrics.includes("guests");
}

export type PortalGuestsAccess = { organizationId: string; eventId: string; linkId: string };

export async function portalGuestsAccess(): Promise<PortalGuestsAccess | null> {
  const access = await currentLinkAccess();
  if (!access || !guestsRubricOpen(access)) return null;
  if (!(await isGuestsAvailable(access.organizationId))) return null;
  if (!(await getGuestModuleState(access.organizationId)).impactAssessmentConfirmedAt) return null;
  return { organizationId: access.organizationId, eventId: access.eventId, linkId: access.linkId };
}
