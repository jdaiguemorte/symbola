// HUB-02 — bloc « Tâches » de l'accueil : tâches non faites en retard ou
// dues dans les 14 jours, triées par échéance, avec le nom de l'événement ;
// cocher une tâche la marque faite dans le module Événements.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { listOrganizationTasks } from "@/modules/events/service";
import { toggleEventTaskAction } from "@/app/events/[id]/task-actions";

// Horizon du bloc (PRD : « 14 jours, proposé »).
const HORIZON_DAYS = 14;

export async function UpcomingTasksBlock({ organizationId, locale, today }: { organizationId: string; locale: Locale; today: string }) {
  const t = await getTranslations("Home");
  const tEvents = await getTranslations("Events");
  const tasks = await listOrganizationTasks({ organizationId, today, horizonDays: HORIZON_DAYS });

  return (
    <section className="card" aria-labelledby="upcoming-tasks-title" data-tour="home-tasks">
      <div className="section-head">
        <h2 id="upcoming-tasks-title">{t("upcomingTasksTitle")}</h2>
        <Link href="/taches">{t("allTasksLink")}</Link>
      </div>
      {tasks.length === 0 ? <p>{t("upcomingTasksEmpty")}</p> : null}
      <ul className="task-checklist">
        {tasks.map((task) => (
          <li key={task.id}>
            <form action={toggleEventTaskAction} className="task-check">
              <input type="hidden" name="eventId" value={task.eventId} />
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="done" value="true" />
              <button type="submit" aria-pressed={false} aria-label={tEvents("markTaskDone", { label: task.label })} />
            </form>
            <span>
              {task.label}
              <Link href={`/events/${task.eventId}?onglet=retroplanning`} className="task-checklist-event">
                {task.event.names}
              </Link>
            </span>
            <span className={task.overdue ? "text-overdue" : "task-checklist-due"}>
              {task.overdue ? tEvents("taskStatusOverdue") + " · " : ""}
              {formatCalendarDate(task.dueDate, locale)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
