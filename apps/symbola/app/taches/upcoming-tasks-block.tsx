// PRD-HUB-02 — bloc « Tâches » de l'accueil : tâches non faites en retard ou
// dues dans les 14 jours, triées par échéance, avec le nom de l'événement ;
// cocher une tâche la marque faite dans le module Événements. Lot 20
// (décision 4) : les trois premières, chacune menant à son rétroplanning.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { listOrganizationTasks } from "@/modules/events/service";
import { toggleEventTaskAction } from "@/app/events/[id]/task-actions";
import { HOME_BLOCK_LINES } from "@/app/accueil/home-blocks";

// Horizon du bloc (PRD : « 14 jours, proposé »).
const HORIZON_DAYS = 14;

export async function UpcomingTasksBlock({ organizationId, locale, today }: { organizationId: string; locale: Locale; today: string }) {
  const t = await getTranslations("Home");
  const tEvents = await getTranslations("Events");
  const tasks = await listOrganizationTasks({ organizationId, today, horizonDays: HORIZON_DAYS });

  const shown = tasks.slice(0, HOME_BLOCK_LINES);
  return (
    <section className="card home-block" aria-labelledby="upcoming-tasks-title" data-tour="home-tasks" data-urgent={tasks.some((task) => task.overdue) ? "true" : undefined}>
      <div className="section-head">
        <h2 id="upcoming-tasks-title">{t("upcomingTasksTitle")}</h2>
        <Link href="/taches">{t("allTasksLink")}</Link>
      </div>
      {tasks.length === 0 ? <p>{t("upcomingTasksEmpty")}</p> : null}
      <ul className="home-lines">
        {shown.map((task) => (
          <li key={task.id} className="home-line">
            <form action={toggleEventTaskAction} className="task-check">
              <input type="hidden" name="eventId" value={task.eventId} />
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="done" value="true" />
              <button type="submit" aria-pressed={false} aria-label={tEvents("markTaskDone", { label: task.label })} />
            </form>
            <Link href={`/events/${task.eventId}?onglet=retroplanning`} className="home-line-title">
              {task.label}
            </Link>
            <span className="home-line-meta">{task.event.names}</span>
            <span className={task.overdue ? "home-line-when text-overdue" : "home-line-when"}>
              {task.overdue ? tEvents("taskStatusOverdue") + " · " : ""}
              {formatCalendarDate(task.dueDate, locale)}
            </span>
          </li>
        ))}
      </ul>
      {tasks.length > HOME_BLOCK_LINES ? <p className="home-more">{t("moreTasks", { count: tasks.length - HOME_BLOCK_LINES })}</p> : null}
    </section>
  );
}
