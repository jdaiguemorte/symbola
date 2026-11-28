// Lot 72c (PAR-10, HUB-03, EVT-06 ; C-14, A7 ; spécification du lot 72, § 5.3 ; maquette 14 du lot 68, « La vue
// d'une agence ») — « L'agence » sur « Aujourd'hui » : qui est en retard dans l'équipe (une ligne par personne,
// « Voir ses tâches » vers « Tâches » filtré sur elle et groupé par évènement, 70d) et quels mariages ont du
// retard (planner principal, « 32 sur 42 » tâches faites avec la barre d'avancement en encre, retards, le plus
// ancien retard). Les évènements à jour sont repliés : leurs lignes ne sont lues et montées que sur
// « Afficher ». Aucune teinte d'état hors du rouge du retard, toujours avec son nombre (DESIGN.md).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatShortCalendarDate, type Locale } from "@symbola/i18n";
import { TODAY_HORIZON_DAYS, type EventSummary } from "@symbola/contracts";
import { eventNames } from "@/modules/events/service";
import { daysUntil } from "@/lib/today/rank";
import {
  HOME_SCOPE_WORDS,
  type AgencyCounts,
  type AgencyView as AgencyModel,
} from "@/lib/today/agency";
import { AgencyLeadFilter } from "./agency-client";

// L'adresse de la vue d'agence, avec ses choix (filtre, évènements à jour, toutes les personnes sur téléphone).
export function agencyHref(
  choices: { planner?: string | null; upToDate?: boolean; people?: boolean },
  hash?: string,
): string {
  const params = new URLSearchParams({ vue: HOME_SCOPE_WORDS.agency });
  if (choices.planner) params.set("planner", choices.planner);
  if (choices.upToDate) params.set("a-jour", "1");
  if (choices.people) params.set("personnes", "toutes");
  return `/?${params.toString()}${hash ? `#${hash}` : ""}`;
}

function LateCell({ value }: { value: number }) {
  return (
    <td className="agency-num">
      {value > 0 ? (
        <strong className="today-count-late">{value}</strong>
      ) : (
        value
      )}
    </td>
  );
}

function CountsCells({ counts }: { counts: AgencyCounts }) {
  return (
    <>
      <LateCell value={counts.late} />
      <td className="agency-num agency-today">{counts.today}</td>
      <td className="agency-num">{counts.horizon}</td>
    </>
  );
}

export async function AgencyView({
  view,
  locale,
  today,
  allPeople,
}: {
  view: AgencyModel;
  locale: Locale;
  today: string;
  allPeople: boolean;
}) {
  const t = await getTranslations("Today.agency");
  const tToday = await getTranslations("Today");
  const days = TODAY_HORIZON_DAYS;
  const peopleCount = view.people.length;
  const keep = {
    planner: view.plannerFilter,
    upToDate: view.upToDate.length > 0,
    people: allPeople,
  };
  const eventRow = (row: AgencyModel["withDelay"][number]) => {
    const event: EventSummary = row.event;
    const until = event.eventDate ? daysUntil(event.eventDate, today) : null;
    const percent =
      row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
    return (
      <tr key={event.id}>
        <th scope="row">
          <Link href={`/events/${event.id}`} className="today-item-title">
            {eventNames(event.clients, event.name)}
          </Link>
        </th>
        <td className="agency-event-date">
          {event.eventDate
            ? formatShortCalendarDate(event.eventDate, locale)
            : tToday("dateUnset")}
          {until === null ? null : (
            <span className="agency-muted">
              {" "}
              ·{" "}
              {until >= 0
                ? tToday("countdown", { days: until })
                : tToday("countdownPast")}
            </span>
          )}
        </td>
        <td className="agency-event-lead">
          {row.leadName ?? <span className="agency-muted">{t("noLead")}</span>}
        </td>
        <td className="agency-event-progress">
          {/* Une largeur en SVG : la CSP de l'app refuse les styles en ligne. */}
          <span className="agency-progress" aria-hidden="true">
            <svg viewBox="0 0 100 6" preserveAspectRatio="none" focusable="false">
              <rect width={percent} height="6" />
            </svg>
          </span>
          <span className="agency-progress-words">
            {t("doneOf", { done: row.done, total: row.total })}
          </span>
        </td>
        <LateCell value={row.late} />
        <td className="agency-event-oldest">{row.oldestLate?.label ?? ""}</td>
      </tr>
    );
  };
  return (
    <>
      <section
        className="card agency-section"
        aria-labelledby="agency-people-title"
        data-tour="home-agency"
      >
        <div className="today-part-head">
          <h2 id="agency-people-title">{t("peopleTitle")}</h2>
          <p className="agency-hint">
            <span className="agency-hint-long">{t("peopleHint")}</span>
            <span className="agency-hint-phone">
              {t("phoneColumns", { days })}
            </span>
          </p>
        </div>
        <div className="agency-table-wrap">
          <table
            className="agency-table agency-people"
            data-all={allPeople || peopleCount <= 4 ? "true" : undefined}
          >
            <thead>
              <tr>
                <th scope="col">{t("person")}</th>
                <th scope="col" className="agency-num">
                  {t("late")}
                </th>
                <th scope="col" className="agency-num agency-today">
                  {t("today")}
                </th>
                <th scope="col" className="agency-num">
                  {t("horizon", { days })}
                </th>
                <th scope="col" className="agency-num agency-followed">
                  {t("followed")}
                </th>
                <th scope="col" className="agency-action">
                  <span className="sr-only">{t("actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {view.people.map((person) => (
                <tr key={person.id} className="agency-person">
                  <th scope="row">
                    <span className="task-avatar" aria-hidden="true">
                      {person.initials}
                    </span>{" "}
                    {person.name}
                    {person.me ? (
                      <span className="agency-muted"> {t("you")}</span>
                    ) : null}
                    {person.removed ? (
                      <span className="agency-muted"> {t("removed")}</span>
                    ) : null}
                  </th>
                  <CountsCells counts={person} />
                  <td className="agency-num agency-followed">
                    {person.followed}
                  </td>
                  <td className="agency-action">
                    <Link
                      href={person.href}
                    >
                      <span className="agency-see-long">{t("seeTasks")}</span>
                      <span className="agency-see-short">{t("see")}</span>
                      <span className="sr-only"> · {person.name}</span>
                    </Link>
                  </td>
                </tr>
              ))}
              <tr className="agency-person agency-expected">
                <th scope="row">
                  <span className="task-avatar" aria-hidden="true">
                    M
                  </span>{" "}
                  {t("expected")}
                </th>
                <CountsCells counts={view.expected} />
                <td className="agency-num agency-followed">—</td>
                <td className="agency-action">
                  <Link
                    href="/taches?grouper=qui"
                  >
                    {t("see")}
                    <span className="sr-only"> · {t("expected")}</span>
                  </Link>
                </td>
              </tr>
              {view.nobody ? (
                <tr className="agency-person agency-nobody">
                  <th scope="row">{t("nobody")}</th>
                  <CountsCells counts={view.nobody} />
                  <td className="agency-num agency-followed">—</td>
                  <td className="agency-action">
                    <Link
                      href="/taches?grouper=qui"
                    >
                      {t("see")}
                      <span className="sr-only"> · {t("nobody")}</span>
                    </Link>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!allPeople && peopleCount > 4 ? (
          <p className="agency-all-people">
            <Link
              href={agencyHref(
                { ...keep, people: true },
                "agency-people-title",
              )}
            >
              {t("allPeople", { count: peopleCount })}
            </Link>
          </p>
        ) : null}
      </section>

      <section
        className="card agency-section"
        aria-labelledby="agency-events-title"
      >
        <div className="today-part-head agency-events-head">
          <h2 id="agency-events-title">
            {t("eventsTitle")}{" "}
            <span className="agency-muted">
              · {t("withDelay", { count: view.withDelay.length })}
            </span>
          </h2>
          {view.leadOptions.length > 1 ? (
            <AgencyLeadFilter
              label={t("leadFilter")}
              allLabel={t("leadAll")}
              value={view.plannerFilter ?? ""}
              options={view.leadOptions}
              hrefs={Object.fromEntries([
                ["", agencyHref({ ...keep, planner: null })],
                ...view.leadOptions.map((option) => [
                  option.id,
                  agencyHref({ ...keep, planner: option.id }),
                ]),
              ])}
            />
          ) : null}
        </div>
        {view.withDelay.length === 0 && view.upToDate.length === 0 ? (
          <p>{view.upToDateCount === 0 ? t("noEvents") : t("noDelay")}</p>
        ) : (
          <div className="agency-table-wrap">
            <table className="agency-table agency-events">
              <thead>
                <tr>
                  <th scope="col">{t("event")}</th>
                  <th scope="col">{t("date")}</th>
                  <th scope="col">{t("lead")}</th>
                  <th scope="col">{t("progress")}</th>
                  <th scope="col" className="agency-num">
                    {t("late")}
                  </th>
                  <th scope="col">{t("oldest")}</th>
                </tr>
              </thead>
              <tbody>{view.withDelay.map(eventRow)}</tbody>
              {view.upToDate.length > 0 ? (
                <tbody className="agency-up-to-date">
                  {view.upToDate.map(eventRow)}
                </tbody>
              ) : null}
            </table>
          </div>
        )}
        {view.upToDateCount > 0 ? (
          <p className="agency-fold">
            {t("upToDate", { count: view.upToDateCount })} ·{" "}
            {view.upToDate.length > 0 ? (
              <Link
                href={agencyHref(
                  { ...keep, upToDate: false },
                  "agency-events-title",
                )}
              >
                {t("hide")}
              </Link>
            ) : (
              <Link
                href={agencyHref(
                  { ...keep, upToDate: true },
                  "agency-events-title",
                )}
              >
                {t("show")}
              </Link>
            )}
          </p>
        ) : null}
      </section>
    </>
  );
}
