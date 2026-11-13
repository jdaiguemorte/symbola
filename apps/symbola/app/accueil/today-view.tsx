// Lot 32a (HUB-08, UX-01, UX-06 ; décisions D2 à D4) — l'écran « Aujourd'hui » : « À traiter en
// premier » (les trois plus urgents), le reste par groupe (replié au-delà de quatre lignes), puis
// « Mes évènements ». Chaque ligne dit ce qu'il faut faire, pour quel évènement, quand, qui doit agir,
// et propose l'action en un clic.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import type { EventSummary } from "@symbola/contracts";
import { eventNames } from "@/modules/events/service";
import { EVENT_STATUS_CLASSES, STATUS_LABEL_KEYS } from "@/app/events/event-status";
import { daysUntil, TODAY_GROUPS, type RankedItem, type RankedToday, type TodayGroup } from "@/lib/today/rank";
import { isActiveEvent, type TodaySource, type TodayWords } from "@/lib/today/load";
import { completeTaskAction } from "./actions";
import { RemindVendorButton } from "./today-client";

type TodayTranslator = Awaited<ReturnType<typeof getTranslations<"Today">>>;

export function todayWords(t: TodayTranslator): TodayWords {
  return {
    clientTask: t("words.clientTask"),
    amount: (label, amount) => t("words.amount", { label, amount }),
    decision: (title) => t("words.decision", { title }),
    paymentDeclaration: (label, amount) => t("words.paymentDeclaration", { label, amount }),
    quoteFollowUp: (number) => t("words.quoteFollowUp", { number }),
    prospectFollowUp: t("words.prospectFollowUp"),
    depositBlocked: (number) => t("words.depositBlocked", { number }),
    vendorContract: (vendor, slot) => t("words.vendorContract", { vendor, slot }),
    dateConflict: (count) => t("words.dateConflict", { count }),
    linkRenewal: (name) => t("words.linkRenewal", { name }),
  };
}

// « Vendredi 13 novembre 2026 » : la date du jour, à Paris.
export function longDate(now: Date, locale: Locale): string {
  const text = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(now);
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

const GROUP_BADGE: Record<TodayGroup, string> = { overdue: "badge badge-terracotta", today: "badge badge-sauge", waiting: "badge badge-ambre", upcoming: "badge" };
const GROUP_VISIBLE = 4;

function whenLabel(item: RankedItem, t: TodayTranslator, locale: Locale): string {
  if (item.group === "overdue") return t("due.overdue", { days: item.daysLate });
  if (item.group === "today" && item.dueOn !== null) return t("due.today");
  if (item.dueOn !== null) return t("due.on", { date: formatCalendarDate(item.dueOn, locale) });
  if (item.since !== null) return t("due.since", { date: formatCalendarDate(item.since, locale) });
  return t(`group.${item.group}`);
}

function actorLabel(item: RankedItem, t: TodayTranslator): string {
  return item.actor.kind === "vendor" ? t("actor.vendor", { name: item.actor.name }) : t(`actor.${item.actor.kind}`);
}

export async function TodayItemLine({ item, locale, returnTo }: { item: RankedItem; locale: Locale; returnTo: "home" | "event" }) {
  const t = await getTranslations("Today");
  const meta = [returnTo === "home" ? item.eventNames : null, item.detail].filter((part): part is string => Boolean(part)).join(" · ");
  return (
    <li className="today-item" data-group={item.group}>
      <div className="today-item-body">
        <Link href={item.href} className="today-item-title">
          {item.title}
        </Link>
        {meta ? <p className="today-item-meta">{meta}</p> : null}
        <p className="today-item-tags">
          <span className={GROUP_BADGE[item.group]}>{whenLabel(item, t, locale)}</span>
          <span className="today-item-actor">{actorLabel(item, t)}</span>
        </p>
      </div>
      {item.action?.kind === "check_task" ? (
        <form action={completeTaskAction} className="today-action">
          <input type="hidden" name="eventId" value={item.action.eventId} />
          <input type="hidden" name="taskId" value={item.action.taskId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <button type="submit" aria-label={t("action.checkTaskLabel", { label: item.title })}>
            {t("action.checkTask")}
          </button>
        </form>
      ) : item.action?.kind === "remind_vendor" && item.actor.kind === "vendor" ? (
        <RemindVendorButton
          eventId={item.action.eventId}
          candidateId={item.action.candidateId}
          label={t("action.remindVendor")}
          ariaLabel={t("action.remindVendorLabel", { vendor: item.actor.name })}
        />
      ) : (
        <div className="today-action">
          <Link href={item.href} className="button-link" aria-label={t("action.openLabel", { title: item.title })}>
            {t("action.open")}
          </Link>
        </div>
      )}
    </li>
  );
}

export async function TodayList({ ranked, locale }: { ranked: RankedToday; locale: Locale }) {
  const t = await getTranslations("Today");
  const first = new Set(ranked.first.map((item) => item.key));
  const rest = TODAY_GROUPS.map((group) => ({ group, items: ranked.groups[group].filter((item) => !first.has(item.key)) })).filter((entry) => entry.items.length > 0);
  return (
    <>
      <section className="card today-first" aria-labelledby="today-first-title" data-tour="home-first">
        <h2 id="today-first-title">{t("firstTitle")}</h2>
        {ranked.first.length === 0 ? (
          <p>{t("firstEmpty")}</p>
        ) : (
          <ul className="today-items">
            {ranked.first.map((item) => (
              <TodayItemLine key={item.key} item={item} locale={locale} returnTo="home" />
            ))}
          </ul>
        )}
      </section>
      {rest.length > 0 ? (
        <section className="card today-groups" aria-labelledby="today-rest-title" data-tour="home-groups">
          <h2 id="today-rest-title">{t("restTitle")}</h2>
          {rest.map(({ group, items }) => (
            <div key={group} className="today-group">
              <h3 id={`today-group-${group}`}>{t(`group.${group}`)}</h3>
              <ul className="today-items" aria-labelledby={`today-group-${group}`}>
                {items.slice(0, GROUP_VISIBLE).map((item) => (
                  <TodayItemLine key={item.key} item={item} locale={locale} returnTo="home" />
                ))}
              </ul>
              {items.length > GROUP_VISIBLE ? (
                <details>
                  <summary>{t("more", { count: items.length - GROUP_VISIBLE })}</summary>
                  <ul className="today-items">
                    {items.slice(GROUP_VISIBLE).map((item) => (
                      <TodayItemLine key={item.key} item={item} locale={locale} returnTo="home" />
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}

export async function MyEvents({ events, ranked, today, locale }: { events: EventSummary[]; ranked: RankedToday; today: string; locale: Locale }) {
  const t = await getTranslations("Today");
  const tEvents = await getTranslations("Events");
  const active = events
    .filter((event) => isActiveEvent(event) && !event.isDemo)
    .sort((a, b) => (a.eventDate ?? "9999-12-31").localeCompare(b.eventDate ?? "9999-12-31"));
  return (
    <section className="card" aria-labelledby="my-events-title" data-tour="home-events">
      <h2 id="my-events-title">{t("myEventsTitle")}</h2>
      {active.length === 0 ? (
        <p>{t("myEventsEmpty")}</p>
      ) : (
        <ul className="today-events">
          {active.map((event) => {
            const days = event.eventDate ? daysUntil(event.eventDate, today) : null;
            const points = ranked.attentionByEvent.get(event.id) ?? 0;
            return (
              <li key={event.id} className="today-event">
                <Link href={`/events/${event.id}`} className="today-item-title">
                  {eventNames(event.clients)}
                </Link>
                <span className="today-item-meta">
                  {event.eventDate ? formatCalendarDate(event.eventDate, locale) : t("dateUnset")}
                  {days === null ? "" : ` · ${days >= 0 ? t("countdown", { days }) : t("countdownPast")}`}
                </span>
                <span className="today-item-tags">
                  <span className={EVENT_STATUS_CLASSES[event.status]}>{tEvents(STATUS_LABEL_KEYS[event.status])}</span>
                  <span className={points > 0 ? "badge badge-ambre" : "badge"}>{points > 0 ? t("points", { count: points }) : t("upToDate")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ARC-07 : une source lente ou en panne est signalée ; le reste de la liste s'affiche.
export async function UnavailableNotice({ sources }: { sources: TodaySource[] }) {
  if (sources.length === 0) return null;
  const t = await getTranslations("Today");
  return (
    <p className="notice" role="status">
      {t("unavailable", { sources: sources.map((source) => t(`source.${source}`)).join(", ") })}
    </p>
  );
}
