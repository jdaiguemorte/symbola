// PRD-EVT-04 — clés de traduction des responsables de tâche, partagées entre
// la fiche (composant serveur) et les formulaires (composants client).
// Lot 70a (CHR-02 ; A1, A3, A4) : « Qui s'en charge » nomme aussi chaque collègue (« member:<id> »).
import type { EventTask, TaskResponsible } from "@/modules/events/service";

export const RESPONSIBLE_LABEL_KEYS: Record<TaskResponsible, string> = {
  planner: "responsiblePlanner",
  clients: "responsibleClients",
  vendor: "responsibleVendor",
};

// Lot 70a (A1, A4) : un collègue proposé dans « Qui s'en charge » — son nom (prénom et nom, sinon le
// début de l'adresse), « Vous » pour la personne qui regarde, et un accès retiré (sa tâche reste à son nom).
export type TaskMemberOption = { id: string; name: string; me: boolean; removed: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESPONSIBLES: readonly string[] = ["planner", "clients", "vendor"];

// Valeur du choix : « member:<id du membre> », « planner » (personne de nommé), « clients » ou
// « vendor:<id du prestataire retenu> » (lot 34b).
export function responsibleValue(task: Pick<EventTask, "responsible" | "vendorCandidateId"> & { assigneeUserId?: string | null }): string {
  if (task.responsible === "vendor" && task.vendorCandidateId) return `vendor:${task.vendorCandidateId}`;
  if (task.responsible === "planner" && task.assigneeUserId) return `member:${task.assigneeUserId}`;
  return task.responsible;
}

export type ResponsibleChoice = { responsible: TaskResponsible; vendorCandidateId: string | null; assigneeUserId?: string };

// Lit le choix envoyé par un formulaire ; null : valeur inconnue. Le membre est vérifié par le service
// (membre actif de l'organisation), jamais ici.
export function readResponsibleValue(value: string): ResponsibleChoice | null {
  if (value.startsWith("vendor:")) {
    const vendorCandidateId = value.slice("vendor:".length);
    return UUID.test(vendorCandidateId) ? { responsible: "vendor", vendorCandidateId } : null;
  }
  if (value.startsWith("member:")) {
    const assigneeUserId = value.slice("member:".length);
    return UUID.test(assigneeUserId) ? { responsible: "planner", vendorCandidateId: null, assigneeUserId } : null;
  }
  return value !== "vendor" && RESPONSIBLES.includes(value) ? { responsible: value as TaskResponsible, vendorCandidateId: null } : null;
}
