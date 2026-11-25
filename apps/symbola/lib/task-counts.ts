// Lot 67b (HUB-08, CHR-03, CHR-10 ; recette du 24/11/2026, R01) — un seul compte des tâches pour le
// menu, la page Tâches et « Aujourd'hui » : les tâches des évènements en cours et les tâches hors
// évènement. Avant, la pastille du menu et l'en-tête de la page ignoraient les secondes, et les trois
// nombres se contredisaient.
import { listOrganizationTasks, listStandaloneTasks } from "@/modules/events/service";

type Dated = { done: boolean; dueDate: string };

// En retard : à faire, échéance passée (le jour même n'est pas en retard).
export function countTasks(eventTasks: readonly (Dated & { overdue: boolean })[], standalone: readonly Dated[], today: string): { todo: number; overdue: number } {
  const open = standalone.filter((task) => !task.done);
  return {
    todo: eventTasks.filter((task) => !task.done).length + open.length,
    overdue: eventTasks.filter((task) => task.overdue).length + open.filter((task) => task.dueDate < today).length,
  };
}

// Pastille « en retard » du menu : seules les tâches échues sont lues.
export async function overdueTaskCount(organizationId: string, today: string): Promise<number> {
  const [eventTasks, standalone] = await Promise.all([listOrganizationTasks({ organizationId, today, horizonDays: 0 }), listStandaloneTasks(organizationId, { until: today })]);
  return countTasks(eventTasks, standalone, today).overdue;
}
