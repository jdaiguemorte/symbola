import Link from "next/link";
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
  }>;
}) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const locale = (await getLocale()) as Locale;
  const tHelp = await getTranslations("Help");
  const { tab, year, search, status, source, essai, visite, agenda, debut } = await searchParams;

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
  const tabStatuses = isPastTab ? PAST_STATUSES : UPCOMING_STATUSES;
  const statusFilter: EventStatus[] =
    status && tabStatuses.includes(status as EventStatus)
      ? [status as EventStatus]
      : tabStatuses;
  // L13-EVT-18 : années et effectifs des onglets depuis tous les événements
  // (quelques centaines au plus pour une organisation).
  const allEvents = await listEvents({ organizationId });
  const years = yearOptions(allEvents.map((event) => event.eventDate), parisToday());
  const yearFilter = parseYear(year, years);
  const counts = tabCounts(allEvents.map((event) => event.status));

  const sources = await listProspectSources(organizationId);
  // PRD-EVT-07 : seule une source de l'organisation est retenue comme filtre.
  const sourceFilter = sources.some((candidate) => candidate.id === source)
    ? source
    : undefined;

  const items = await listEvents({
    organizationId,
    statusIn: statusFilter,
    year: yearFilter,
    search: search || undefined,
    prospectSourceId: sourceFilter,
  });

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
      <PageHeader title={t("title")} actions={<SettingsLink href="/events/parametres" label={t("settingsLink")} tour="events-settings" />} />
      <PageTour {...tour} helpTitle={tHelp("eventsList.title")} helpBody={tHelp("eventsList.body")} helpExtra={trialHelp} />

      {essai === "termine" ? <p role="status">{t("trialEnded")}</p> : null}
      {/* Lot 20 (décision 1) : les réglages passent par « Réglages » ; la barre
          ne garde que l'action principale. */}
      <nav className="toolbar" aria-label={t("actionsLabel")}>
        <Link href="/events/new" className="button-link button-link-primary" data-tour="new-prospect">
          {t("newProspect")}
        </Link>
      </nav>

      <div data-tour="events-filters">
      <FilterBar label={t("filtersLabel")} applyLabel={t("filter")} preserve={isPastTab ? { tab: "termines" } : {}}>
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

      <nav aria-label={t("tabsLabel")} className="segmented">
        <Link href="/events" aria-current={!isPastTab ? "page" : undefined}>
          {t("tabUpcomingCount", { count: counts.upcoming })}
        </Link>
        <Link href="/events?tab=termines" aria-current={isPastTab ? "page" : undefined}>
          {t("tabPastCount", { count: counts.past })}
        </Link>
      </nav>

      {items.length > 0 ? (
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
                <td className="num">{item.eventDate ? formatCalendarDate(item.eventDate, locale) : t("dateUnset")}</td>
                <td>
                  <span className={EVENT_STATUS_CLASSES[item.status]}>{t(STATUS_LABEL_KEYS[item.status])}</span>
                </td>
                <td>{[item.venueName, item.venueCity].filter(Boolean).join(", ") || "—"}</td>
              </ListRow>
            ))}
          </ListTable>
        </div>
      ) : null}
      {items.length === 0 ? <p>{t("noResults")}</p> : null}
      {/* Lot 32a (D3) : l'agenda des mois à venir, venu de l'accueil. */}
      {!isPastTab ? <AgendaBlock organizationId={organizationId} locale={locale} today={parisToday()} query={{ agenda, debut }} /> : null}
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
