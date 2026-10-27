import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { listEvents, listProspectSources, type EventStatus } from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "./module-access";

const UPCOMING_STATUSES: EventStatus[] = ["prospect", "quote_sent", "confirmed"];
const PAST_STATUSES: EventStatus[] = ["done", "lost"];

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
  searchParams: Promise<{ tab?: string; year?: string; search?: string; status?: string; source?: string }>;
}) {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  const { tab, year, search, status, source } = await searchParams;

  if (!(await isEventsModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }

  const isPastTab = tab === "termines";
  const tabStatuses = isPastTab ? PAST_STATUSES : UPCOMING_STATUSES;
  const statusFilter: EventStatus[] =
    status && tabStatuses.includes(status as EventStatus) ? [status as EventStatus] : tabStatuses;
  const yearFilter = year ? Number(year) : undefined;

  const sources = await listProspectSources(organizationId);
  // EVT-07 : seule une source de l'organisation est retenue comme filtre.
  const sourceFilter = sources.some((candidate) => candidate.id === source) ? source : undefined;

  const items = await listEvents({
    organizationId,
    statusIn: statusFilter,
    year: yearFilter && !Number.isNaN(yearFilter) ? yearFilter : undefined,
    search: search || undefined,
    prospectSourceId: sourceFilter,
  });

  function clientNames(clients: { firstName: string; lastName: string | null }[]): string {
    if (clients.length === 0) return t("noClient");
    return clients.map((client) => client.firstName).join(" & ");
  }

  return (
    <main>
      <h1>{t("title")}</h1>
      <HelpButton title={tHelp("eventsList.title")} body={tHelp("eventsList.body")} />
      <nav>
        <Link href="/events/new">{t("newProspect")}</Link>
        {" · "}
        <Link href="/events/parametres">{t("settingsLink")}</Link>
        {" · "}
        <Link href="/events/modeles">{t("taskTemplatesLink")}</Link>
        {" · "}
        <Link href="/events/modeles-programme">{t("programTemplatesLink")}</Link>
      </nav>

      <nav aria-label={t("tabsLabel")}>
        <Link href="/events" aria-current={!isPastTab ? "page" : undefined}>
          {t("tabUpcoming")}
        </Link>
        {" · "}
        <Link href="/events?tab=termines" aria-current={isPastTab ? "page" : undefined}>
          {t("tabPast")}
        </Link>
      </nav>

      <form method="get">
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

      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/events/${item.id}`}>
              <strong>{item.eventDate ?? t("dateUnset")}</strong> — {clientNames(item.clients)}
              {" — "}
              {item.venueName ?? ""} {item.venueCity ? `(${item.venueCity})` : ""}
              {" — "}
              {t(STATUS_LABEL_KEYS[item.status])}
            </Link>
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p>{t("noResults")}</p> : null}
    </main>
  );
}
