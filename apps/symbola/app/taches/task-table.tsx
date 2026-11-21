// PRD-EVT-04 / PRD-HUB-02 — tableau des tâches, regroupé par mois, partagé entre le rétroplanning d'un
// évènement et l'écran « Tâches » de l'organisation.
// Lot 63d (CHR-02, CHR-03 ; maquette M6) : sélection, rond « Fait », catégorie, échéance modifiable dans
// la cellule, actions de ligne et actions groupées (task-table-client.tsx) ; ce composant serveur prépare
// les lignes (libellés traduits, dates écrites, adresse de la fenêtre de chaque tâche).
import { getTranslations } from "next-intl/server";
import { formatMonth, formatShortCalendarDate, type Locale } from "@symbola/i18n";
import { monthKey, type EventTask, type TaskCategory } from "@/modules/events/service";
import { postponedDueDate } from "@/lib/tasks/postpone";
import { RESPONSIBLE_LABEL_KEYS } from "@/app/events/[id]/task-responsible";
import { TaskTableClient, type TaskTableMonth } from "./task-table-client";

export type TaskRow = EventTask & { event?: { id: string; names: string } };

export async function TaskTable({
  tasks,
  locale,
  today,
  caption,
  showEvent = false,
  selectedTaskId,
  openHref,
  responsibleLabel,
  categories,
}: {
  tasks: TaskRow[];
  locale: Locale;
  today: string;
  caption: string;
  showEvent?: boolean;
  selectedTaskId?: string | null;
  // Adresse de l'écran courant qui ouvre la fenêtre de la tâche (lot 63d, Q42 bis).
  openHref: (task: TaskRow) => string;
  // Lot 20 (décision 6) : libellé dans le vocabulaire de l'événement de la ligne.
  responsibleLabel?: (task: TaskRow) => string;
  categories: TaskCategory[];
}) {
  const t = await getTranslations("Events");
  // Lot 39c (UX-07) : les textes du bandeau « Annuler », les mêmes que sur « Aujourd'hui ».
  const tToday = await getTranslations("Today");
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const months = new Map<string, TaskTableMonth>();
  const undoMessages: Record<string, { done: string; reopened: string }> = {};
  for (const task of tasks) {
    const key = monthKey(task.dueDate);
    const month = months.get(key) ?? { key, label: formatMonth(`${key}-01`, locale), rows: [] };
    const category = task.categoryId ? categoryById.get(task.categoryId) : undefined;
    month.rows.push({
      id: task.id,
      eventId: task.eventId,
      label: task.label,
      dueDate: task.dueDate,
      dueLabel: formatShortCalendarDate(task.dueDate, locale),
      done: task.done,
      overdue: !task.done && task.dueDate < today,
      priority: task.priority,
      category: category ? { label: category.label, color: category.color } : null,
      responsibleLabel: responsibleLabel ? responsibleLabel(task) : t(RESPONSIBLE_LABEL_KEYS[task.responsible]),
      responsibleKind: task.responsible,
      event: task.event ? { names: task.event.names, href: `/events/${task.event.id}?onglet=retroplanning` } : null,
      href: openHref(task),
    });
    months.set(key, month);
    undoMessages[task.id] = { done: tToday("undo.taskDone", { label: task.label }), reopened: tToday("undo.taskReopened", { label: task.label }) };
  }
  const now = new Date();
  return (
    <TaskTableClient
      months={[...months.values()]}
      caption={caption}
      showEvent={showEvent}
      selectedTaskId={selectedTaskId ?? null}
      categories={categories.map((category) => ({ value: category.id, label: category.label }))}
      postponeDates={{ tomorrow: formatShortCalendarDate(postponedDueDate("tomorrow", now), locale), nextWeek: formatShortCalendarDate(postponedDueDate("next_week", now), locale) }}
      undoMessages={undoMessages}
    />
  );
}
