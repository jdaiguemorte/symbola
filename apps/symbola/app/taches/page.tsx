// PRD-HUB-02 / PRD-EVT-04 — écran « Tâches » : les tâches de tous les événements en
// cours (hors perdus et réalisés), filtrables par état et par responsable. Cocher une tâche
// ici la marque faite sur sa fiche.
// Lot 63d (CHR-02, CHR-03 ; maquette M6) : la tâche s'ouvre sur cet écran (« ?tache= »), sans partir
// vers l'évènement.
// Lot 70c (CHR-02, CHR-03, CHR-10, UX-05 ; D3, C-31, C-38) : la ligne type (titre, évènement, échéance et
// son état, qui s'en charge, « Fait », menu « ⋯ ») et le panneau unique, en édition (« ?tache= ») et en
// création (« ?nouvelle=1 », avec ou sans évènement) ; la vue « Faites » (« Les revoir » d'« Aujourd'hui »).
// La liste unique, les filtres et le décompte de la maquette viennent au paquet 70d.
import { PageHeader } from "@/app/ui/page-header";
import { EmptyState } from "@/app/ui/empty-state";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { parisToday, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { listOrganizationTasks, listTasks } from "@/modules/events/service";
import { ensureTaskCategories } from "@/lib/events/task-categories";
import { isValidId } from "@/app/events/module-access";
import { requirePlanner } from "@/lib/guards";
import { taskMemberOptions } from "@/lib/tasks/members";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { SettingsLink } from "@/app/settings-link";
import { countTasks } from "@/lib/task-counts";
import { TaskCalendar } from "./task-calendar";
import { TaskLineBoard } from "@/app/ui/task-line-board";
import { TaskLineList } from "@/app/ui/task-line";
import { TaskPanelLoader, panelFromQuery } from "@/app/ui/task-panel-loader";
import { buildTaskLines, linesByMonth } from "@/lib/tasks/task-lines";
import { taskListViewer } from "@/lib/event-visibility";

type SearchParams = { vue?: string; qui?: string; affichage?: string; mois?: string; tache?: string; nouvelle?: string; evenement?: string; copie?: string };

const VIEWS = ["a-faire", "en-retard", "faites", "toutes"] as const;
type View = (typeof VIEWS)[number];

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const tLine = await getTranslations("TaskLine");
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
  const view: View = VIEWS.includes(query.vue as View) ? (query.vue as View) : "a-faire";
  const owner = query.qui === "planner" || query.qui === "clients" ? query.qui : "tous";
  const locale = (await getLocale()) as Locale;
  const today = parisToday();
  const withDone = view === "toutes" || view === "faites";
  const all = await listOrganizationTasks({ organizationId, today, horizonDays: null, includeDone: withDone });
  const tasks = all.filter((task) => (owner === "tous" || task.responsible === owner) && (view !== "en-retard" || task.overdue) && (view !== "faites" || task.done));
  // Lot 32b (CHR-03, D11) : liste ou calendrier du mois ; le filtre « qui » vaut pour les deux.
  const calendar = query.affichage === "calendrier";
  const month = query.mois && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.mois) ? query.mois : today.slice(0, 7);
  const href = (changes: Record<string, string>) =>
    `/taches?${new URLSearchParams({ vue: view, qui: owner, ...(calendar ? { affichage: "calendrier", mois: month } : {}), ...changes }).toString()}`;
  const categories = await ensureTaskCategories(organizationId, locale);
  // Lot 70a (CHR-02 ; A1) : les collègues de « Qui s'en charge ».
  const members = await taskMemberOptions(organizationId, auth.user.id);
  // Lot 53 (CHR-10, D6) : les tâches hors évènement (TVA, assurance…), avec leur répétition ; lot 70c :
  // lues par la liste unique du lot 70a, en lignes types.
  const viewer = await taskListViewer({ user: { id: auth.user.id, role: auth.user.role, organizationId } });
  const standalone = (await listTasks({ organizationId, today, viewer, filters: { event: { kind: "none" }, state: view === "faites" ? "done" : withDone ? "all" : "todo", ...(view === "en-retard" ? { period: { kind: "late" } } : {}) } })).tasks;
  // Lot 67b (HUB-08, CHR-10 ; R01) : l'en-tête compte les tâches d'évènement et hors évènement.
  const openStandalone = view === "a-faire" ? standalone : (await listTasks({ organizationId, today, viewer, filters: { event: { kind: "none" }, state: "todo" } })).tasks;
  const counts = countTasks(all, openStandalone, today);
  const eventLines = await buildTaskLines({ organizationId, locale, tasks, members, href: (task) => href({ tache: task.id }) });
  const standaloneLines = await buildTaskLines({ organizationId, locale, tasks: standalone, members, href: (task) => href({ tache: task.id }) });
  const panel = panelFromQuery(query, isValidId);
  const memberOptions = members.filter((member) => !member.removed).map((member) => ({ value: `member:${member.id}`, label: member.me ? tLine("you") : member.name }));
  const categoryOptions = categories.map((category) => ({ value: category.id, label: category.label }));

  return (
    <main>
      <PageHeader
        title={t("allTasksTitle")}
        subtitle={<span>{t("allTasksSummary", { count: counts.todo, overdue: counts.overdue })}</span>}
        actions={
          <>
            <Link href={href({ nouvelle: "1" })} scroll={false} className="button-link button-link-primary">
              {tLine("newTask")}
            </Link>
            <SettingsLink href="/events/modeles" back="tasks" label={t("taskTemplatesSettings")} />
          </>
        }
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
            {VIEWS.map((key) => (
              <Link key={key} href={href({ vue: key })} aria-current={view === key ? "true" : undefined}>
                {key === "faites" ? tLine("stateDone") : t(key === "toutes" ? "tasksViewAll" : key === "a-faire" ? "tasksViewTodo" : "tasksViewOverdue")}
              </Link>
            ))}
          </nav>
          <nav aria-label={tLine("filterWho")} className="pills">
            {(["tous", "planner", "clients"] as const).map((key) => (
              <Link key={key} href={href({ qui: key })} aria-current={owner === key ? "true" : undefined}>
                {t(key === "tous" ? "tasksOwnerAll" : key === "planner" ? "responsiblePlanner" : "responsibleClients")}
              </Link>
            ))}
          </nav>
        </div>
        {calendar ? <TaskCalendar month={month} tasks={tasks} today={today} locale={locale} href={(next) => href({ mois: next })} taskHref={(task) => href({ tache: task.id })} categories={categories} /> : null}
        {/* Lot 39c (UX-08) : l'écran vide enseigne. */}
        {!calendar && tasks.length === 0 ? all.length === 0 && view === "a-faire" ? <EmptyState screen="tasks" title={t("allTasksEmpty")} actionHref="/events" /> : <p>{t("noTasksForFilter")}</p> : null}
        {!calendar && tasks.length > 0 ? (
          <TaskLineBoard
            groups={linesByMonth(eventLines.lines, locale)}
            form="list"
            label={t("allTasksTitle")}
            shortcuts={eventLines.shortcuts}
            assignOptions={eventLines.assignOptions}
            categories={categoryOptions}
            members={memberOptions}
          />
        ) : null}
      </section>
      {panel ? (
        <TaskPanelLoader
          organizationId={organizationId}
          userId={auth.user.id}
          role={auth.user.role}
          locale={locale}
          today={today}
          open={panel}
          closeHref={href({})}
          backLabel={t("allTasksTitle")}
          screenHref={(params) => href(params)}
        />
      ) : null}
      <section className="card" aria-labelledby="standalone-tasks-title" id="hors-evenement">
        <div className="section-head">
          <h2 id="standalone-tasks-title">{tLine("noEvent")}</h2>
          <Link href={href({ nouvelle: "1" })} scroll={false} className="button-link">
            {tLine("newTask")}
          </Link>
        </div>
        <p>{tLine("noEventHint")}</p>
        {standaloneLines.lines.length === 0 ? null : (
          <TaskLineList groups={linesByMonth(standaloneLines.lines, locale)} form="list" label={tLine("noEvent")} shortcuts={standaloneLines.shortcuts} assignOptions={standaloneLines.assignOptions} />
        )}
      </section>
    </main>
  );
}
