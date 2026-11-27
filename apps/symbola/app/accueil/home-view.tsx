// Lot 72b (HUB-08, UX-01, UX-06, UX-13, HUB-11, AIDE-04, PAR-03 ; spécification du lot 72, § 5.2 ; maquettes
// 13 et 14 du lot 68, choix A1 à A5) — l'écran « Aujourd'hui » : l'en-tête et son compte, l'état vide d'un
// espace neuf, la carte « À traiter en premier » (sept lignes, puis « Tout afficher » sur place), « Mes
// évènements » et la ligne « Pour bien démarrer ». Chaque ligne a la même anatomie que la ligne allégée d'une
// tâche (70c) : le titre, seule cible, qui ouvre l'objet ; le contact à appeler sous le titre ; le nom du
// mariage en lien séparé (M4) ; l'échéance et son état en mots ; qui agit ; une action rapide d'une seule
// taille (« Fait », « Noter une relance », « Agir », ou rien pour un paiement : J6). « Ouvrir » n'existe plus.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, formatShortCalendarDate, type Locale } from "@symbola/i18n";
import type { EventSummary } from "@symbola/contracts";
import { TaskLine } from "@/app/ui/task-line";
import { LineContact } from "@/app/ui/line-contact";
import { dueWords, type TaskLineView } from "@/lib/tasks/task-line";
import { eventNames, taskDueState } from "@/modules/events/service";
import { EVENT_STATUS_CLASSES, STATUS_LABEL_KEYS } from "@/app/events/event-status";
import { daysUntil, TODAY_HORIZON_DAYS, type RankedItem, type RankedToday } from "@/lib/today/rank";
import { contactParts, eventPointsWord, type HomeState, type TodayCard } from "@/lib/today/home";
import { isActiveEvent } from "@/lib/today/load";
import type { FirstStepsLine } from "@/lib/onboarding/first-steps";
import type { ChecklistItem } from "@/lib/onboarding/checklist";
import { NoteReminderButton } from "./note-reminder";
import { TodayCardFrame, WhenExpanded } from "./today-card-client";
import { FirstStepsHideButton } from "./first-steps-hide";

type TodayTranslator = Awaited<ReturnType<typeof getTranslations<"Today">>>;

function dayText(now: Date, locale: Locale, withYear: boolean): string {
  const text = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}), timeZone: "Europe/Paris" }).format(now);
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

// Le haut de l'écran : le titre, la date et « N évènements en cours », puis le compte (A1, C-20). Sur téléphone,
// la date perd l'année et le compte perd « à traiter » (maquette 13, 375 px).
export async function TodayHeader({ now, locale, activeEvents, ranked, state }: { now: Date; locale: Locale; activeEvents: number | null; ranked: RankedToday; state: HomeState }) {
  const t = await getTranslations("Today");
  const days = TODAY_HORIZON_DAYS;
  const events = activeEvents === null ? null : t("eventsInProgress", { count: activeEvents });
  return (
    <div className="page-header today-header">
      <h1>{t("title")}</h1>
      <p className="today-summary">
        <span className="today-date-long">{dayText(now, locale, true)}</span>
        <span className="today-date-short">{dayText(now, locale, false)}</span>
        {events ? ` · ${events}` : null}
      </p>
      {state.kind === "empty" ? null : (
        <p className="today-count">
          {state.kind === "quiet"
            ? t("countQuiet", { days, count: state.withoutTasks.length })
            : ranked.points === 0
              ? t("countNone", { days })
              : t.rich("count", {
                  points: ranked.points,
                  days,
                  late: ranked.late,
                  long: (chunks) => <span className="today-count-long">{chunks}</span>,
                  red: (chunks) => <strong className="today-count-late">{chunks}</strong>,
                })}
        </p>
      )}
    </div>
  );
}

// L'état vide d'un espace neuf (C-15, P-05 ; gabarit de DESIGN.md) : un titre, une phrase, la seule action
// principale, l'autre voie en ligne à part. L'action suit la réponse à l'assistant (R3, I5 du lot 71).
export async function EmptyHome({ takeoverFirst }: { takeoverFirst: boolean }) {
  const t = await getTranslations("Today.empty");
  return (
    <section className="empty-state today-empty" aria-labelledby="today-empty-title" data-tour="home-first">
      <h2 id="today-empty-title">{takeoverFirst ? t("takeoverTitle") : t("title")}</h2>
      <p>{takeoverFirst ? t("takeoverBody") : t("body")}</p>
      <div className="row-wrap">
        <Link href={takeoverFirst ? "/reprise" : "/events/new"} className="button-link button-link-primary">
          {takeoverFirst ? t("takeoverAction") : t("newEvent")}
        </Link>
      </div>
      <p className="today-empty-other">
        {takeoverFirst ? t("otherNew") : t("otherTakeover")} <Link href={takeoverFirst ? "/events/new" : "/reprise"}>{takeoverFirst ? t("newEvent") : t("otherTakeoverLink")}</Link>
      </p>
    </section>
  );
}

function actorText(item: RankedItem, t: TodayTranslator): string {
  return item.actor.kind === "vendor" ? t("actor.vendor", { name: item.actor.name }) : t(`actor.${item.actor.kind}`);
}

// Une ligne qui n'est pas une tâche (relance, paiement, décision, alerte du radar…), dans l'anatomie de la
// ligne allégée.
async function HomeLine({ item, locale, today, soonDays, rest }: { item: RankedItem; locale: Locale; today: string; soonDays: number; rest: boolean }) {
  const t = await getTranslations("Today");
  const tLine = await getTranslations("TaskLine");
  const due = item.dueOn ? dueWords(taskDueState({ dueDate: item.dueOn, done: false }, today, soonDays), (key, values) => tLine(key as never, values as never)) : null;
  const date = item.dueOn ? formatShortCalendarDate(item.dueOn, locale) : item.since ? t("due.since", { date: formatShortCalendarDate(item.since, locale) }) : null;
  return (
    <li className="task-line home-line" data-form="today" data-due={due?.kind} data-rest={rest ? "true" : undefined}>
      <span className="task-line-title">
        <Link href={item.href} scroll={false} className="task-title-link">
          {item.title}
        </Link>
        {item.detail ? <span className="home-line-detail">{item.detail}</span> : null}
      </span>
      <LineContact contact={contactParts(item.contact)} />
      <span className="task-line-event">
        {item.eventId && item.eventNames ? (
          <Link href={`/events/${item.eventId}`} className="task-event-link">
            {item.eventNames}
          </Link>
        ) : null}
      </span>
      <span className="task-line-due">
        {date ? <span className="task-line-date">{date}</span> : null}
        {due ? (
          <span className="task-state" data-kind={due.kind}>
            {due.icon ? (
              <span className="task-state-icon" aria-hidden="true">
                {due.icon === "late" ? "!" : "◷"}
              </span>
            ) : null}
            {due.text}
          </span>
        ) : null}
      </span>
      <span className="task-line-who">
        <span className="task-who-name">{actorText(item, t)}</span>
      </span>
      <span className="task-line-actions">
        {item.action?.kind === "remind_vendor" && item.actor.kind === "vendor" ? (
          <NoteReminderButton eventId={item.action.eventId} candidateId={item.action.candidateId} vendorName={item.actor.name} />
        ) : item.kind === "watch" ? (
          <Link href={item.href} className="button-link" aria-label={t("action.actLabel", { title: item.title })}>
            {t("action.act")}
          </Link>
        ) : null}
      </span>
    </li>
  );
}

// « À traiter en premier » (M15, A1, C-20) : sept lignes au plus, par nature ; chaque partie dit « 4 sur 7 »
// quand elle n'est pas entière ; « 4 autres points d'ici 14 jours · Tout afficher » ouvre le reste sur place.
export async function TodayCardView({
  card,
  ranked,
  locale,
  today,
  soonDays,
  taskLines,
  doneToday,
  expanded,
  quiet,
}: {
  card: TodayCard;
  ranked: RankedToday;
  locale: Locale;
  today: string;
  soonDays: number;
  taskLines: Record<string, TaskLineView>;
  doneToday: number;
  expanded: boolean;
  // Au lendemain d'une reprise : le premier mariage sans tâche, où mènent les deux liens de la phrase.
  quiet: { eventId: string } | null;
}) {
  const t = await getTranslations("Today");
  const tLine = await getTranslations("TaskLine");
  const days = TODAY_HORIZON_DAYS;
  const points = (count: number) => t("cardPoints", { count });
  const tasksHref = quiet ? `/events/${quiet.eventId}?onglet=taches` : null;
  return (
    <TodayCardFrame initiallyExpanded={expanded} rest={card.rest} labelledBy="today-first-title" restLine={{ text: t("restLine", { count: card.rest, days }), button: t("showAll") }}>
      <h2 id="today-first-title">
        {t("firstTitle")}
        <span className="today-first-count">
          {" · "}
          {card.rest > 0 ? <WhenExpanded collapsed={t("partOf", { shown: card.shown, total: ranked.points })} expanded={points(ranked.points)} /> : points(ranked.points)}
        </span>
      </h2>
      {card.parts.length === 0 ? (
        <p className="today-first-empty">
          {tasksHref
            ? t.rich("quietBody", {
                days,
                import: (chunks) => <Link href={tasksHref}>{chunks}</Link>,
                template: (chunks) => <Link href={tasksHref}>{chunks}</Link>,
              })
            : t("noneBody", { days })}
        </p>
      ) : (
        card.parts.map((part) => {
          const whole = part.shown === part.total;
          const linkLabel = part.link
            ? part.link.kind === "tasks"
              ? whole
                ? t("partLink.tasks")
                : <WhenExpanded collapsed={t("partLink.tasksAll", { count: part.total })} expanded={t("partLink.tasks")} />
              : t(`partLink.${part.link.kind}`)
            : null;
          return (
            <div key={part.nature} className="today-part" data-rest={part.shown === 0 ? "true" : undefined}>
              <div className="today-part-head">
                <h3 id={`today-part-${part.nature}`}>
                  {t(`parts.${part.nature}`)} <span className="today-part-count">{whole ? part.total : <WhenExpanded collapsed={t("partOf", { shown: part.shown, total: part.total })} expanded={String(part.total)} />}</span>
                </h3>
                {part.link && linkLabel ? (
                  <Link href={part.link.href} className="today-part-link">
                    {linkLabel}
                  </Link>
                ) : null}
              </div>
              <ul className="today-items" aria-labelledby={`today-part-${part.nature}`}>
                {part.lines.map(({ item, rest }) => {
                  const line = item.task ? taskLines[item.task.id] : undefined;
                  return line ? (
                    <TaskLine key={item.key} line={line} form="today" shortcuts={[]} assignOptions={[]} contact={contactParts(item.contact)} rest={rest} />
                  ) : (
                    <HomeLine key={item.key} item={item} locale={locale} today={today} soonDays={soonDays} rest={rest} />
                  );
                })}
              </ul>
            </div>
          );
        })
      )}
      {doneToday > 0 ? (
        <p className="today-done-today">
          {tLine("doneToday", { count: doneToday })} · <Link href="/taches?etat=faites">{tLine("review")}</Link>
        </p>
      ) : null}
    </TodayCardFrame>
  );
}

// « Mes évènements » (C-14 ; § 6 de la synthèse) : sous la carte, avant le calendrier (A5) ; chaque mariage
// dit ses points et ses retards, la même répartition que le compte du haut.
export async function MyEventsView({ events, ranked, today, locale }: { events: EventSummary[]; ranked: RankedToday; today: string; locale: Locale }) {
  const t = await getTranslations("Today");
  const tEvents = await getTranslations("Events");
  const active = events
    .filter((event) => isActiveEvent(event) && !event.isDemo)
    .sort((a, b) => (a.eventDate ?? "9999-12-31").localeCompare(b.eventDate ?? "9999-12-31"));
  return (
    <section className="card today-my-events" aria-labelledby="my-events-title" data-tour="home-events">
      <div className="today-part-head">
        <h2 id="my-events-title">{t("myEventsTitle")}</h2>
        <p className="today-my-events-count">
          {t("myEventsCount", { count: active.length })} · <Link href="/events">{t("allEvents")}</Link>
        </p>
      </div>
      {active.length === 0 ? (
        <p>{t("myEventsEmpty")}</p>
      ) : (
        <ul className="today-events">
          {active.map((event) => {
            const days = event.eventDate ? daysUntil(event.eventDate, today) : null;
            const word = eventPointsWord({ points: ranked.pointsByEvent.get(event.id) ?? 0, late: ranked.lateByEvent.get(event.id) ?? 0, event });
            return (
              <li key={event.id} className="today-event">
                <Link href={`/events/${event.id}`} className="today-item-title">
                  {eventNames(event.clients, event.name)}
                </Link>
                <span className="today-item-meta">
                  {event.eventDate ? formatCalendarDate(event.eventDate, locale) : t("dateUnset")}
                  {days === null ? "" : ` · ${days >= 0 ? t("countdown", { days }) : t("countdownPast")}`}
                </span>
                <span className="today-item-tags">
                  <span className={EVENT_STATUS_CLASSES[event.status]}>{tEvents(STATUS_LABEL_KEYS[event.status])}</span>
                  {word.kind === "points" ? (
                    <span className="today-event-points">
                      {t.rich("eventPoints", { points: word.points, late: word.late, red: (chunks) => <strong className="today-count-late">{chunks}</strong> })}
                    </span>
                  ) : (
                    <span className="today-event-points">{word.kind === "noTasks" ? t("noTasksYet") : t("upToDate")}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// « Pour bien démarrer » en une ligne, en bas de l'écran (C-18, J5) : « 1 sur 2 · reste : … », l'étape
// suivante, « Masquer » (pour de bon, pour cette personne). Dans l'état vide, les étapes sont listées.
export async function FirstStepsView({ line, items, listed }: { line: FirstStepsLine; items: ChecklistItem[]; listed: boolean }) {
  const t = await getTranslations("Onboarding.checklist");
  const tToday = await getTranslations("Today");
  const remaining = line.remaining.map((key) => t(`short.${key}`)).join(", ");
  return (
    <section className="card first-steps-line" aria-labelledby="first-steps-title">
      <p className="first-steps-summary">
        <strong id="first-steps-title">{t("title")}</strong>
        <span>
          {" · "}
          {t("count", { done: line.done, total: line.total })}
        </span>
        {listed ? null : (
          <span>
            {" · "}
            {t("remaining", { steps: remaining })}
          </span>
        )}
      </p>
      {listed ? null : (
        <div className="first-steps-actions">
          <Link href={line.next.href} className="button-link">
            {t(`action.${line.next.key}`)}
          </Link>
          <FirstStepsHideButton labels={{ hide: t("hide"), hidden: t("hiddenMessage"), shown: t("shownMessage"), undo: tToday("undo.action"), failed: t("hideFailed") }} />
        </div>
      )}
      {listed ? (
        <ol className="first-steps-list">
          {items
            .filter((item) => !item.done)
            .map((item) => (
              <li key={item.key}>
                <Link href={item.href}>{t(`items.${item.key}`)}</Link>
              </li>
            ))}
        </ol>
      ) : null}
    </section>
  );
}
