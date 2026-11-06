// HUB-02 — agenda de l'accueil : calendrier des mois à venir (12 par
// défaut, 3 ou 6 au choix), mariages confirmés en plein, dates posées sur
// un prospect en atténué, badge « 2 » quand deux événements tombent le même
// week-end ; un clic ouvre la fiche de l'événement. Lot 12 (HUB-13) : un
// clic sur une date libre propose de créer un prospect ou un événement.
import Link from "next/link";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, formatMonth, type Locale } from "@symbola/i18n";
import { eventNames, listEvents } from "@/modules/events/service";
import { addMonths, buildCalendar, type CalendarCell } from "./calendar";
import { AGENDA_SPAN_COOKIE } from "./agenda-cookie";
import { AgendaSpanLinks } from "./span-links";
import { AgendaPopovers } from "./agenda-popovers";

const SPANS = [3, 6, 12] as const;

// Vendredi, samedi, dimanche : menu aligné à droite de la date (lot 12).
function alignEnd(date: string): boolean {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return weekday === 0 || weekday >= 5;
}

function parseSpan(value: string | undefined): (typeof SPANS)[number] | null {
  const span = Number(value);
  return (SPANS as readonly number[]).includes(span) ? (span as (typeof SPANS)[number]) : null;
}

export async function AgendaBlock({
  organizationId,
  locale,
  today,
  query,
}: {
  organizationId: string;
  locale: Locale;
  today: string;
  query: { agenda?: string; debut?: string };
}) {
  const t = await getTranslations("Home");
  const tEvents = await getTranslations("Events");
  const remembered = (await cookies()).get(AGENDA_SPAN_COOKIE)?.value;
  const span = parseSpan(query.agenda) ?? parseSpan(remembered) ?? 12;
  const current = today.slice(0, 7);
  const start = query.debut && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.debut) ? query.debut : current;

  const events = (await listEvents({ organizationId }))
    .filter((event) => event.eventDate !== null && event.status !== "lost")
    .map((event) => ({ id: event.id, date: event.eventDate!, status: event.status, names: eventNames(event.clients), isDemo: event.isDemo }));
  const months = buildCalendar({ start, months: span, events });
  const href = (changes: { agenda?: number; debut?: string }) =>
    `/?${new URLSearchParams({ agenda: String(changes.agenda ?? span), debut: changes.debut ?? start }).toString()}`;
  const weekdays = t.raw("agendaWeekdays") as string[];

  const describe = (cell: CalendarCell) =>
    `${formatCalendarDate(cell.date, locale)} : ${cell.events
      .map((event) => `${event.names} (${tEvents(event.status === "confirmed" || event.status === "done" ? "statusConfirmed" : "statusProspect")})`)
      .join(", ")}`;

  return (
    <section className="card" aria-labelledby="agenda-title" data-tour="home-agenda">
      <div className="section-head">
        <div>
          <h2 id="agenda-title">{t("agendaTitle")}</h2>
          <p className="meta">
            <span>
              {formatMonth(`${months[0]!.key}-01`, locale)} – {formatMonth(`${months[months.length - 1]!.key}-01`, locale)}
            </span>
          </p>
        </div>
        <div className="toolbar">
          <nav aria-label={t("agendaNavigate")} className="toolbar">
            <Link href={href({ debut: addMonths(start, -span) })} className="button-link" aria-label={t("agendaPrevious")}>
              ‹
            </Link>
            <Link href={href({ debut: current })} className="button-link">
              {t("agendaToday")}
            </Link>
            <Link href={href({ debut: addMonths(start, span) })} className="button-link" aria-label={t("agendaNext")}>
              ›
            </Link>
          </nav>
          <AgendaSpanLinks
            label={t("agendaSpan")}
            links={SPANS.map((value) => ({ span: value, href: href({ agenda: value }), label: t("agendaMonths", { count: value }), current: value === span }))}
          />
        </div>
      </div>
      <ul className="agenda-legend" aria-label={t("agendaLegend")}>
        <li>
          <span className="agenda-swatch tone-confirmed" aria-hidden="true" />
          {t("agendaLegendConfirmed")}
        </li>
        <li>
          <span className="agenda-swatch tone-tentative" aria-hidden="true" />
          {t("agendaLegendTentative")}
        </li>
        <li>
          <span className="agenda-badge" aria-hidden="true">
            2
          </span>
          {t("agendaLegendTwo")}
        </li>
      </ul>
      <AgendaPopovers containerId="agenda-grid" />
      <div id="agenda-grid" className="agenda-grid" data-span={span}>
        {months.map((month) => (
          <section key={month.key} className="agenda-month" aria-label={formatMonth(`${month.key}-01`, locale)}>
            <h3>{formatMonth(`${month.key}-01`, locale)}</h3>
            <div className="agenda-days">
              {weekdays.map((day, index) => (
                <span key={`${month.key}-h${index}`} className="agenda-weekday" aria-hidden="true">
                  {day}
                </span>
              ))}
              {month.cells.map((cell, index) => {
                if (!cell) return <span key={`${month.key}-e${index}`} />;
                const classes = `agenda-day tone-${cell.tone}${cell.weekend ? " is-weekend" : ""}${cell.date === today ? " is-today" : ""}`;
                // Le chiffre et le badge restent visibles ; le détail se lit en texte masqué
                // (pas d'aria-label qui remplacerait le texte visible, WCAG 2.5.3).
                const badge =
                  cell.events.length > 0 && cell.weekendCount > 1 ? (
                    <span className="agenda-badge">
                      {cell.weekendCount}
                      <span className="sr-only"> {t("agendaWeekendCount", { count: cell.weekendCount })}</span>
                    </span>
                  ) : null;
                const description = cell.events.length > 0 ? <span className="sr-only"> {describe(cell)}</span> : null;
                const names = span === 3 && cell.events.length > 0 ? <span className="agenda-names">{cell.events.map((event) => event.names).join(", ")}</span> : null;
                if (cell.events.length === 0) {
                  return (
                    <details key={cell.date} className={`${classes} agenda-create${alignEnd(cell.date) ? " align-end" : ""}`}>
                      <summary title={t("agendaCreateOn", { date: formatCalendarDate(cell.date, locale) })}>
                        {cell.day}
                        <span className="sr-only"> {t("agendaCreateOn", { date: formatCalendarDate(cell.date, locale) })}</span>
                      </summary>
                      <ul>
                        <li>
                          <Link href={`/events/new?date=${cell.date}`}>{t("agendaCreateProspect")}</Link>
                        </li>
                        <li>
                          <Link href={`/events/new?date=${cell.date}&type=evenement`}>{t("agendaCreateEvent")}</Link>
                        </li>
                      </ul>
                    </details>
                  );
                }
                if (cell.events.length === 1 && cell.weekendCount <= 1) {
                  return (
                    <Link key={cell.date} href={`/events/${cell.events[0]!.id}`} className={classes} title={describe(cell)}>
                      {cell.day}
                      {names}
                      {description}
                    </Link>
                  );
                }
                // Plusieurs événements ce week-end : une petite liste propose chacun.
                return (
                  <details key={cell.date} className={`${classes} agenda-multi${alignEnd(cell.date) ? " align-end" : ""}`}>
                    <summary title={describe(cell)}>
                      {cell.day}
                      {names}
                      {badge}
                      {description}
                    </summary>
                    <ul>
                      {cell.weekendEvents.map((event) => (
                        <li key={event.id}>
                          <Link href={`/events/${event.id}`}>
                            {formatCalendarDate(event.date, locale)} — {event.names}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
