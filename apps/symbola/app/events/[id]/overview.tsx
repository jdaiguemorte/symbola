// Lot 72e (EVT-02, EVT-03 ; C-26, C-28, C-55, P-05, P-09, P-15 ; page 16 des maquettes du lot 68) — les blocs
// de la Synthèse sous la suite : « Où en est le mariage » (quatre lignes en mots et « Pourquoi ces nombres ? »,
// l'explication du lot 53), « Informations » (une valeur absente dit « non renseigné » et mène à sa rubrique)
// et le fil d'activité. Pas de carte dans une carte : un bloc, un titre, des lignes.
import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import type { EventTask } from "@symbola/contracts";
import { getPlanningHealth, listEventDecisions } from "@/modules/events/service";
import { listBudgetLines } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { progressFacts, type InformationKey, type InformationRow } from "@/lib/events/overview-info";
import type { DetailsRubric } from "@/lib/events/event-details";
import type { CockpitTakeover } from "./overview-types";

const HEALTH_BADGES = { good: "badge badge-sauge", watch: "badge badge-ambre", late: "badge badge-terracotta" } as const;

export async function EventProgress(props: {
  organizationId: string;
  eventId: string;
  tasks: EventTask[];
  today: string;
  locale: Locale;
  // Lot 71f (I7) : postes complets sur requis ; un contrat attendu par prestataire retenu sans contrat signé.
  vendors: { complete: number; total: number; contractsAwaited: number };
  decisionsLabel: string;
  takeover: CockpitTakeover | null;
}) {
  const t = await getTranslations("EventOverview.progress");
  const tHealth = await getTranslations("PlanningHealth");
  const tSheet = await getTranslations("TakeoverSheet");
  const { organizationId, eventId, locale, today } = props;
  const href = (tab: string) => `/events/${eventId}?onglet=${tab}`;
  const [health, budgetAvailable, decisions] = await Promise.all([getPlanningHealth(organizationId, eventId, today), isBudgetModuleEnabled(organizationId), listEventDecisions(organizationId, eventId)]);
  const budget = budgetAvailable ? await listBudgetLines(organizationId, eventId) : null;
  const pending = decisions.filter((decision) => decision.status === "pending").sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  const facts = progressFacts({
    tasks: { done: props.tasks.filter((task) => task.done).length, total: props.tasks.length, late: props.tasks.filter((task) => !task.done && task.dueDateKnown !== false && task.dueDate < today).length },
    vendors: props.vendors,
    decisions: { pending: pending.length, since: pending[0] ? parisToday(new Date(pending[0].requestedAt)) : null },
  });

  return (
    <section className="card overview-block" aria-labelledby="progress-title">
      <h2 id="progress-title">{t("title")}</h2>
      <dl className="overview-facts">
        <div>
          <dt>
            <Link href={href("taches")}>{t("tasks")}</Link>
          </dt>
          {/* Lot 71f (P-05, C-55) : jamais « Bon » sur zéro tâche ; pas d'avis sur ce qui est vide. */}
          <dd data-health={facts.tasks.kind === "none" ? "none" : health.state}>
            {facts.tasks.kind === "none" ? (
              t("tasksNone")
            ) : (
              <>
                {t("tasksValue", { done: facts.tasks.done, total: facts.tasks.total })}
                {facts.tasks.late > 0 ? <span className="text-overdue"> · {t("tasksLate", { count: facts.tasks.late })}</span> : null}
              </>
            )}
          </dd>
        </div>
        {budget ? (
          <div>
            <dt>
              <Link href={href("budget")}>{t("budget")}</Link>
            </dt>
            {props.takeover?.unallocated ? (
              // Lot 71f (C-56) : le total du fichier, là où le calcul s'affiche, avec ses mots.
              <dd>
                {tSheet("budgetFromFile", { amount: formatAmount(props.takeover.unallocated.committedCents, locale) })}
                {budget.envelope ? ` · ${tSheet("budgetEnvelope", { envelope: formatAmount(budget.envelope.amountCents, locale) })}` : null}
                <span className="meta"> · {tSheet("budgetFromFileDetail", { paid: formatAmount(props.takeover.unallocated.paidCents, locale), allocated: formatAmount(props.takeover.unallocated.allocatedCents, locale) })}</span>
              </dd>
            ) : (
              <dd className={budget.envelope?.exceeded ? "text-overdue" : undefined}>
                {budget.envelope
                  ? t("budgetValue", { committed: formatAmount(budget.totalCommittedCents, locale), envelope: formatAmount(budget.envelope.amountCents, locale) })
                  : t("budgetNoEnvelope", { committed: formatAmount(budget.totalCommittedCents, locale) })}
              </dd>
            )}
          </div>
        ) : null}
        <div>
          <dt>
            <Link href={href("budget")}>{t("vendors")}</Link>
          </dt>
          <dd>
            {facts.vendors.kind === "none" ? (
              t("vendorsNone")
            ) : (
              <>
                {t("vendorsValue", { complete: facts.vendors.complete, total: facts.vendors.total })}
                {facts.vendors.contractsAwaited > 0 ? ` · ${t("contractsAwaited", { count: facts.vendors.contractsAwaited })}` : null}
              </>
            )}
            {/* Lot 71f (C-53) : pour un mariage repris, les prestataires retenus et leurs contrats signés. */}
            {props.takeover ? <span className="meta"> · {tSheet("vendorsSummary", { retained: props.takeover.retained, signed: props.takeover.signed })}</span> : null}
          </dd>
        </div>
        <div>
          <dt>
            <Link href={href("maries")}>{props.decisionsLabel}</Link>
          </dt>
          <dd>{facts.decisions.kind === "none" ? t("decisionsNone") : t("decisionsPending", { count: facts.decisions.count, date: formatCalendarDate(facts.decisions.since ?? today, locale) })}</dd>
        </div>
      </dl>
      {/* Lot 53 (CHR-05) : l'indicateur s'explique — les tâches qui le dégradent, jalons d'abord. */}
      <details className="health-why">
        <summary>{t("why")}</summary>
        <p>{t("whyTasks")}</p>
        {facts.tasks.kind === "none" ? null : (
          <>
            <p>
              <span className={HEALTH_BADGES[health.state]} data-health={health.state}>
                {tHealth(`state.${health.state}`)}
              </span>{" "}
              {tHealth("explain", { points: health.points, watch: health.thresholds.watchPoints, late: health.thresholds.latePoints })}
            </p>
            {health.contributors.length === 0 ? (
              <p>{tHealth("none")}</p>
            ) : (
              <ul className="health-contributors">
                {health.contributors.map((contributor) => (
                  <li key={contributor.taskId}>
                    <Link href={`/events/${eventId}?onglet=taches&tache=${contributor.taskId}`}>{tHealth("contributor", { label: contributor.label, days: contributor.daysLate })}</Link>
                    {contributor.isMilestone ? <span className="badge badge-terracotta">{tHealth("milestone")}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <p>{t("whyVendors")}</p>
        {budget ? <p>{t("whyBudget")}</p> : null}
      </details>
    </section>
  );
}

export async function EventInformation(props: {
  rows: InformationRow[];
  labels: Partial<Record<InformationKey, string>>;
  values: Partial<Record<InformationKey, ReactNode>>;
  editHref: (rubric: DetailsRubric | null) => string;
  teamHref: string;
  readOnly: boolean;
  // Lot 71f : « Signé le », le fichier de chaque valeur reprise (« D'où viennent ces valeurs ? »).
  before?: ReactNode;
  after?: ReactNode;
  tools?: ReactNode;
}) {
  const t = await getTranslations("EventOverview.info");
  return (
    <section className="card overview-block" aria-labelledby="identity-title" data-tour="event-information">
      <div className="section-head">
        <h2 id="identity-title">{t("title")}</h2>
        <div className="row-wrap">
          {props.tools}
          {props.readOnly ? null : (
            <Link className="button-link" href={props.editHref(null)} scroll={false}>
              {t("edit")}
            </Link>
          )}
        </div>
      </div>
      <dl className="overview-info">
        {props.before}
        {props.rows.map((row) => (
          <div key={row.key} className="overview-info-row" data-key={row.key}>
            <dt>{props.labels[row.key] ?? t(row.key)}</dt>
            {row.missing ? (
              <dd className="muted">
                {t("notProvided")}
                {props.readOnly ? null : (
                  <>
                    {" · "}
                    <Link href={row.rubric ? props.editHref(row.rubric) : props.teamHref} scroll={false}>
                      {row.key === "team" ? t("teamAssign") : t("fill")}
                    </Link>
                  </>
                )}
              </dd>
            ) : (
              <dd className={row.key === "notes" ? "task-comment-body" : undefined}>{props.values[row.key]}</dd>
            )}
          </div>
        ))}
        {props.after}
      </dl>
    </section>
  );
}

export type ActivityEntry = { id: string; at: string; text: string };

export async function EventActivity(props: { entries: ActivityEntry[]; time: (instant: string) => string; all: boolean; allHref: string; recentHref: string }) {
  const t = await getTranslations("Events");
  const tOverview = await getTranslations("EventOverview.activity");
  const RECENT = 5;
  const sorted = [...props.entries].sort((left, right) => right.at.localeCompare(left.at));
  const shown = props.all ? sorted : sorted.slice(0, RECENT);
  return (
    <section className="card overview-block" aria-labelledby="activity-title">
      <div className="section-head">
        <h2 id="activity-title">{t("activityTitle")}</h2>
        {sorted.length > RECENT ? (
          <Link className="button-link" href={props.all ? props.recentHref : props.allHref} scroll={false}>
            {props.all ? tOverview("recent") : tOverview("all")}
          </Link>
        ) : null}
      </div>
      {sorted.length === 0 ? <p>{t("noActivity")}</p> : null}
      <ul aria-label={t("activityTitle")} className="overview-activity">
        {shown.map((entry) => (
          <li key={entry.id}>
            {props.time(entry.at)} — {entry.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
