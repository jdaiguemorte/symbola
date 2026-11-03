import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import type { TourStep } from "@symbola/ui";
import { createAppConnection } from "@symbola/db/client";
import {
  getActiveEventsTrial,
  listEvents,
  listProspectSources,
  type EventStatus,
} from "@/modules/events/service";
import { hasSeenTour } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { purgeOrganizationsDemoData } from "@/lib/demo-purge";
import { ModuleTourAndHelp } from "../module-tour";
import { isEventsModuleEnabled } from "./module-access";
import { startTrialAction } from "./trial-actions";

const UPCOMING_STATUSES: EventStatus[] = [
  "prospect",
  "quote_sent",
  "confirmed",
];
const PAST_STATUSES: EventStatus[] = ["done", "lost"];

// Pastilles de statut de la charte (globals.css) : le libellé reste affiché.
const EVENT_STATUS_CLASSES: Record<EventStatus, string> = {
  prospect: "badge badge-bleu",
  quote_sent: "badge badge-ambre",
  confirmed: "badge badge-sauge",
  done: "badge",
  lost: "badge badge-terracotta",
};

const STATUS_LABEL_KEYS: Record<EventStatus, string> = {
  prospect: "statusProspect",
  quote_sent: "statusQuoteSent",
  confirmed: "statusConfirmed",
  done: "statusDone",
  lost: "statusLost",
};

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
  }>;
}) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden")
    redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const locale = (await getLocale()) as Locale;
  const tHelp = await getTranslations("Help");
  const { tab, year, search, status, source, essai } = await searchParams;

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
  const tTour = await getTranslations("Tour");
  const { sql, db } = createAppConnection();
  let tourInitiallyOpen: boolean;
  try {
    tourInitiallyOpen = !(await hasSeenTour(db, auth.user.id, "events"));
  } finally {
    await sql.end();
  }

  const isPastTab = tab === "termines";
  const tabStatuses = isPastTab ? PAST_STATUSES : UPCOMING_STATUSES;
  const statusFilter: EventStatus[] =
    status && tabStatuses.includes(status as EventStatus)
      ? [status as EventStatus]
      : tabStatuses;
  const yearFilter = year ? Number(year) : undefined;

  const sources = await listProspectSources(organizationId);
  // EVT-07 : seule une source de l'organisation est retenue comme filtre.
  const sourceFilter = sources.some((candidate) => candidate.id === source)
    ? source
    : undefined;

  const items = await listEvents({
    organizationId,
    statusIn: statusFilter,
    year: yearFilter && !Number.isNaN(yearFilter) ? yearFilter : undefined,
    search: search || undefined,
    prospectSourceId: sourceFilter,
  });

  function clientNames(
    clients: { firstName: string; lastName: string | null }[],
  ): string {
    if (clients.length === 0) return t("noClient");
    return clients.map((client) => client.firstName).join(" & ");
  }

  return (
    <main>
      <h1>{t("title")}</h1>
      <ModuleTourAndHelp
        moduleKey="events"
        tourInitiallyOpen={tourInitiallyOpen}
        tourSteps={tTour.raw("events") as TourStep[]}
        skipLabel={tTour("skip")}
        nextLabel={tTour("next")}
        finishLabel={tTour("finish")}
        helpTitle={tHelp("eventsList.title")}
        helpBody={tHelp("eventsList.body")}
        relaunchLabel={tHelp("relaunchTour")}
      />

      {/* AIDE-02 : essai guidé sur un événement fictif. */}
      <section aria-labelledby="events-trial-title">
        <h2 id="events-trial-title">{t("trialTitle")}</h2>
        {essai === "termine" ? <p role="status">{t("trialEnded")}</p> : null}
        <p>{t("trialIntro")}</p>
        {trial ? (
          <Link href={`/events/${trial.eventId}`}>{t("trialResume")}</Link>
        ) : (
          <form action={startTrialAction}>
            <button type="submit">{t("trialStart")}</button>
          </form>
        )}
      </section>
      <nav className="toolbar">
        <Link href="/events/new" className="button-link button-link-primary">
          {t("newProspect")}
        </Link>
        <Link href="/events/parametres" className="button-link">
          {t("settingsLink")}
        </Link>
        <Link href="/events/modeles" className="button-link">
          {t("taskTemplatesLink")}
        </Link>
        <Link href="/events/modeles-programme" className="button-link">
          {t("programTemplatesLink")}
        </Link>
      </nav>

      <nav aria-label={t("tabsLabel")} className="tabs">
        <Link href="/events" aria-current={!isPastTab ? "page" : undefined}>
          {t("tabUpcoming")}
        </Link>
        <Link
          href="/events?tab=termines"
          aria-current={isPastTab ? "page" : undefined}
        >
          {t("tabPast")}
        </Link>
      </nav>

      <form method="get" className="filters">
        {isPastTab ? <input type="hidden" name="tab" value="termines" /> : null}
        <label>
          {t("searchLabel")}
          <input type="search" name="search" defaultValue={search ?? ""} />
        </label>
        <label>
          {t("yearLabel")}
          <input type="number" name="year" defaultValue={year ?? ""} />
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
        <button type="submit">{t("filter")}</button>
      </form>

      <ul className="event-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/events/${item.id}`}>
              <span className="event-list-names">
                {clientNames(item.clients)}
              </span>
              <span className="event-list-meta">
                <strong>
                  {item.eventDate
                    ? formatCalendarDate(item.eventDate, locale)
                    : t("dateUnset")}
                </strong>
                {item.venueName || item.venueCity
                  ? ` · ${item.venueName ?? ""} ${item.venueCity ? `(${item.venueCity})` : ""}`
                  : ""}
              </span>
              <span className={EVENT_STATUS_CLASSES[item.status]}>
                {t(STATUS_LABEL_KEYS[item.status])}
              </span>
              {item.isDemo ? (
                <span className="badge">{t("demoTag")}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p>{t("noResults")}</p> : null}
    </main>
  );
}
