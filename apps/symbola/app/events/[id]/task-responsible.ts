// PRD-EVT-04 — clés de traduction des responsables de tâche, partagées entre
// la fiche (composant serveur) et les formulaires (composants client).
import type { EventTask, TaskResponsible } from "@/modules/events/service";

export const RESPONSIBLE_LABEL_KEYS: Record<TaskResponsible, string> = {
  planner: "responsiblePlanner",
  clients: "responsibleClients",
  vendor: "responsibleVendor",
};

// Valeur du choix : « planner », « clients » ou « vendor:<id du prestataire retenu> » (lot 34b).
export function responsibleValue(task: Pick<EventTask, "responsible" | "vendorCandidateId">): string {
  return task.responsible === "vendor" && task.vendorCandidateId ? `vendor:${task.vendorCandidateId}` : task.responsible;
}
