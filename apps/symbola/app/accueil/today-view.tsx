// Lot 32a (HUB-08, UX-01, UX-06 ; décisions D2 à D4) — l'écran « Aujourd'hui » : « À traiter en
// premier », le reste par groupe (replié au-delà de quatre lignes), puis « Mes évènements ». Lot 65c :
// sept lignes en premier, par nature. Chaque ligne dit ce qu'il faut faire, pour quel évènement, quand, qui doit agir,
// et propose l'action en un clic.
import { TaskLine } from "@/app/ui/task-line";
import type { TaskLineView } from "@/lib/tasks/task-line";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import type { EventSummary } from "@symbola/contracts";
import { eventNames } from "@/modules/events/service";
import { EVENT_STATUS_CLASSES, STATUS_LABEL_KEYS } from "@/app/events/event-status";
import { daysUntil, TODAY_GROUPS, type RankedItem, type RankedToday, type TodayGroup, TODAY_HORIZON_DAYS } from "@/lib/today/rank";
import { isActiveEvent, type TodaySource, type TodayWords } from "@/lib/today/load";
import { HOME_FIRST_COUNT, todayParts } from "@/lib/today/parts";
import { completeTaskAction } from "./actions";
import { completeStandaloneTaskAction } from "@/app/taches/standalone-actions";
import { NoteReminderButton } from "./note-reminder";

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
    // Lot 58 (PAR-09) : l'évènement passé dont la liste de clôture attend.
    closingDue: t("words.closingDue"),
    linkRenewal: (name) => t("words.linkRenewal", { name }),
    guestPurge: (stage) => t(stage === "diets" ? "words.guestPurgeDiets" : "words.guestPurgeAll"),
    guestOpposition: (count) => t("words.guestOpposition", { count }),
    appointment: (time, type, person) => t("words.appointment", { time, type, person }),
    appointmentChange: (change, time, type, person) => t(`words.appointmentChange.${change}`, { time, type, person }),
    calendarSourceError: (label) => t("words.calendarSourceError", { label }),
    prospectRequest: (names, when) => (when ? t("words.prospectRequest", { names, when }) : t("words.prospectRequestNoDate", { names })),
    prospectRequestDateTaken: t("words.prospectRequestDateTaken"),
    prospectToReview: (count) => t("words.prospectToReview", { count }),
    // Lot 45 (CRM-06, POR-07, CRM-07).
    followUpReady: (names) => t("words.followUpReady", { names }),
    questionnaireFinished: (names, questionnaire) => t("words.questionnaireFinished", { names, questionnaire }),
    contactDuplicates: (count) => t("words.contactDuplicates", { count }),
    vendorAnswer: (vendor, slot, answer) => t(`words.vendorAnswer.${answer}`, { vendor, slot }),
    vendorChoice: (vendor, slot) => t("words.vendorChoice", { vendor, slot }),
    vendorRoadmap: (vendor) => t("words.vendorRoadmap", { vendor }),
    transferDeclaration: (name, amount) => t("words.transferDeclaration", { name, amount }),
    // Lot 48a (PRE-05, PRE-10, SEC-27).
    vendorDocument: (vendor, document, reason) => t(`words.vendorDocument.${reason}`, { vendor, document }),
    vendorBankCheck: (vendor) => t("words.vendorBankCheck", { vendor }),
    standaloneTask: t("words.standaloneTaskTag"),
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

export async function TodayItemLine({ item, locale, returnTo, taskLine }: { item: RankedItem; locale: Locale; returnTo: "home" | "event"; taskLine?: TaskLineView | undefined }) {
  // Lot 70c (CHR-02, HUB-08 ; D3, M3, M4) : une tâche prend la ligne type allégée — titre en encre qui ouvre
  // le panneau, nom du mariage en lien séparé vers sa fiche, échéance et son état, qui s'en charge, « Fait »
  // (confiée aux mariés comprise), sans menu ; « Ouvrir » disparaît.
  if (taskLine) return <TaskLine line={taskLine} form="today" shortcuts={[]} assignOptions={[]} />;
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
      ) : item.action?.kind === "check_standalone_task" ? (
        <form action={completeStandaloneTaskAction} className="today-action">
          <input type="hidden" name="taskId" value={item.action.taskId} />
          <button type="submit" aria-label={t("action.checkTaskLabel", { label: item.title })}>
            {t("action.checkTask")}
          </button>
        </form>
      ) : item.action?.kind === "remind_vendor" && item.actor.kind === "vendor" ? (
        <NoteReminderButton eventId={item.action.eventId} candidateId={item.action.candidateId} vendorName={item.actor.name} />
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

// Lot 65c (HUB-08, UX-01 ; maquette M15 retouchée) — « À traiter en premier » : sept lignes au plus,
// par priorité puis par délai, découpées par nature (relances, tâches, paiements, décisions…) ;
// chaque partie dit son nombre et mène à sa page quand elle existe.
export async function TodayFirst({
  ranked,
  locale,
  modules,
  taskLines = {},
  doneToday = 0,
}: {
  ranked: RankedToday;
  locale: Locale;
  modules: { quotes: boolean; events: boolean };
  taskLines?: Record<string, TaskLineView>;
  // Lot 70c (D1) : « 3 tâches faites aujourd'hui · Les revoir ».
  doneToday?: number;
}) {
  const t = await getTranslations("Today");
  const tLine = await getTranslations("TaskLine");
  const parts = todayParts(ranked, modules);
  return (
    <section className="card today-first" aria-labelledby="today-first-title" data-tour="home-first">
      <h2 id="today-first-title">{t("firstTitle")}</h2>
      {parts.length === 0 ? (
        <p>{t("firstEmpty")}</p>
      ) : (
        parts.map((part) => (
          <div key={part.nature} className="today-part">
            <div className="today-part-head">
              {/* Lot 67b (HUB-08 ; R01) : la partie des tâches dit son horizon (retard ou échéance proche). */}
              <h3 id={`today-part-${part.nature}`}>{t(`parts.${part.nature}`, { count: part.total, days: TODAY_HORIZON_DAYS })}</h3>
              {part.link ? (
                <Link href={part.link.href} className="today-part-link">
                  {t(`partLink.${part.link.kind}`)} ›
                </Link>
              ) : null}
            </div>
            <ul className="today-items" aria-labelledby={`today-part-${part.nature}`}>
              {part.items.map((item) => (
                <TodayItemLine key={item.key} item={item} locale={locale} returnTo="home" taskLine={item.task ? taskLines[item.task.id] : undefined} />
              ))}
            </ul>
            {part.nature === "tasks" && doneToday > 0 ? (
              <p className="today-done-today">
                {tLine("doneToday", { count: doneToday })} · <Link href="/taches?etat=faites">{tLine("review")}</Link>
              </p>
            ) : null}
          </div>
        ))
      )}
    </section>
  );
}

// Le reste (au-delà des sept), par groupe, replié au-delà de quatre lignes ; sous le calendrier.
export async function TodayRest({ ranked, locale, taskLines = {} }: { ranked: RankedToday; locale: Locale; taskLines?: Record<string, TaskLineView> }) {
  const t = await getTranslations("Today");
  const first = new Set(ranked.all.slice(0, HOME_FIRST_COUNT).map((item) => item.key));
  const rest = TODAY_GROUPS.map((group) => ({ group, items: ranked.groups[group].filter((item) => !first.has(item.key)) })).filter((entry) => entry.items.length > 0);
  if (rest.length === 0) return null;
  return (
    <section className="card today-groups" aria-labelledby="today-rest-title" data-tour="home-groups">
      <h2 id="today-rest-title">{t("restTitle")}</h2>
      {rest.map(({ group, items }) => (
        <div key={group} className="today-group">
          <h3 id={`today-group-${group}`}>{t(`group.${group}`)}</h3>
          <ul className="today-items" aria-labelledby={`today-group-${group}`}>
            {items.slice(0, GROUP_VISIBLE).map((item) => (
              <TodayItemLine key={item.key} item={item} locale={locale} returnTo="home" taskLine={item.task ? taskLines[item.task.id] : undefined} />
            ))}
          </ul>
          {items.length > GROUP_VISIBLE ? (
            <details>
              <summary>{t("more", { count: items.length - GROUP_VISIBLE })}</summary>
              <ul className="today-items">
                {items.slice(GROUP_VISIBLE).map((item) => (
                  <TodayItemLine key={item.key} item={item} locale={locale} returnTo="home" taskLine={item.task ? taskLines[item.task.id] : undefined} />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ))}
    </section>
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
                  {eventNames(event.clients, event.name)}
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
