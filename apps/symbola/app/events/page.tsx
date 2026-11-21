import Link from "next/link";
import { visibleEventScope, withinScope } from "@/lib/event-visibility";
import { EmptyState } from "@/app/ui/empty-state";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import {
  getActiveEventsTrial,
  listEvents,
  listProspectSources,
  type EventStatus,
} from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { purgeOrganizationsDemoData } from "@/lib/demo-purge";
import { PageTour } from "../page-tour";
import { SettingsLink } from "@/app/settings-link";
import { PageHeader } from "@/app/ui/page-header";
import { loadPageTour } from "@/lib/help/page-tour";
import { isEventsModuleEnabled } from "./module-access";
import { startTrialAction } from "./trial-actions";
import { EVENT_STATUS_CLASSES, STATUS_LABEL_KEYS } from "./event-status";
import { PAST_STATUSES, UPCOMING_STATUSES, parseYear, tabCounts, yearOptions } from "./events-list-options";
import { FilterBar } from "../ui/filter-bar";
import { ListRow, ListTable } from "../ui/list-table";
import { AgendaBlock } from "../agenda/agenda-block";
import { monthlyLoad, sharedDates } from "@/lib/portfolio/portfolio";
import { MonthlyLoad } from "./monthly-load";

export default async function EventsListPage({
  searchParams,
}: {
  searchParams: Promise<{
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
  }>;
}) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const locale = (await getLocale()) as Locale;
  const tHelp = await getTranslations("Help");
  const { tab, year, search, status, source, essai, visite, agenda, debut, affichage } = await searchParams;

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
  const trial = await getActiveEventsTrial(organizationId);
  const tour = await loadPageTour(auth.user.id, "events", visite);

  const isPastTab = tab === "termines";
  // Lot 58 (PAR-09, étape 5 ; ADR 0097) : un évènement archivé sort des listes courantes et se retrouve
  // sous le filtre « Archivés », tous statuts confondus.
  const isArchivedTab = tab === "archives";
  const tabStatuses = isPastTab ? PAST_STATUSES : UPCOMING_STATUSES;
  const statusFilter: EventStatus[] =
    status && tabStatuses.includes(status as EventStatus)
      ? [status as EventStatus]
      : tabStatuses;
  // L13-EVT-18 : années et effectifs des onglets depuis tous les événements
  // (quelques centaines au plus pour une organisation).
  // Lot 52 (EVT-06, D2) : les évènements visibles de la personne (réglage de visibilité).
  const scope = await visibleEventScope(auth);
  const allEvents = withinScope(scope, await listEvents({ organizationId, archived: "exclude" }), (event) => event.id);
  const years = yearOptions(allEvents.map((event) => event.eventDate), parisToday());
  const yearFilter = parseYear(year, years);
  const counts = tabCounts(allEvents.map((event) => event.status));
  // Lot 32b (EVT-07, D11) : liste ou calendrier ; charge par mois ; jours à deux évènements.
  const calendarView = !isPastTab && !isArchivedTab && affichage === "calendrier";
  const load = isPastTab || isArchivedTab ? [] : monthlyLoad(allEvents, parisToday().slice(0, 7));
  const shared = sharedDates(allEvents);
  const sameDayAs = (eventId: string, date: string | null) =>
    date ? (shared.get(date) ?? []).filter((id) => id !== eventId).map((id) => allEvents.find((event) => event.id === id)).filter((event) => event !== undefined) : [];

  const sources = await listProspectSources(organizationId);
  // PRD-EVT-07 : seule une source de l'organisation est retenue comme filtre.
  const sourceFilter = sources.some((candidate) => candidate.id === source)
    ? source
    : undefined;

  const items = withinScope(
    scope,
    await listEvents({
      organizationId,
      statusIn: isArchivedTab ? undefined : statusFilter,
      year: yearFilter,
      search: search || undefined,
      prospectSourceId: sourceFilter,
      archived: isArchivedTab ? "only" : "exclude",
    }),
    (event) => event.id,
  );

  function clientNames(
    clients: { firstName: string; lastName: string | null }[],
  ): string {
    if (clients.length === 0) return t("noClient");
    return clients.map((client) => client.firstName).join(" & ");
  }

  // Lot 20 (décision 2) : l'essai guidé se lance depuis l'aide de l'écran
  // (et quand la liste est vide), plus depuis « Plus d'options ».
  const trialAction = trial ? (
    <Link href={`/events/${trial.eventId}`} className="button-link button-link-primary">
      {t("trialResume")}
    </Link>
  ) : (
    <form action={startTrialAction} className="primary-action">
      <button type="submit">{t("trialStart")}</button>
    </form>
  );
  // Dans le tiroir d'aide : un simple bloc (pas une région), pour ne pas
  // doubler la région « Essai guidé » de la liste vide.
  const trialHelp = (
    <div className="help-extra">
      <h3>{t("trialTitle")}</h3>
      <p>{t("trialIntro")}</p>
      {trialAction}
    </div>
  );

  return (
    <main>
      <PageHeader
        title={t("title")}
        actions={
          <>
            {/* Lot 63b (HUB-14) : importer des évènements (fiches PDF ou tableur) depuis l'écran. */}
            <Link className="button-link" href="/import?type=evenements#import-form">
              {t("importHere")}
            </Link>
            <SettingsLink href="/events/parametres" label={t("settingsLink")} tour="events-settings" />
          </>
        }
      />
      <PageTour {...tour} helpTitle={tHelp("eventsList.title")} helpBody={tHelp("eventsList.body")} helpExtra={trialHelp} />

      {essai === "termine" ? <p role="status">{t("trialEnded")}</p> : null}
      {/* Lot 20 (décision 1) : les réglages passent par « Réglages » ; la barre
          ne garde que l'action principale. */}
      <nav className="toolbar" aria-label={t("actionsLabel")}>
        <Link href="/events/new" className="button-link button-link-primary" data-tour="new-prospect">
          {t("newProspect")}
        </Link>
        {/* Lot 44 (CRM-02) : la vue en colonnes des options, et retour. */}
        <Link href="/events/pipeline" className="button-link">
          {t("pipelineView")}
        </Link>
      </nav>

      {calendarView ? null : (
      <div data-tour="events-filters">
      <FilterBar label={t("filtersLabel")} applyLabel={t("filter")} preserve={isPastTab ? { tab: "termines" } : isArchivedTab ? { tab: "archives" } : {}}>
        <label>
          {t("searchLabel")}
          <input type="search" name="search" defaultValue={search ?? ""} />
        </label>
        <label>
          {t("statusLabel")}
          <select name="status" defaultValue={status ?? ""}>
            <option value="">{t("statusAll")}</option>
            {tabStatuses.map((value) => (
              <option key={value} value={value}>
                {t(STATUS_LABEL_KEYS[value])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("source")}
          <select name="source" defaultValue={sourceFilter ?? ""}>
            <option value="">{t("sourceAll")}</option>
            {sources.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <label>
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
      </FilterBar>
      </div>
      )}

      <nav aria-label={t("tabsLabel")} className="segmented">
        <Link href="/events" aria-current={!isPastTab && !isArchivedTab ? "page" : undefined}>
          {t("tabUpcomingCount", { count: counts.upcoming })}
        </Link>
        <Link href="/events?tab=termines" aria-current={isPastTab ? "page" : undefined}>
          {t("tabPastCount", { count: counts.past })}
        </Link>
        <Link href="/events?tab=archives" aria-current={isArchivedTab ? "page" : undefined}>
          {t("archivedFilter")}
        </Link>
      </nav>
      {isPastTab || isArchivedTab ? null : (
        <nav aria-label={t("viewLabel")} className="segmented" data-tour="events-views">
          <Link href="/events" aria-current={calendarView ? undefined : "page"}>
            {t("viewList")}
          </Link>
          <Link href="/events?affichage=calendrier" aria-current={calendarView ? "page" : undefined}>
            {t("viewCalendar")}
          </Link>
        </nav>
      )}

      {!calendarView && items.length > 0 ? (
        <div data-tour="events-list">
          <ListTable
            label={t("listLabel")}
            head={
              <tr>
                <th scope="col">{t("columnClients")}</th>
                <th scope="col">{t("columnDate")}</th>
                <th scope="col">{t("statusLabel")}</th>
                <th scope="col">{t("venueName")}</th>
              </tr>
            }
          >
            {items.map((item) => (
              <ListRow key={item.id} href={`/events/${item.id}`}>
                <th scope="row">
                  <Link href={`/events/${item.id}`}>{clientNames(item.clients)}</Link>
                  {item.isDemo ? <span className="badge">{t("demoTag")}</span> : null}
                </th>
                <td className="num">
                  {item.eventDate ? formatCalendarDate(item.eventDate, locale) : t("dateUnset")}
                  {sameDayAs(item.id, item.eventDate).length > 0 ? (
                    <span className="badge badge-ambre badge-wrap">{t("sameDayWith", { names: sameDayAs(item.id, item.eventDate).map((event) => clientNames(event.clients)).join(", ") })}</span>
                  ) : null}
                </td>
                <td>
                  <span className={EVENT_STATUS_CLASSES[item.status]}>{t(STATUS_LABEL_KEYS[item.status])}</span>
                </td>
                <td>{[item.venueName, item.venueCity].filter(Boolean).join(", ") || "—"}</td>
              </ListRow>
            ))}
          </ListTable>
        </div>
      ) : null}
      {/* Lot 39c (UX-08) : l'écran vide enseigne (action, exemple, aide). */}
      {!calendarView && items.length === 0 ? counts.upcoming + counts.past === 0 ? <EmptyState screen="events" actionHref="/events/new" /> : <p>{t("noResults")}</p> : null}
      {/* Lot 32a (D3), 32b (D11) : l'agenda des mois à venir, en vue calendrier. */}
      {calendarView ? <AgendaBlock organizationId={organizationId} scope={scope} locale={locale} today={parisToday()} query={{ agenda, debut }} params={{ affichage: "calendrier" }} /> : null}
      {isPastTab || isArchivedTab ? null : <MonthlyLoad load={load} locale={locale} />}
      {counts.upcoming + counts.past === 0 ? (
        <section className="card" aria-labelledby="events-empty-trial">
          <h2 id="events-empty-trial">{t("trialTitle")}</h2>
          <p>{t("trialIntro")}</p>
          {trialAction}
        </section>
      ) : null}
    </main>
  );
}
