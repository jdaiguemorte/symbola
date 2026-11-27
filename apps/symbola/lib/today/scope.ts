// Lot 72a (HUB-08, PAR-10, EVT-06 ; J3 ; critère 5) — la portée « Moi » de l'accueil, dans une agence :
// - une tâche confiée à quelqu'un n'est qu'à cette personne ;
// - les autres lignes d'un évènement (tâches sans personne, tâches des mariés ou d'un prestataire,
//   paiements, relances, décisions, alertes) vont à sa planner principale ; un évènement sans planner
//   principal les donne à tout le monde (J3) ;
// - hors évènement : une tâche à la personne ou à personne ; les autres lignes (doublons, demandes
//   reçues) à tout le monde.
// Une planner seule voit tout. Règle pure ; la visibilité du lot 52 (withinScope) s'applique avant.
import type { TodayItem } from "./rank";

export type MeScopeInput = { userId: string; activeMembers: number; leads: ReadonlyMap<string, string> };

export function meScope<T extends Pick<TodayItem, "eventId" | "task">>(items: T[], input: MeScopeInput): T[] {
  if (input.activeMembers <= 1) return items;
  return items.filter((item) => {
    const assignee = item.task?.assigneeUserId ?? null;
    if (assignee) return assignee === input.userId;
    if (item.eventId === null) return true;
    const lead = input.leads.get(item.eventId);
    return !lead || lead === input.userId;
  });
}
