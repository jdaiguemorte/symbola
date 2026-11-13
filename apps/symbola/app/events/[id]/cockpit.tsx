// Lot 32a (EVT-02, UX-01, UX-06 ; D5) — la « Synthèse » d'un évènement : la prochaine action (son
// échéance, qui doit agir, l'action ; « Reporter » pour une tâche) et les deux suivantes, trois
// indicateurs de santé (planning, budget, décisions du client), puis les quatorze prochains jours.
// Les urgences sont celles de « Aujourd'hui », restreintes à l'évènement.
import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import type { EventTask } from "@symbola/contracts";
import { listEventDecisions } from "@/modules/events/service";
import { listBudgetLines } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { loadTodayItems } from "@/lib/today/load";
import { daysUntil, rankToday, TODAY_HORIZON_DAYS, type RankedItem } from "@/lib/today/rank";
import { TodayItemLine, todayWords, UnavailableNotice } from "@/app/accueil/today-view";
import { PostponeTaskForm } from "@/app/accueil/today-client";

const FOLLOWING_COUNT = 2;

function plusDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

// Une tâche (la vôtre ou celle du client) se reporte ; le reste non.
function taskIdOf(item: RankedItem): string | null {
  return item.key.startsWith("task:") ? item.key.slice("task:".length) : null;
}

export async function EventCockpit({
  organizationId,
  eventId,
  tasks,
  quotesAvailable,
  today,
  locale,
  afterNextAction,
  vendorProgress,
}: {
  organizationId: string;
  eventId: string;
  tasks: EventTask[];
  quotesAvailable: boolean;
  today: string;
  locale: Locale;
  // UX-01 : ce qui suit la prochaine action (le bandeau de la prochaine étape de la fiche).
  afterNextAction?: ReactNode;
  // PRD-EVT-03 : lignes pourvues sur les lignes requises, avec la barre d'avancement.
  vendorProgress: { booked: number; required: number };
}) {
  const t = await getTranslations("Today");
  const tEvents = await getTranslations("Events");
  const budgetAvailable = await isBudgetModuleEnabled(organizationId);
  const { items, unavailable } = await loadTodayItems(organizationId, { events: true, quotes: quotesAvailable, budget: budgetAvailable }, todayWords(t), locale);
  const ranked = rankToday(
    items.filter((item) => item.eventId === eventId),
    today,
  );
  const [next, ...rest] = ranked.all;
  const following = rest.slice(0, FOLLOWING_COUNT);
  // Le reste des points de l'évènement, replié : tout s'y traite sans quitter la synthèse.
  const others = rest.slice(FOLLOWING_COUNT);
  const nextTaskId = next ? taskIdOf(next) : null;

  // Santé : planning, budget engagé sur l'enveloppe, décisions du client en attente.
  const doneCount = tasks.filter((task) => task.done).length;
  const overdueCount = tasks.filter((task) => !task.done && task.dueDate < today).length;
  const budget = budgetAvailable ? await listBudgetLines(organizationId, eventId) : null;
  const pending = (await listEventDecisions(organizationId, eventId))
    .filter((decision) => decision.status === "pending")
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const oldest = pending[0];

  // Les quatorze prochains jours : ce qui a une date, du jour à J+14, par date.
  const horizon = plusDays(today, TODAY_HORIZON_DAYS);
  const nextDays = ranked.all
    .filter((item) => item.dueOn !== null && item.dueOn >= today && item.dueOn <= horizon)
    .sort((a, b) => a.dueOn!.localeCompare(b.dueOn!));

  return (
    <>
      <section className="card today-first" aria-labelledby="next-action-title" data-tour="event-overview">
        <h2 id="next-action-title">{t("cockpit.nextActionTitle")}</h2>
        <UnavailableNotice sources={unavailable} />
        {next ? (
          <>
            <ul className="today-items">
              <TodayItemLine item={next} locale={locale} returnTo="event" />
              {following.map((item) => (
                <TodayItemLine key={item.key} item={item} locale={locale} returnTo="event" />
              ))}
            </ul>
            {nextTaskId ? (
              <PostponeTaskForm
                eventId={eventId}
                taskId={nextTaskId}
                defaultDate={plusDays(next.dueOn && next.dueOn > today ? next.dueOn : today, 7)}
                labels={{ summary: t("cockpit.postpone"), date: t("cockpit.postponeTo"), save: t("cockpit.postponeSave") }}
              />
            ) : null}
            {others.length > 0 ? (
              <details>
                <summary>{t("more", { count: others.length })}</summary>
                <ul className="today-items">
                  {others.map((item) => (
                    <TodayItemLine key={item.key} item={item} locale={locale} returnTo="event" />
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        ) : (
          <p>{t("cockpit.nextActionEmpty")}</p>
        )}
      </section>
      {afterNextAction}

      <section className="card" aria-labelledby="health-title">
        <h2 id="health-title">{t("cockpit.healthTitle")}</h2>
        <dl className="health-tiles">
          <div>
            <dt>{t("cockpit.planningTitle")}</dt>
            <dd>{t("cockpit.planningValue", { done: doneCount, total: tasks.length })}</dd>
            <dd className={overdueCount > 0 ? "health-detail text-overdue" : "health-detail"}>{t("cockpit.planningOverdue", { count: overdueCount })}</dd>
          </div>
          {budget ? (
            <div>
              <dt>{t("cockpit.budgetTitle")}</dt>
              <dd>{t("cockpit.budgetValue", { committed: formatAmount(budget.totalCommittedCents, locale) })}</dd>
              <dd className={budget.envelope?.exceeded ? "health-detail text-overdue" : "health-detail"}>
                {budget.envelope ? t("cockpit.budgetEnvelope", { envelope: formatAmount(budget.envelope.amountCents, locale) }) : t("cockpit.budgetNoEnvelope")}
              </dd>
              <dd className="health-detail">
                <Link href={`/events/${eventId}?onglet=budget`}>{t("cockpit.budgetOpen")}</Link>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>{t("cockpit.decisionsTitle")}</dt>
            <dd>{t("cockpit.decisionsValue", { count: pending.length })}</dd>
            {oldest ? (
              <dd className="health-detail">
                <Link href={`/events/${eventId}?onglet=maries`}>
                  {t("cockpit.decisionsOldest", { title: oldest.title, date: formatCalendarDate(parisToday(new Date(oldest.requestedAt)), locale) })}
                </Link>
              </dd>
            ) : null}
          </div>
        </dl>
        <p id="vendor-progress-label">{tEvents("vendorProgress", vendorProgress)}</p>
        <progress aria-labelledby="vendor-progress-label" value={vendorProgress.booked} max={Math.max(vendorProgress.required, 1)} />
      </section>

      <section className="card" aria-labelledby="next-days-title">
        <h2 id="next-days-title">{t("cockpit.nextDaysTitle")}</h2>
        {nextDays.length === 0 ? (
          <p>{t("cockpit.nextDaysEmpty")}</p>
        ) : (
          <ul className="today-items">
            {nextDays.map((item) => (
              <TodayItemLine key={item.key} item={item} locale={locale} returnTo="event" />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// En-tête : « 68 jours avant le jour J ».
export async function countdownLabel(eventDate: string | null, today: string): Promise<string | null> {
  if (!eventDate) return null;
  const t = await getTranslations("Today");
  const days = daysUntil(eventDate, today);
  return days >= 0 ? t("cockpit.countdown", { days }) : t("cockpit.countdownPast");
}
