// PRD-HUB-02 / PRD-EVT-04 — écran « Tâches » : les tâches de tous les événements en cours.
// Lot 63d (CHR-02, CHR-03 ; maquette M6) : la tâche s'ouvre sur cet écran (« ?tache= »), sans partir
// vers l'évènement.
// Lot 70c (CHR-02, CHR-03, CHR-10, UX-05 ; D3, C-31, C-38) : la ligne type et le panneau unique, en édition
// (« ?tache= ») et en création (« ?nouvelle=1 », avec ou sans évènement).
// Lot 70d (CHR-02, CHR-03, CHR-04, CHR-10, PAR-10, UX-03, UX-07, UX-08, UX-12, UX-15 ; C-31, C-33, C-14, C-37,
// C-40, C-55, D1, M2 ; page 2 des maquettes du lot 68) : « Nouvelle tâche » en haut, seule action principale ;
// une liste unique, tâches hors évènement comprises, filtrée dans la base (Évènement, Qui s'en charge,
// Période, Catégorie, État) ; « Mes tâches » en un geste ; « Grouper par » mois, évènement, qui s'en charge
// (et jour pour les faites) ; le décompte des lignes montrées (« 8 tâches à faire sur 42 · 2 en retard ») ;
// le mode « Sélectionner » et sa barre d'actions ; quatre états vides ; les tâches faites, de la plus
// récente à la plus ancienne, avec « Rouvrir ». Les anciennes adresses mènent à la vue équivalente.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, formatMonth, formatShortCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { PageHeader } from "@/app/ui/page-header";
import { ScreenHelp } from "@/app/screen-help";
import { eventNames, listEvents, listTasks } from "@/modules/events/service";
import type { TaskListItem } from "@symbola/contracts";
import { listTakeovers } from "@/modules/hub/service";
import { appDatabase } from "@symbola/db/client";
import { eventIdsWithoutTasks } from "@/modules/events/service";
import { ensureTaskCategories } from "@/lib/events/task-categories";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { requirePlanner } from "@/lib/guards";
import { taskMemberOptions } from "@/lib/tasks/members";
import { TaskCalendar } from "./task-calendar";
import { TaskLineBoard } from "@/app/ui/task-line-board";
import type { TaskLineGroup } from "@/app/ui/task-line";
import { TaskPanelLoader, panelFromQuery } from "@/app/ui/task-panel-loader";
import { buildTaskLines, clientsTerms, doneMoment } from "@/lib/tasks/task-lines";
import { eventTaskHref } from "@/lib/tasks/task-tab";
import { nameInitials, type TaskLineView } from "@/lib/tasks/task-line";
import { taskListViewer, visibleEventScope } from "@/lib/event-visibility";
import {
  activeFilters,
  countLine,
  dayWord,
  emptyKind,
  groupLines,
  listFiltersOf,
  readTaskScreen,
  taskScreenHref,
  taskScreenParams,
  whoKey,
  withoutFilter,
  withoutFilters,
  withView,
  type FilterKey,
  type TaskScreenQuery,
  type TaskScreenView,
} from "@/lib/tasks/task-screen";
import { GroupBySelect, TaskFiltersPhoneButtons, TaskScreenFilters, type ScreenFilterValues } from "./task-screen-filters";

type SearchParams = TaskScreenQuery & { tache?: string; nouvelle?: string; copie?: string; tout?: string };

// Lot 70d (NFR-02, ADR 0115) : la liste montre d'abord les 100 premières tâches (les plus urgentes, ou les
// dernières faites) ; « Afficher les N suivantes » montre le reste. Une agence de 500 tâches ne rend plus
// 500 lignes à chaque affichage.
const FIRST_LINES = 100;

const IN_PROGRESS = new Set(["option", "confirmed", "postponed"]);

// Les valeurs des listes des filtres, lues de l'adresse canonique.
function filterValues(view: TaskScreenView): ScreenFilterValues {
  const params = taskScreenParams({ ...view, calendar: false, month: null });
  return { evenement: params.evenement ?? "", qui: params.qui ?? "", periode: params.periode ?? "", du: params.du ?? "", au: params.au ?? "", categorie: params.categorie ?? "", etat: params.etat ?? "", grouper: params.grouper ?? "" };
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("TaskScreen");
  const tLine = await getTranslations("TaskLine");
  const tEvents = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{tEvents("allTasksTitle")}</h1>
        <p>{tEvents("moduleUnavailable")}</p>
      </main>
    );
  }

  const query = await searchParams;
  const { view, legacy } = readTaskScreen(query);
  // CHR-03 crit. 10 : une ancienne adresse mène à la vue équivalente (la tâche ouverte comprise).
  if (legacy) {
    const extra: Record<string, string> = {};
    for (const key of ["tache", "nouvelle", "copie"] as const) if (query[key]) extra[key] = query[key]!;
    redirect(taskScreenHref(view, extra));
  }

  const locale = (await getLocale()) as Locale;
  const today = parisToday();
  const href = (extra: Record<string, string> = {}) => taskScreenHref(view, extra);
  const viewer = await taskListViewer({ user: { id: auth.user.id, role: auth.user.role, organizationId } });
  const [list, members, categories, scope, events, imported, clientsLabelOf] = await Promise.all([
    listTasks({ organizationId, today, viewer, filters: listFiltersOf(view) }),
    taskMemberOptions(organizationId, auth.user.id),
    ensureTaskCategories(organizationId, locale),
    visibleEventScope({ user: { id: auth.user.id, role: auth.user.role, organizationId } }),
    listEvents({ organizationId }),
    // Lot 71f : l'origine posée par le lot 71a (`events.origin`) remplace le repérage provisoire du 70d
    // (le journal des imports) ; la date est celle de la reprise du mariage.
    listTakeovers(appDatabase(), organizationId, viewer),
    clientsTerms(organizationId, locale),
  ]);
  const visibleEvents = events.filter((event) => IN_PROGRESS.has(event.status) && (!scope || scope.has(event.id)));
  const eventOptions = [...visibleEvents]
    .sort((a, b) => (a.eventDate ?? "9999").localeCompare(b.eventDate ?? "9999"))
    .map((event) => ({ value: event.id, label: event.eventDate ? tLine("eventOption", { names: eventNames(event.clients, event.name), date: formatCalendarDate(event.eventDate, locale) }) : tLine("eventOptionNoDate", { names: eventNames(event.clients, event.name) }) }));
  const activeMembers = members.filter((member) => !member.removed);
  const whoOptions = [
    ...activeMembers.map((member) => ({ value: member.me ? "moi" : member.id, label: member.me ? tLine("you") : member.name })),
    { value: "clients", label: t("whoClients") },
    { value: "prestataires", label: tLine("filterVendors") },
  ];
  const categoryOptions = categories.map((category) => ({ value: category.id, label: category.label }));

  // C-55 : un mariage repris dont les tâches sont restées dans l'ancien outil.
  const importedById = new Map(imported.flatMap((takeover) => (takeover.eventId ? [[takeover.eventId, takeover.createdAt.toISOString()] as const] : [])));
  const importedVisible = visibleEvents.filter((event) => event.origin === "takeover" && importedById.has(event.id));
  const withoutTasks = new Set(await eventIdsWithoutTasks(organizationId, importedVisible.map((event) => event.id)));
  const toCheck = importedVisible.filter((event) => withoutTasks.has(event.id));

  // Les lignes et leurs groupes.
  const showAll = query.tout === "1";
  const shownTasks = showAll || view.calendar ? list.tasks : list.tasks.slice(0, FIRST_LINES);
  const hidden = list.tasks.length - shownTasks.length;
  const built = await buildTaskLines({ organizationId, locale, tasks: shownTasks, members, href: (task) => href({ tache: task.id }) });
  const lines = built.lines;
  const groups = screenGroups(lines, view, list, {
    today,
    locale,
    t,
    tLine,
    events: new Map(visibleEvents.map((event) => [event.id, event.eventDate])),
    memberName: new Map(members.map((member) => [member.id, member.me ? tLine("you") : (member.shortName ?? member.name)])),
    clientsWord: t("whoClients"),
  });

  // Le décompte : combien la liste montre, sur combien (C-33, crit. 3).
  const counts = { shown: list.filtered, total: list.total, todoTotal: list.todoTotal, late: list.late };
  const line = countLine(view, counts);
  const countParts = [t(line.key, line.values)];
  if (line.late) countParts.push(t("countLateSuffix", { count: line.late }));
  // Lot 74b (B7) : les tâches « à dater », comptées à part.
  if (list.undated) countParts.push(t("countUndatedSuffix", { count: list.undated }));
  if (line.filtered) countParts.push(t("countFiltered"));
  if (view.group === "who" && lines.length > 0) countParts.push(t("countPeople", { count: groups.length }));
  if (view.state === "done" && lines.length > 0) countParts.push(t("countRecentFirst"));
  if (toCheck.length > 0) countParts.push(t("countWithoutTasks", { count: toCheck.length }));
  const empty = emptyKind(view, counts);
  const active = activeFilters(view);

  // Les pastilles des filtres posés, chacune avec l'adresse qui la retire.
  const eventLabel = (id: string) => visibleEvents.find((event) => event.id === id);
  const chipLabel = (key: FilterKey): string => {
    switch (key) {
      case "event": {
        if (view.event.kind === "none") return tLine("noEvent");
        const event = view.event.kind === "event" ? eventLabel(view.event.eventId) : undefined;
        return event ? eventNames(event.clients, event.name) : t("eventUnknown");
      }
      case "who":
        return whoOptions.find((option) => option.value === filterValues(view).qui)?.label ?? t("whoUnknown");
      case "period":
        return view.period.kind === "between"
          ? t("periodBetweenChip", { from: formatShortCalendarDate(view.period.from, locale), to: formatShortCalendarDate(view.period.to, locale) })
          : tLine(({ late: "periodLate", week: "periodWeek", fortnight: "periodFortnight", month: "periodMonth" } as const)[view.period.kind as "late" | "week" | "fortnight" | "month"]);
      case "category":
        return categoryOptions.find((option) => option.value === view.category)?.label ?? t("categoryUnknown");
      case "state":
        return view.state === "done" ? tLine("stateDone") : tLine("stateAll");
    }
  };
  const chips = active.map((key) => ({ key, label: chipLabel(key), href: taskScreenHref(withoutFilter(view, key)) }));
  const keep: Record<string, string> = view.calendar ? { affichage: "calendrier", ...(view.month ? { mois: view.month } : {}) } : {};
  const mineActive = view.who.kind === "me";
  const mine = { href: taskScreenHref({ ...view, who: mineActive ? { kind: "all" } : { kind: "me" } }), active: mineActive };
  const quick = [
    { key: "late", label: tLine("periodLate"), active: view.period.kind === "late" },
    { key: "week", label: tLine("periodWeek"), active: view.period.kind === "week" },
  ].map((item) => ({ ...item, href: taskScreenHref({ ...view, period: item.active ? { kind: "all" } : { kind: item.key as "late" | "week" } }) }));

  const month = view.month ?? today.slice(0, 7);
  const panel = panelFromQuery(query, isValidId);
  const memberAssign = activeMembers.map((member) => ({ value: `member:${member.id}`, label: member.me ? tLine("you") : member.name, initials: member.initials ?? nameInitials(member.name) }));
  const isNew = empty === "new";

  const listTools = (
    <>
      <GroupBySelect current={filterValues(view)} keep={keep} done={view.state === "done"} />
      <nav aria-label={tEvents("tasksDisplayLabel")} className="segmented">
        <Link href={taskScreenHref({ ...view, calendar: false, month: null })} aria-current={view.calendar ? undefined : "page"} scroll={false}>
          {tEvents("viewList")}
        </Link>
        <Link href={taskScreenHref({ ...view, calendar: true, month })} aria-current={view.calendar ? "page" : undefined} scroll={false}>
          {tEvents("viewCalendar")}
        </Link>
      </nav>
    </>
  );

  return (
    <main className="task-screen">
      <PageHeader
        title={tEvents("allTasksTitle")}
        subtitle={<span>{t("subtitle")}</span>}
        // C-37 : dans un espace neuf, l'état vide porte la seule action principale (« Nouvel évènement »).
        actions={
          isNew ? null : (
            <>
              <TaskFiltersPhoneButtons count={chips.length} mine={mine} />
              <Link href={href({ nouvelle: "1", ...(view.event.kind === "event" ? { evenement: view.event.eventId } : {}) })} scroll={false} className="button-link button-link-primary task-new-button">
                {tLine("newTask")}
              </Link>
            </>
          )
        }
      />
      <ScreenHelp title={tHelp("allTasks.title")} body={tHelp("allTasks.body")} />
      {toCheck.map((event) => (
        <section key={event.id} className="notice task-to-check" aria-label={t("toCheckLabel", { event: eventNames(event.clients, event.name) })}>
          <p>
            <strong>{t("toCheck", { event: eventNames(event.clients, event.name), date: doneMoment(importedById.get(event.id)!, locale).date })}</strong> {t("toCheckBody")}
          </p>
          <p className="row-wrap">
            {/* Lot 71b (HUB-14) : la ligne 5 de la reprise du mariage (créée à son premier geste). */}
            <Link href={`/reprise?evenement=${event.id}&ligne=tasks`} className="button-link">
              {t("toCheckImport")}
            </Link>
            <Link href={eventTaskHref(event.id)} className="button-link">
              {t("toCheckTemplate")}
            </Link>
          </p>
        </section>
      ))}
      {isNew ? (
        <section className="empty-state task-empty" aria-labelledby="vide-taches">
          <h2 id="vide-taches">{t("emptyNewTitle")}</h2>
          <p>{t("emptyNewBody")}</p>
          <p className="meta">{t("emptyNewExample")}</p>
          <div className="row-wrap">
            <Link href="/events/new" className="button-link button-link-primary">
              {t("newEvent")}
            </Link>
            <Link href={taskScreenHref(view, { nouvelle: "1", evenement: "hors" })} scroll={false} className="button-link">
              {t("newStandaloneTask")}
            </Link>
            <Link href="/aide/ecrans/allTasks">{t("readHelp")}</Link>
          </div>
        </section>
      ) : (
        <section className="task-screen-list" aria-labelledby="all-tasks-title">
          <h2 id="all-tasks-title" className="sr-only">
            {tEvents("allTasksTitle")}
          </h2>
          <TaskScreenFilters
            current={filterValues(view)}
            keep={keep}
            events={eventOptions}
            who={whoOptions}
            categories={categoryOptions}
            chips={chips}
            clearHref={taskScreenHref(withoutFilters(view))}
            mine={mine}
            quick={quick}
            shown={list.filtered}
            done={view.state === "done"}
            display={{
              label: tEvents("tasksDisplayLabel"),
              list: { label: tEvents("viewList"), href: taskScreenHref({ ...view, calendar: false, month: null }) },
              calendar: { label: tEvents("viewCalendar"), href: taskScreenHref({ ...view, calendar: true, month }) },
              isCalendar: view.calendar,
            }}
          />
          {view.calendar ? (
            <>
              <div className="task-board-tools">
                <p className="task-count">{countParts.join(" · ")}</p>
                <div className="task-board-options">{listTools}</div>
              </div>
              <TaskCalendar
                month={month}
                tasks={list.tasks.map((task) => ({ ...task, overdue: task.dueState?.kind === "late" }))}
                today={today}
                locale={locale}
                href={(next) => taskScreenHref({ ...view, month: next })}
                taskHref={(task) => href({ tache: task.id })}
                categories={categories}
              />
            </>
          ) : empty ? (
            <>
              <p className="task-count">{countParts.join(" · ")}</p>
              {empty === "allDone" ? (
                <section className="empty-state task-empty" aria-labelledby="vide-taches">
                  <h2 id="vide-taches">{t("emptyDoneTitle")}</h2>
                  <p>{t("emptyDoneBody", { count: list.total })}</p>
                  <div className="row-wrap">
                    <Link href={taskScreenHref(withView(view, { state: "done" }))} className="button-link">
                      {t("seeDone")}
                    </Link>
                  </div>
                </section>
              ) : (
                <section className="empty-state task-empty" aria-labelledby="vide-taches">
                  <h2 id="vide-taches">{t("emptyFilteredTitle", { count: active.length })}</h2>
                  <p>{t("emptyFilteredBody", { filters: chips.map((chip) => chip.label).join(", ") })}</p>
                  <div className="row-wrap">
                    <Link href={taskScreenHref(withoutFilters(view))} className="button-link">
                      {t("clearFilters")}
                    </Link>
                    {chips.length > 1 ? (
                      <Link href={chips[chips.length - 1]!.href} className="button-link">
                        {t("removeFilterNamed", { filter: chips[chips.length - 1]!.label })}
                      </Link>
                    ) : null}
                  </div>
                </section>
              )}
            </>
          ) : (
            <TaskLineBoard
              groups={groups}
              form="list"
              label={tEvents("allTasksTitle")}
              shortcuts={built.shortcuts}
              assignOptions={built.assignOptions}
              categories={categoryOptions}
              members={memberAssign}
              clientsLabel={clientsLabelOf(null)}
              summary={<p className="task-count">{countParts.join(" · ")}</p>}
              tools={listTools}
              doneColumns={view.state === "done"}
            />
          )}
          {!view.calendar && !empty && hidden > 0 ? (
            <p className="task-more">
              {t("firstShown", { shown: shownTasks.length, count: list.tasks.length })}{" "}
              <Link href={taskScreenHref(view, { tout: "1" })} scroll={false} className="button-link">
                {t("showMore", { count: hidden })}
              </Link>
            </p>
          ) : null}
        </section>
      )}
      {panel ? (
        <TaskPanelLoader
          organizationId={organizationId}
          userId={auth.user.id}
          role={auth.user.role}
          locale={locale}
          today={today}
          open={panel}
          closeHref={href()}
          backLabel={tEvents("allTasksTitle")}
          screenHref={(params) => href(params)}
        />
      ) : null}
    </main>
  );
}

type GroupContext = {
  today: string;
  locale: Locale;
  t: Awaited<ReturnType<typeof getTranslations<"TaskScreen">>>;
  tLine: Awaited<ReturnType<typeof getTranslations<"TaskLine">>>;
  events: Map<string, string | null>;
  memberName: Map<string, string>;
  clientsWord: string;
};

// Les en-têtes de groupe : « Novembre 2026 · 4 tâches » ; « Léa & Maxime · 12 juin 2027 · 2 tâches · Ouvrir
// la fiche » ; « Bastien · 2 en retard · 6 à faire » ; « Aujourd'hui · 3 tâches ».
function screenGroups(lines: TaskLineView[], view: TaskScreenView, list: { todoByWho: Record<string, number> } & { tasks: TaskListItem[] }, context: GroupContext): TaskLineGroup[] {
  const { t, tLine, locale } = context;
  const groupable = lines.map((line) => ({ ...line, whoName: line.who.name, doneDay: line.doneInfo?.day ?? null }));
  return groupLines(groupable, view.group).map((group) => {
    const first = group.lines[0]!;
    const count = tLine("monthCount", { count: group.lines.length });
    switch (view.group) {
      case "month":
        return { key: group.key, label: formatMonth(`${group.key}-01`, locale), lines: group.lines };
      case "day": {
        const word = dayWord(group.key, context.today);
        return { key: group.key, label: word ? t(word === "today" ? "dayToday" : "dayYesterday") : formatShortCalendarDate(group.key, locale), lines: group.lines };
      }
      case "event": {
        if (group.key === "none") return { key: group.key, label: tLine("noEvent"), lines: group.lines };
        const date = context.events.get(group.key);
        return {
          key: group.key,
          label: first.eventLabel,
          lines: group.lines,
          detail: date ? `${formatCalendarDate(date, locale)} · ${count}` : count,
          link: { href: eventTaskHref(group.key), label: t("openEventPage") },
        };
      }
      case "who": {
        const key = whoKey(first.responsibleValue);
        const late = group.lines.filter((line) => line.late).length;
        const todo = list.todoByWho[key] ?? group.lines.filter((line) => !line.done).length;
        const label = key === "clients" ? context.clientsWord : key === "vendors" ? tLine("filterVendors") : key === "nobody" ? tLine("nobody") : (context.memberName.get(key.slice("member:".length)) ?? first.who.name);
        return { key: group.key, label, lines: group.lines, detail: late > 0 ? `${t("groupLate", { count: late })} · ${t("groupTodo", { count: todo })}` : t("groupTodo", { count: todo }) };
      }
    }
  });
}
