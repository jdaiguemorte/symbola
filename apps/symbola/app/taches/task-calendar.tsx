// Lot 32b (CHR-03 ; décision D11) — les tâches d'un mois en calendrier, du lundi au dimanche :
// chaque tâche est à son échéance et ouvre son évènement (rétroplanning, tâche choisie). Sur
// téléphone, la grille devient une liste des seuls jours qui ont des tâches.
// Lot 63d (CHR-03) : chaque tâche porte sa catégorie (pastille et libellé) et s'ouvre dans la fenêtre de
// l'écran « Tâches ».
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, formatMonth, type Locale } from "@symbola/i18n";
import { addMonths } from "@/app/agenda/calendar";
import { monthGrid } from "@/lib/portfolio/portfolio";
import type { TaskCategory } from "@/modules/events/service";
import { CategorySwatch } from "./category-swatch";

// Lot 70d (CHR-10) : la liste unique, tâches hors évènement comprises.
export type CalendarTask = { id: string; label: string; dueDate: string; done: boolean; overdue: boolean; event: { names: string } | null; categoryId: string | null; priority: string };

export async function TaskCalendar({
  month,
  tasks,
  today,
  locale,
  href,
  taskHref,
  categories,
}: {
  month: string;
  tasks: CalendarTask[];
  today: string;
  locale: Locale;
  href: (month: string) => string;
  taskHref: (task: CalendarTask) => string;
  categories: TaskCategory[];
}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const t = await getTranslations("Events");
  const tLine = await getTranslations("TaskLine");
  const tHome = await getTranslations("Home");
  const weekdays = tHome.raw("agendaWeekdays") as string[];
  const byDate = new Map<string, CalendarTask[]>();
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
                      <Link href={taskHref(task)} scroll={false}>
                        {task.label}
                      </Link>
                      <span className="task-calendar-event">{task.event?.names ?? tLine("noEvent")}</span>
                      {task.categoryId && categoryById.get(task.categoryId) ? (
                        <span className="task-category">
                          <CategorySwatch color={categoryById.get(task.categoryId)!.color} />
                          {categoryById.get(task.categoryId)!.label}
                        </span>
                      ) : null}
                      {task.priority === "high" ? <span className="badge badge-ambre">{t("taskPriorityHigh")}</span> : null}
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
