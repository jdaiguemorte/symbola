// HUB-02 / EVT-04 — écran « Tâches » : les tâches de tous les événements en
// cours (hors perdus et réalisés), en tableau, filtrables par état et par
// responsable. Cocher une tâche ici la marque faite sur sa fiche.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { parisToday, type Locale } from "@symbola/i18n";
import { HelpButton } from "@symbola/ui";
import { listOrganizationTasks } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { GearLink } from "@/app/gear-link";
import { TaskTable } from "./task-table";

type SearchParams = { vue?: string; qui?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
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
  const tasks = all.filter((task) => (owner === "tous" || task.responsible === owner) && (view !== "en-retard" || task.overdue));
  const href = (changes: Record<string, string>) => `/taches?${new URLSearchParams({ vue: view, qui: owner, ...changes }).toString()}`;
  const overdue = all.filter((task) => task.overdue).length;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>{t("allTasksTitle")}</h1>
          <p className="meta">
            <span>{t("allTasksSummary", { count: all.filter((task) => !task.done).length, overdue })}</span>
          </p>
        </div>
        <div className="toolbar">
          <HelpButton title={tHelp("allTasks.title")} body={tHelp("allTasks.body")} />
          <GearLink href="/events/modeles" label={t("taskTemplatesSettings")} />
        </div>
      </div>
      <section className="card" aria-labelledby="all-tasks-title">
        <h2 id="all-tasks-title" className="sr-only">
          {t("allTasksTitle")}
        </h2>
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
        {tasks.length === 0 ? <p>{all.length === 0 && view !== "toutes" ? t("allTasksEmpty") : t("noTasksForFilter")}</p> : null}
        {tasks.length > 0 ? (
          <TaskTable
            tasks={tasks}
            locale={locale}
            today={today}
            caption={t("allTasksTitle")}
            showEvent
            editHref={(task) => `/events/${task.eventId}?onglet=retroplanning&tache=${task.id}`}
          />
        ) : null}
      </section>
    </main>
  );
}
