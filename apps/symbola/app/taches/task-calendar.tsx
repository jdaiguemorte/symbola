// Lot 32b (CHR-03 ; décision D11) — les tâches d'un mois en calendrier, du lundi au dimanche :
// chaque tâche est à son échéance et ouvre son évènement (rétroplanning, tâche choisie). Sur
// téléphone, la grille devient une liste des seuls jours qui ont des tâches.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, formatMonth, type Locale } from "@symbola/i18n";
import type { OrganizationTask } from "@symbola/contracts";
import { addMonths } from "@/app/agenda/calendar";
import { monthGrid } from "@/lib/portfolio/portfolio";

export async function TaskCalendar({
  month,
  tasks,
  today,
  locale,
  href,
}: {
  month: string;
  tasks: OrganizationTask[];
  today: string;
  locale: Locale;
  href: (month: string) => string;
}) {
  const t = await getTranslations("Events");
  const tHome = await getTranslations("Home");
  const weekdays = tHome.raw("agendaWeekdays") as string[];
  const byDate = new Map<string, OrganizationTask[]>();
  for (const task of tasks) byDate.set(task.dueDate, [...(byDate.get(task.dueDate) ?? []), task]);
  const inMonth = tasks.filter((task) => task.dueDate.startsWith(month)).length;
  return (
    <section className="task-calendar" aria-labelledby="task-calendar-title">
      <div className="section-head">
        <h2 id="task-calendar-title">{formatMonth(`${month}-01`, locale)}</h2>
        <nav aria-label={t("taskCalendarNavigate")} className="toolbar">
          <Link href={href(addMonths(month, -1))} className="button-link" aria-label={t("taskCalendarPrevious")}>
            ‹
          </Link>
          <Link href={href(today.slice(0, 7))} className="button-link">
            {t("taskCalendarToday")}
          </Link>
          <Link href={href(addMonths(month, 1))} className="button-link" aria-label={t("taskCalendarNext")}>
            ›
          </Link>
        </nav>
      </div>
      <p className="meta">{t("taskCalendarCount", { count: inMonth })}</p>
      <div className="task-calendar-weekdays" aria-hidden="true">
        {weekdays.map((day, index) => (
          <span key={index}>{day}</span>
        ))}
      </div>
      <ol className="task-calendar-grid">
        {monthGrid(month).map((cell, index) => {
          if (!cell) return <li key={`empty-${index}`} className="task-calendar-empty" aria-hidden="true" />;
          const dayTasks = byDate.get(cell.date) ?? [];
          return (
            <li key={cell.date} className={`task-calendar-day${dayTasks.length === 0 ? " is-free" : ""}${cell.date === today ? " is-today" : ""}${cell.weekend ? " is-weekend" : ""}`}>
              <p className="task-calendar-date">
                <span className="task-calendar-num" aria-hidden="true">
                  {cell.day}
                </span>
                <span className="sr-only">{formatCalendarDate(cell.date, locale)}</span>
                <span className="task-calendar-long" aria-hidden="true">
                  {formatCalendarDate(cell.date, locale)}
                </span>
              </p>
              {dayTasks.length > 0 ? (
                <ul>
                  {dayTasks.map((task) => (
                    <li key={task.id} className={task.done ? "is-done" : task.overdue ? "is-overdue" : undefined}>
                      <Link href={`/events/${task.eventId}?onglet=retroplanning&tache=${task.id}`}>{task.label}</Link>
                      <span className="task-calendar-event">{task.event.names}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
