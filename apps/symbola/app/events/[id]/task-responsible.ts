// EVT-04 — clés de traduction des responsables de tâche, partagées entre
// la fiche (composant serveur) et les formulaires (composants client).
import type { TaskResponsible } from "@/modules/events/service";

export const RESPONSIBLE_LABEL_KEYS: Record<TaskResponsible, string> = {
  planner: "responsiblePlanner",
  clients: "responsibleClients",
};
