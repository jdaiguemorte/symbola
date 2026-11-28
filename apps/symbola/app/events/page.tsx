import Link from "next/link";
import { visibleEventScope, withinScope } from "@/lib/event-visibility";
import { EmptyState } from "@/app/ui/empty-state";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import {
  getActiveEventsTrial,
  listEventLeads,
  listEvents,
  listEventTypes,
  listProspectSources,
  taskProgressByEvent,
  type EventPhase,
  type EventSummary,
} from "@/modules/events/service";
import type { EventTaskProgress } from "@symbola/contracts";
import { requirePlanner } from "@/lib/guards";
import { purgeOrganizationsDemoData } from "@/lib/demo-purge";
import { PageTour } from "../page-tour";
import { EventsHeader, keptQuery } from "./events-header";
import { loadPageTour, onEmptyScreen } from "@/lib/help/page-tour";
import { isEventsModuleEnabled } from "./module-access";
import { startTrialAction } from "./trial-actions";
import { parseYear, tabCounts, yearOptions } from "./events-list-options";
import {
  FIRST_ROWS,
  countdown,
  matchesPhase,
  parsePhase,
  parsePlanner,
  parseSort,
  periodOf,
  phasesOf,
  sameDayCounts,
  sortEvents,
  sortHref,
  statusesFor,
  statusWord,
  taskCell,
  type SortKey,
} from "./events-list";
import { EventsFiltersPanel } from "./events-list-controls";
import { FilterBar } from "../ui/filter-bar";
import { AgendaBlock } from "../agenda/agenda-block";
import { monthlyLoad } from "@/lib/portfolio/portfolio";
import { MonthlyLoad } from "./monthly-load";
import { taskListViewer } from "@/lib/event-visibility";
import { listTakeoversInProgress } from "@/lib/takeover/checklist";
import { taskMemberOptions } from "@/lib/tasks/members";

type Query = {
  tab?: string;
  year?: string;
  search?: string;
  status?: string;
  source?: string;
  essai?: string;
  visite?: string;
  agenda?: string;
  debut?: string;
  affichage?: string;
  origine?: string;
  planner?: string;
  tri?: string;
  sens?: string;
  tout?: string;
};

const SORT_COLUMNS: { key: SortKey; label: "columnEvent" | "columnDate" | "columnStatus" | "columnTasks" }[] = [
  { key: "evenement", label: "columnEvent" },
  { key: "date", label: "columnDate" },
  { key: "statut", label: "columnStatus" },
  { key: "taches", label: "columnTasks" },
];

// Lot 72f (EVT-07, UX-01, UX-05, UX-13 ; C-14, C-29, C-81, P-21, E7, E8 ; spécification du lot 72, § 5.6 ; page 17
// des maquettes du lot 68) — la liste des évènements : un seul bouton plein, des filtres libellés de même hauteur
// (la période en bascule d'encre), les colonnes Évènement, Date (« dans 39 jours · 2 le même jour »), Statut (les
// mots de la frise), Tâches faites et Lieu (ou Planner principal dans une agence), triées par leur en-tête. Sur
// téléphone, une carte par évènement, les filtres dans un panneau du bas. La charge des mois passe dans la vue
// « Calendrier ». NFR-02 : les 100 premières lignes, puis « Afficher les suivants » (procédé de « Tâches »).
export default async function EventsListPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const tList = await getTranslations("EventsList");
  const tHeader = await getTranslations("EventHeader");
  const locale = (await getLocale()) as Locale;
  const tHelp = await getTranslations("Help");
  const query = await searchParams;
  const { tab, year, search, status, source, essai, visite, agenda, debut, affichage, origine } = query;
  const tSheet = await getTranslations("TakeoverSheet");
  // Lot 71f (P-06) : le filtre « Origine » (Toutes, Repris, Créés dans Symbola), lu en SQL.
  const originFilter = origine === "repris" ? "takeover" : origine === "crees" ? "created" : undefined;

  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  // AIDE-02 : un essai abandonné depuis plus de 24 h disparaît aussi dès
  // que la planner revient ici, sans attendre la purge horaire.
  await purgeOrganizationsDemoData([organizationId]);

  // Lot 58 (PAR-09, étape 5 ; ADR 0097) : un évènement archivé sort des listes courantes et se retrouve
  // sous « Archivés », tous statuts confondus.
  const period = periodOf(tab);
  const phase = parsePhase(status, period);
  const today = parisToday();
  const calendarView = period === "upcoming" && affichage === "calendrier";
  const keep = keptQuery(query);

  // NFR-02 (ADR 0115) : les lectures indépendantes partent ensemble.
  // L13-EVT-18 : années et effectifs des périodes depuis tous les évènements ; lot 52 (EVT-06, D2) : les
  // évènements visibles de la personne. Lot 52, 72f : l'équipe, pour savoir si l'on est dans une agence.
  const [trial, tour, scope, everyEvent, sources, eventTypes, members, takeovers] = await Promise.all([
    getActiveEventsTrial(organizationId),
    loadPageTour(auth.user.id, "events", visite),
    visibleEventScope(auth),
    listEvents({ organizationId, archived: "exclude" }),
    listProspectSources(organizationId),
    listEventTypes(organizationId),
    calendarView ? Promise.resolve([]) : taskMemberOptions(organizationId, auth.user.id),
    calendarView ? Promise.resolve([]) : taskListViewer(auth).then((viewer) => listTakeoversInProgress(organizationId, viewer)),
  ]);
  const allEvents = withinScope(scope, everyEvent, (event) => event.id);
  const years = yearOptions(allEvents.map((event) => event.eventDate), today);
  const yearFilter = parseYear(year, years);
  const counts = tabCounts(allEvents.map((event) => event.status));
  // PRD-EVT-07 : seule une source de l'organisation est retenue comme filtre.
  const sourceFilter = sources.some((candidate) => candidate.id === source) ? source : undefined;

  // Lot 72f (critère 3, EVT-07) : « 2 le même jour », sur tous les évènements visibles en cours.
  const sameDay = sameDayCounts(allEvents);

  const filtered = calendarView
    ? []
    : withinScope(
        scope,
        await listEvents({
          organizationId,
          statusIn: statusesFor(period, phase),
          year: yearFilter,
          search: search || undefined,
          prospectSourceId: sourceFilter,
          origin: originFilter,
          archived: period === "archived" ? "only" : "exclude",
        }),
        (event) => event.id,
      ).filter((event) => matchesPhase(event, phase));

  // Lot 52, 72f : dans une agence (plus d'un membre actif), le planner principal en colonne et en filtre.
  // Lot 72a (critère 9) : « Tâches faites », en une requête groupée, pour les seuls évènements de la liste.
  const agency = members.filter((member) => !member.removed).length > 1;
  const filteredIds = filtered.map((event) => event.id);
  const [leads, progress] = await Promise.all([
    agency ? listEventLeads(organizationId, filteredIds) : Promise.resolve(new Map<string, string>()),
    filteredIds.length > 0 ? taskProgressByEvent(organizationId, filteredIds, today) : Promise.resolve(new Map<string, EventTaskProgress>()),
  ]);
  const leadIds = new Set(leads.values());
  const plannerFilter = agency ? parsePlanner(query.planner, leadIds) : undefined;
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const inPlanner = plannerFilter ? filtered.filter((event) => leads.get(event.id) === plannerFilter) : filtered;
  const withProgress = inPlanner.map((event) => ({ ...event, taskProgress: progress.get(event.id) ?? { done: 0, total: 0, late: 0 } }));

  // Lot 71f (EVT-07, P-06) : la marque « Repris · 3 fichiers sur 6 » tant que la reprise n'est pas complétée.
  const takeoverMarks = new Map(takeovers.map((entry) => [entry.eventId, entry]));

  // Lot 63c (EVT-01, Q43) : un évènement sans client (un shooting photo) prend le nom de son type.
  const typeLabels = new Map(eventTypes.map((type) => [type.id, type.label]));
  function nameOf(event: Pick<EventSummary, "clients" | "eventTypeId" | "name">): string {
    if (event.name) return event.name;
    if (event.clients.length === 0) return (event.eventTypeId ? typeLabels.get(event.eventTypeId) : undefined) ?? t("noClient");
    return event.clients.map((client) => client.firstName).join(" & ");
  }

  const sort = parseSort(query.tri, query.sens);
  const sorted = sortEvents(withProgress, sort, nameOf, locale);
  const showAll = query.tout === "1";
  const shown = showAll ? sorted : sorted.slice(0, FIRST_ROWS);
  const hidden = sorted.length - shown.length;
  const sortQuery = Object.fromEntries(keep);

  // Lot 20 (décision 2) : l'essai guidé se lance depuis l'aide de l'écran (et quand la liste est vide).
  const trialAction = trial ? (
    <Link href={`/events/${trial.eventId}`} className="button-link button-link-primary">
      {t("trialResume")}
    </Link>
  ) : (
    <form action={startTrialAction} className="primary-action">
      <button type="submit">{t("trialStart")}</button>
    </form>
  );
  // Dans le tiroir d'aide : un simple bloc (pas une région), pour ne pas doubler la région « Essai guidé ».
  const trialHelp = (
    <div className="help-extra">
      <h3>{t("trialTitle")}</h3>
      <p>{t("trialIntro")}</p>
      {trialAction}
    </div>
  );

  // Les filtres posés (hors période et tri) : le nombre du bouton « Filtres » du téléphone.
  const activeFilters = [search, phase, sourceFilter, originFilter, yearFilter, plannerFilter].filter(Boolean).length;
  const periodKeep = (target: "upcoming" | "past" | "archived") => {
    const params = new URLSearchParams(keep);
    params.delete("tab");
    params.delete("status");
    if (target === "past") params.set("tab", "termines");
    if (target === "archived") params.set("tab", "archives");
    const text = params.toString();
    return text ? `/events?${text}` : "/events";
  };
  const preserve: Record<string, string> = Object.fromEntries([...keep].filter(([key]) => ["tab", "tri", "sens"].includes(key)));
  const statusLabel = (value: EventPhase) => {
    const word = statusWord(value);
    return word.from === "frise" ? tHeader(word.key) : t(word.key);
  };
  const empty = counts.upcoming + counts.past === 0;

  return (
    <main className="events-list-screen">
      <EventsHeader view={calendarView ? "calendar" : "list"} upcoming={counts.upcoming} keep={keep} />
      {/* Lot 74d (C-69) : la ligne « Découvrir » ne paraît pas sur la liste vide. */}
      <PageTour {...onEmptyScreen(tour, empty)} helpTitle={tHelp("eventsList.title")} helpBody={tHelp("eventsList.body")} helpExtra={trialHelp} />

      {essai === "termine" ? <p role="status">{t("trialEnded")}</p> : null}
      {calendarView ? null : (
        <div data-tour="events-filters">
          <EventsFiltersPanel
            button={activeFilters > 0 ? tList("filtersCount", { count: activeFilters }) : tList("filters")}
            title={tList("filters")}
            done={tList("filtersClose", { count: sorted.length })}
            clear={activeFilters > 0 ? { href: period === "upcoming" ? "/events" : period === "past" ? "/events?tab=termines" : "/events?tab=archives", label: tList("clear") } : null}
          >
            <FilterBar label={t("filtersLabel")} applyLabel={t("filter")} preserve={preserve}>
              <label className="events-filter-search">
                {tList("searchLabel")}
                <input type="search" name="search" defaultValue={search ?? ""} placeholder={tList("searchPlaceholder")} />
              </label>
              <div className="events-period">
                <span aria-hidden="true">{tList("period")}</span>
                <nav aria-label={t("tabsLabel")} className="segmented">
                  <Link href={periodKeep("upcoming")} aria-current={period === "upcoming" ? "page" : undefined}>
                    {t("tabUpcomingCount", { count: counts.upcoming })}
                  </Link>
                  <Link href={periodKeep("past")} aria-current={period === "past" ? "page" : undefined}>
                    {t("tabPastCount", { count: counts.past })}
                  </Link>
                  <Link href={periodKeep("archived")} aria-current={period === "archived" ? "page" : undefined}>
                    {t("archivedFilter")}
                  </Link>
                </nav>
              </div>
              <label className="ev-f-status">
                {tList("status")}
                <select name="status" defaultValue={phase ?? ""}>
                  <option value="">{t("statusAll")}</option>
                  {phasesOf(period).map((value) => (
                    <option key={value} value={value}>
                      {statusLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ev-f-source">
                {tList("cameBy")}
                <select name="source" defaultValue={sourceFilter ?? ""}>
                  <option value="">{tList("cameByAll")}</option>
                  {sources.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ev-f-short">
                {tSheet("originFilter")}
                <select name="origine" defaultValue={origine === "repris" || origine === "crees" ? origine : ""}>
                  <option value="">{tSheet("originAll")}</option>
                  <option value="repris">{tSheet("originTakeover")}</option>
                  <option value="crees">{tSheet("originCreated")}</option>
                </select>
              </label>
              <label className="ev-f-short">
                {t("yearLabel")}
                <select name="year" defaultValue={yearFilter ? String(yearFilter) : ""}>
                  <option value="">{t("yearAll")}</option>
                  {years.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              {agency ? (
                <label>
                  {tList("planner")}
                  <select name="planner" defaultValue={plannerFilter ?? ""}>
                    <option value="">{tList("plannerAll")}</option>
                    {members
                      .filter((member) => leadIds.has(member.id))
                      .map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
            </FilterBar>
          </EventsFiltersPanel>
        </div>
      )}

      {!calendarView && shown.length > 0 ? (
        <div className="events-list" data-tour="events-list">
          <h2 id="events-list-summary" className="events-list-summary">
            {tList("summary", { count: sorted.length, sort: tList(`sortBy.${sort.key}`) })}
            {sort.natural ? null : ` · ${tList("sortReversed")}`}
          </h2>
          <div className="list-table-wrap" role="region" aria-label={t("listLabel")} tabIndex={0}>
            <table className="list-table events-table" data-agency={agency ? "" : undefined}>
              <thead>
                <tr>
                  {SORT_COLUMNS.map((column) => (
                    <th key={column.key} scope="col" aria-sort={sort.key === column.key ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}>
                      <Link href={sortHref("/events", sortQuery, sort, column.key)} scroll={false}>
                        {tList(column.label)}
                        {sort.key === column.key ? <span aria-hidden="true">{sort.direction === "asc" ? " ↑" : " ↓"}</span> : null}
                      </Link>
                    </th>
                  ))}
                  <th scope="col" className="ev-venue">{tList("columnVenue")}</th>
                  {agency ? <th scope="col" className="ev-lead">{tList("columnPlanner")}</th> : null}
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => {
                  const name = nameOf(item);
                  const type = item.eventTypeId ? typeLabels.get(item.eventTypeId) : undefined;
                  const entry = takeoverMarks.get(item.id);
                  const mark = entry ? (entry.mark.kind === "files" ? tSheet("markFiles", { settled: entry.mark.settled, total: entry.mark.total }) : tSheet("markPoints", { count: entry.mark.count })) : null;
                  const cell = taskCell(item.phase, item.taskProgress);
                  const others = sameDay.get(item.id);
                  const when = item.eventDate ? countdown(today, item.eventDate) : null;
                  const venue = [item.venueName, item.venueCity].filter(Boolean).join(", ");
                  const lead = leads.get(item.id);
                  return (
                    <tr key={item.id}>
                      <th scope="row">
                        <Link href={`/events/${item.id}`}>{name}</Link>
                        {type && type !== name ? <small>{type}</small> : null}
                        {item.isDemo ? <span className="badge">{t("demoTag")}</span> : null}
                        {entry && mark ? (
                          <Link href={`/reprise/${entry.takeoverId}`} className="badge badge-wrap takeover-mark" aria-label={tSheet("markLabel", { mark, event: name })}>
                            {mark}
                          </Link>
                        ) : null}
                      </th>
                      <td>
                        {item.eventDate ? formatCalendarDate(item.eventDate, locale) : t("dateUnset")}
                        {when || others ? (
                          <small>
                            {[when ? tList(when.key, { count: when.count }) : null, others ? tList("sameDay", { count: others }) : null].filter(Boolean).join(" · ")}
                          </small>
                        ) : null}
                      </td>
                      <td className="ev-status">{statusLabel(item.phase)}</td>
                      <td className="ev-tasks">
                        {cell.kind === "progress" ? (
                          <>
                            <progress value={cell.done} max={cell.total} aria-hidden="true" />
                            {tList("tasksDone", { done: cell.done, total: cell.total })}
                            {cell.late > 0 ? (
                              <>
                                {" · "}
                                <b>{tList("tasksLate", { count: cell.late })}</b>
                              </>
                            ) : null}
                          </>
                        ) : (
                          <i>{tList(cell.kind === "request" ? "tasksRequest" : "tasksNone")}</i>
                        )}
                      </td>
                      <td className="ev-venue">{venue || <i>{tList("venueUnset")}</i>}</td>
                      {agency ? <td className="ev-lead">{lead ? memberNames.get(lead) : <i>{tList("plannerUnset")}</i>}</td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hidden > 0 ? (
            <p className="task-more">
              {tList("firstShown", { shown: shown.length, count: sorted.length })}{" "}
              <Link href={`/events?${new URLSearchParams([...keep, ["tout", "1"]]).toString()}`} scroll={false} className="button-link">
                {tList("showMore", { count: hidden })}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      {/* Lot 39c (UX-08) : l'écran vide enseigne (action, exemple, aide). */}
      {!calendarView && shown.length === 0 ? empty ? <EmptyState screen="events" actionHref="/events/new" /> : <p>{t("noResults")}</p> : null}
      {/* Lot 32a (D3), 32b (D11), 72f (E8) : l'agenda des mois à venir, puis la charge des mois qui ont un évènement. */}
      {calendarView ? (
        <>
          <AgendaBlock organizationId={organizationId} scope={scope} locale={locale} today={today} query={{ agenda, debut }} params={{ affichage: "calendrier" }} />
          <MonthlyLoad load={monthlyLoad(allEvents, today.slice(0, 7)).filter((entry) => entry.confirmed + entry.options > 0)} locale={locale} />
        </>
      ) : null}
      {empty ? (
        <section className="card" aria-labelledby="events-empty-trial">
          <h2 id="events-empty-trial">{t("trialTitle")}</h2>
          <p>{t("trialIntro")}</p>
          {trialAction}
        </section>
      ) : null}
    </main>
  );
}
