// Lot 55 (POR-06, POR-10 ; ADR 0102) — la rubrique « Messages » du portail : fermée par défaut, ouverte
// par la planner sur le lien d'un client, et seulement si le module Évènements est ouvert. Le service
// relit le lien à chaque appel (valable, rubrique ouverte).
import type { LinkAccess } from "@/modules/events/service";
import { isEventsModuleEnabled } from "@/app/events/module-access";

export function messagesRubricOpen(access: Pick<LinkAccess, "audience" | "rights">): boolean {
  return access.audience === "client" && access.rights.rubrics.includes("messages");
}

// Client : la rubrique ouverte ; prestataire : toujours (il ne voit que les sujets où la planner l'a
// ajouté).
export async function linkMessagingOpen(access: LinkAccess): Promise<boolean> {
  if (access.audience === "client" && !messagesRubricOpen(access)) return false;
  if (access.audience !== "client" && access.audience !== "vendor") return false;
  return isEventsModuleEnabled(access.organizationId);
}
