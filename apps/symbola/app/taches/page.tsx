// PRD-HUB-02 / PRD-EVT-04 — écran « Tâches » : les tâches de tous les événements en
// cours (hors perdus et réalisés), en tableau, filtrables par état et par
// responsable. Cocher une tâche ici la marque faite sur sa fiche.
import { PageHeader } from "@/app/ui/page-header";
import { EmptyState } from "@/app/ui/empty-state";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { listOrganizationTasks, listStandaloneTasks } from "@/modules/events/service";
import { AddStandaloneTaskForm } from "./standalone-tasks";
import { completeStandaloneTaskAction, deleteStandaloneTaskAction } from "./standalone-actions";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { SettingsLink } from "@/app/settings-link";
import { TaskTable } from "./task-table";
import { TaskCalendar } from "./task-calendar";
import { responsibleLabels } from "@/lib/vocabulary";

type SearchParams = { vue?: string; qui?: string; affichage?: string; mois?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("allTasksTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const query = await searchParams;
  const view = query.vue === "en-retard" || query.vue === "toutes" ? query.vue : "a-faire";
  const owner = query.qui === "planner" || query.qui === "clients" ? query.qui : "tous";
  const locale = (await getLocale()) as Locale;
  const today = parisToday();
  const all = await listOrganizationTasks({ organizationId, today, horizonDays: null, includeDone: view === "toutes" });
  const labelOf = await responsibleLabels(organizationId, locale);
  const tasks = all.filter((task) => (owner === "tous" || task.responsible === owner) && (view !== "en-retard" || task.overdue));
  // Lot 32b (CHR-03, D11) : liste ou calendrier du mois ; le filtre « qui » vaut pour les deux.
  const calendar = query.affichage === "calendrier";
  const month = query.mois && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.mois) ? query.mois : today.slice(0, 7);
  const href = (changes: Record<string, string>) =>
    `/taches?${new URLSearchParams({ vue: view, qui: owner, ...(calendar ? { affichage: "calendrier", mois: month } : {}), ...changes }).toString()}`;
  const overdue = all.filter((task) => task.overdue).length;
  // Lot 53 (CHR-10, D6) : les tâches hors évènement (TVA, assurance…), avec leur répétition.
  const standalone = await listStandaloneTasks(organizationId, { includeDone: view === "toutes" });
  const tStandalone = await getTranslations("StandaloneTasks");

  return (
    <main>
      <PageHeader
        title={t("allTasksTitle")}
        subtitle={<span>{t("allTasksSummary", { count: all.filter((task) => !task.done).length, overdue })}</span>}
        actions={<SettingsLink href="/events/modeles" back="tasks" label={t("taskTemplatesSettings")} />}
      />
      <ScreenHelp title={tHelp("allTasks.title")} body={tHelp("allTasks.body")} />
      <section className="card" aria-labelledby="all-tasks-title">
        <h2 id="all-tasks-title" className="sr-only">
          {t("allTasksTitle")}
        </h2>
        <nav aria-label={t("tasksDisplayLabel")} className="segmented">
          <Link href={`/taches?${new URLSearchParams({ vue: view, qui: owner }).toString()}`} aria-current={calendar ? undefined : "page"}>
            {t("viewList")}
          </Link>
          <Link href={`/taches?${new URLSearchParams({ vue: view, qui: owner, affichage: "calendrier", mois: month }).toString()}`} aria-current={calendar ? "page" : undefined}>
            {t("viewCalendar")}
          </Link>
        </nav>
        <div className="toolbar">
          <nav aria-label={t("tasksViewFilter")} className="pills">
            {(["a-faire", "en-retard", "toutes"] as const).map((key) => (
              <Link key={key} href={href({ vue: key })} aria-current={view === key ? "true" : undefined}>
                {t(key === "toutes" ? "tasksViewAll" : key === "a-faire" ? "tasksViewTodo" : "tasksViewOverdue")}
              </Link>
            ))}
          </nav>
          <nav aria-label={t("tasksOwnerFilter")} className="pills">
            {(["tous", "planner", "clients"] as const).map((key) => (
              <Link key={key} href={href({ qui: key })} aria-current={owner === key ? "true" : undefined}>
                {t(key === "tous" ? "tasksOwnerAll" : key === "planner" ? "responsiblePlanner" : "responsibleClients")}
              </Link>
            ))}
          </nav>
        </div>
        {calendar ? <TaskCalendar month={month} tasks={tasks} today={today} locale={locale} href={(next) => href({ mois: next })} /> : null}
        {/* Lot 39c (UX-08) : l'écran vide enseigne. */}
        {!calendar && tasks.length === 0 ? all.length === 0 && view !== "toutes" ? <EmptyState screen="tasks" title={t("allTasksEmpty")} actionHref="/events" /> : <p>{t("noTasksForFilter")}</p> : null}
        {!calendar && tasks.length > 0 ? (
          <TaskTable
            tasks={tasks}
            locale={locale}
            today={today}
            caption={t("allTasksTitle")}
            showEvent
            editHref={(task) => `/events/${task.eventId}?onglet=retroplanning&tache=${task.id}`}
            responsibleLabel={(task) => labelOf(task.eventId, task.responsible)}
          />
        ) : null}
      </section>
      <section className="card" aria-labelledby="standalone-tasks-title" id="hors-evenement">
        <h2 id="standalone-tasks-title">{tStandalone("title")}</h2>
        <ScreenHelp title={tHelp("standaloneTasks.title")} body={tHelp("standaloneTasks.body")} />
        <p>{tStandalone("intro")}</p>
        <AddStandaloneTaskForm today={today} />
        {standalone.length === 0 ? (
          <p>{tStandalone("empty")}</p>
        ) : (
          <ul className="standalone-task-list" aria-label={tStandalone("listLabel")}>
            {standalone.map((task) => (
              <li key={task.id} className="standalone-task" data-overdue={!task.done && task.dueDate < today ? "true" : undefined}>
                <span className="standalone-task-label">{task.label}</span>
                <span className="standalone-task-meta">
                  {formatCalendarDate(task.dueDate, locale)}
                  {task.recurrence ? ` · ${tStandalone(`recurrenceValue.${task.recurrence}`)}` : ""}
                </span>
                {task.done ? (
                  <span className="badge badge-sauge">{tStandalone("done")}</span>
                ) : (
                  <form action={completeStandaloneTaskAction}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <button type="submit" aria-label={tStandalone("doneLabel", { label: task.label })}>
                      {tStandalone("done")}
                    </button>
                  </form>
                )}
                <form action={deleteStandaloneTaskAction}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <button type="submit" className="button-secondary" aria-label={tStandalone("removeLabel", { label: task.label })}>
                    {tStandalone("remove")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
