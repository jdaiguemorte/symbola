// PRD-EVT-04 / PRD-HUB-02 — tableau des tâches (maquette validée) : Fait · Tâche ·
// Échéance · Qui la réalise · Statut, regroupé par mois. Partagé entre le
// rétroplanning d'un événement et l'écran « Tâches » de l'organisation.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, formatMonth, type Locale } from "@symbola/i18n";
import { monthKey, type EventTask } from "@/modules/events/service";
import { TaskCheck } from "./task-check";
import { RESPONSIBLE_LABEL_KEYS } from "@/app/events/[id]/task-responsible";

export type TaskRow = EventTask & { event?: { id: string; names: string } };

export async function TaskTable({
  tasks,
  locale,
  today,
  caption,
  showEvent = false,
  selectedTaskId,
  editHref,
  responsibleLabel,
}: {
  tasks: TaskRow[];
  locale: Locale;
  today: string;
  caption: string;
  showEvent?: boolean;
  selectedTaskId?: string | null;
  editHref?: (task: TaskRow) => string;
  // Lot 20 (décision 6) : libellé dans le vocabulaire de l'événement de la ligne.
  responsibleLabel?: (task: TaskRow) => string;
}) {
  const t = await getTranslations("Events");
  const months = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    const key = monthKey(task.dueDate);
    months.set(key, [...(months.get(key) ?? []), task]);
  }
  const columns = showEvent ? 6 : 5;

  return (
    <div role="region" aria-label={t("taskTableRegion", { caption })} tabIndex={0}>
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t("taskColumnDone")}</th>
            <th scope="col">{t("taskColumnLabel")}</th>
            {showEvent ? <th scope="col">{t("taskColumnEvent")}</th> : null}
            <th scope="col">{t("taskColumnDue")}</th>
            <th scope="col">{t("taskColumnResponsible")}</th>
            <th scope="col">{t("taskColumnStatus")}</th>
          </tr>
        </thead>
        {[...months.entries()].map(([month, monthTasks]) => (
          <tbody key={month}>
            <tr className="month-row">
              <th scope="colgroup" colSpan={columns}>
                {formatMonth(`${month}-01`, locale)}
              </th>
            </tr>
            {monthTasks.map((task) => {
              const overdue = !task.done && task.dueDate < today;
              return (
                <tr key={task.id} aria-current={task.id === selectedTaskId ? "true" : undefined}>
                  <td>
                    <TaskCheck eventId={task.eventId} taskId={task.id} done={task.done} labelDone={t("markTaskDone", { label: task.label })} labelUndone={t("markTaskUndone", { label: task.label })} />
                  </td>
                  <th scope="row" className={task.done ? "done" : undefined}>
                    {editHref ? <Link href={editHref(task)}>{task.label}</Link> : task.label}
                  </th>
                  {showEvent ? (
                    <td>{task.event ? <Link href={`/events/${task.event.id}?onglet=retroplanning`}>{task.event.names}</Link> : null}</td>
                  ) : null}
                  <td className={overdue ? "nowrap text-overdue" : "nowrap"}>{formatCalendarDate(task.dueDate, locale)}</td>
                  <td>
                    <span className={task.responsible === "clients" ? "badge badge-ambre" : "badge badge-bleu"}>
                      {responsibleLabel ? responsibleLabel(task) : t(RESPONSIBLE_LABEL_KEYS[task.responsible])}
                    </span>
                  </td>
                  <td>
                    <span className={task.done ? "badge badge-sauge" : overdue ? "badge badge-terracotta" : "badge"}>
                      {task.done ? t("taskStatusDone") : overdue ? t("taskStatusOverdue") : t("taskStatusTodo")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
