// Lot 45 (POR-07, POR-10 ; D6 ; ADR 0090) — la rubrique « Questionnaires » du portail : fermée par
// défaut, ouverte sur le lien du client à l'envoi d'un questionnaire, et seulement si le module
// Évènements est ouvert. La personne ne voit que les questionnaires envoyés à son lien, pour
// l'évènement de son lien.
import type { LinkAccess } from "@/modules/events/service";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { currentLinkAccess } from "@/lib/link-session";

export function questionnairesRubricOpen(access: Pick<LinkAccess, "audience" | "rights">): boolean {
  return access.audience === "client" && access.rights.rubrics.includes("questionnaires");
}

export type PortalQuestionnairesAccess = { organizationId: string; eventId: string; linkId: string };

export async function portalQuestionnairesAccess(): Promise<PortalQuestionnairesAccess | null> {
  const access = await currentLinkAccess();
  if (!access || !questionnairesRubricOpen(access)) return null;
  if (!(await isEventsModuleEnabled(access.organizationId))) return null;
  return { organizationId: access.organizationId, eventId: access.eventId, linkId: access.linkId };
}
