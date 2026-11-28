// Lot 72e (EVT-02, UX-01, UX-06 ; C-20, C-24, C-55, P-05, P-08, J13 ; page 16 des maquettes du lot 68) — la
// suite d'un mariage, en tête de la Synthèse : un seul bloc, dont la forme suit l'état (next-step.ts). Les
// lignes viennent de la même fonction que l'accueil, restreinte à l'évènement, toutes personnes confondues
// (« 6 points d'ici 14 jours, dont 2 en retard » = les lignes de ce mariage sur l'accueil) ; une étape en
// attente y est une ligne de plus, avec son bouton. Dans les états à étape (devis, liste des tâches,
// clôture), le bouton plein est l'action principale de la Synthèse ; en préparation, le bloc n'a que des
// lignes à action rapide.
import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatShortCalendarDate, type Locale } from "@symbola/i18n";
import type { EventTask, TaskTemplate } from "@symbola/contracts";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { confirmEventBudgetAction } from "@/app/budget/[eventId]/actions";
import { isModuleEnabled } from "@/modules/hub/service";
import { appDatabase } from "@symbola/db/client";
import { loadTodayItems } from "@/lib/today/load";
import { FIRST_COUNT, rankToday, TODAY_HORIZON_DAYS, type RankedItem } from "@/lib/today/rank";
import { buildTaskLines } from "@/lib/tasks/task-lines";
import { taskMemberOptions } from "@/lib/tasks/members";
import { TodayItemLine, todayWords, UnavailableNotice } from "@/app/accueil/today-view";
import { TaskLine } from "@/app/ui/task-line";
import type { CockpitTakeover } from "./overview-types";
import type { PendingStep, Suite } from "./next-step";
import { TakeoverChecklist } from "./takeover-checklist";
import { ApplyTaskTemplateForm } from "./task-forms";

export type SuiteHrefs = {
  tasks: string;
  program: string;
  links: string;
  newQuote: string;
  quote: (quoteId: string) => string;
  closing: string;
  editDate: string;
  spreadsheet: string;
  showAll: string;
  showLess: string;
  taskPanel: (taskId: string) => string;
};

function plusDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const bold = { b: (chunks: ReactNode) => <strong>{chunks}</strong> };

export async function EventSuite(props: {
  organizationId: string;
  userId: string;
  event: { id: string; names: string; status: string; eventDate: string | null; guestsEstimated: number | null; wantedBudgetCents: number | null; venueName: string | null };
  suite: Suite;
  // La phrase de l'état, celle de la frise (« Une demande en cours », « Signé, en préparation »).
  stateWords: string;
  since: string | null;
  tasks: EventTask[];
  templates: TaskTemplate[];
  pastDue: Record<string, number>;
  takeover: CockpitTakeover | null;
  quotesAvailable: boolean;
  today: string;
  locale: Locale;
  expanded: boolean;
  hrefs: SuiteHrefs;
}) {
  const t = await getTranslations("EventOverview.suite");
  const tToday = await getTranslations("Today");
  const tEmailKinds = await getTranslations("EmailTemplates");
  const tRisk = await getTranslations("RiskRadar");
  const { suite, event, locale, hrefs } = props;
  const date = (value: string) => formatCalendarDate(value, locale);

  // Lot 71f (R9, C-24, C-55) : « À compléter après la reprise » passe devant ; complété, sa ligne « ✓ » reste
  // sept jours au-dessus de la suite de l'état.
  const takeoverBlock =
    props.takeover && props.takeover.block.kind !== "hidden" ? (
      <TakeoverChecklist block={props.takeover.block} hrefs={props.takeover.hrefs} locale={locale} reviewHref={props.takeover.reviewHref} review={props.takeover.review} />
    ) : null;
  if (suite.kind === "takeover") return takeoverBlock;
  if (suite.kind === "none") return takeoverBlock;

  const head = (title: string, chip?: string) => (
    <div className="event-suite-head">
      <h2 id="event-suite-title">{title}</h2>
      {chip ? <span className="event-suite-state">{chip}</span> : null}
    </div>
  );
  const section = (body: ReactNode, title: string, chip?: string) => (
    <>
      {takeoverBlock}
      <section className="card event-suite" aria-labelledby="event-suite-title" data-tour="event-overview" data-suite={suite.kind}>
        {head(title, chip)}
        {body}
      </section>
    </>
  );

  if (suite.kind === "close") {
    return section(
      <div className="event-suite-step-main">
        <p>{t.rich("close", bold)}</p>
        <Link href={hrefs.closing} className="button-link button-link-primary">
          {t("closeAction")}
        </Link>
      </div>,
      t("nextAction"),
      props.stateWords,
    );
  }

  if (suite.kind === "send_quote" || suite.kind === "follow_quote" || suite.kind === "quote_signed") {
    const parts = [
      event.guestsEstimated !== null ? t("requestGuests", { count: event.guestsEstimated }) : null,
      event.wantedBudgetCents !== null ? t("requestBudget", { amount: formatAmount(event.wantedBudgetCents, locale) }) : null,
      event.eventDate ? t("requestDate", { date: formatCalendarDate(event.eventDate, locale) }) : null,
      event.venueName,
    ].filter((part): part is string => Boolean(part));
    const body =
      suite.kind === "send_quote" ? (
        <>
          <p>{props.since ? t.rich("sendQuote", { ...bold, names: event.names, date: date(props.since) }) : t.rich("sendQuoteUndated", { ...bold, names: event.names })}</p>
          {parts.length > 0 ? <p className="meta">{t("request", { parts: parts.join(", ") })}</p> : null}
          <Link href={suite.draftId ? hrefs.quote(suite.draftId) : hrefs.newQuote} className="button-link button-link-primary">
            {suite.draftId ? t("resumeQuote") : t("prepareQuote")}
          </Link>
        </>
      ) : suite.kind === "follow_quote" ? (
        <>
          <p>{suite.sentOn ? t.rich("followQuote", { ...bold, number: suite.number ?? "", date: date(suite.sentOn), names: event.names }) : t.rich("followQuoteUndated", { ...bold, number: suite.number ?? "", names: event.names })}</p>
          {parts.length > 0 ? <p className="meta">{t("request", { parts: parts.join(", ") })}</p> : null}
          <Link href={hrefs.quote(suite.quoteId)} className="button-link button-link-primary">
            {t("openQuote")}
          </Link>
        </>
      ) : (
        <p>{t.rich("quoteSigned", { ...bold, number: suite.number ?? "" })}</p>
      );
    return section(<div className="event-suite-step-main">{body}</div>, t("nextAction"), props.stateWords);
  }

  if (suite.kind === "create_tasks") {
    const body = (
      <div className="event-suite-step-main">
        <p>{t.rich("createTasks", { ...bold, names: event.names })}</p>
        {suite.needsDate ? (
          <>
            <p className="meta">{t("createTasksNeedsDate")}</p>
            <Link href={hrefs.editDate} className="button-link button-link-primary" scroll={false}>
              {t("setDate")}
            </Link>
          </>
        ) : suite.withTemplate ? (
          <>
            <p className="meta">{t("createTasksBody")}</p>
            <div className="event-suite-actions">
              <ApplyTaskTemplateForm eventId={event.id} templates={props.templates} pastDue={props.pastDue} submitLabel={t("fromTemplate")} />
              <Link href={hrefs.spreadsheet} className="button-link">
                {t("fromSpreadsheet")}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="meta">{t("createTasksNoTemplate")}</p>
            <div className="event-suite-actions">
              <Link href={hrefs.tasks} className="button-link button-link-primary">
                {t("addTasks")}
              </Link>
              <Link href={hrefs.spreadsheet} className="button-link">
                {t("fromSpreadsheet")}
              </Link>
            </div>
          </>
        )}
      </div>
    );
    return section(body, t("nextAction"), props.stateWords);
  }

  // Les points de l'évènement : la fonction de l'accueil, restreinte à lui (J13), avec les mêmes modules et
  // les mêmes mots (dont les alertes du radar, « À regarder »).
  const db = appDatabase();
  const [budgetAvailable, vendorsAvailable, guests, appointments] = await Promise.all([
    isBudgetModuleEnabled(props.organizationId),
    isVendorsModuleEnabled(props.organizationId),
    isModuleEnabled(db, props.organizationId, "guests"),
    isModuleEnabled(db, props.organizationId, "appointments"),
  ]);
  const { items, unavailable } = await loadTodayItems(
    props.organizationId,
    { events: true, quotes: props.quotesAvailable, budget: budgetAvailable, guests, appointments, vendors: vendorsAvailable },
    {
      ...todayWords(tToday),
      emailToSend: (kind) => tToday("words.emailToSend", { kind: tEmailKinds(`kinds.${kind}.title`) }),
      watch: (alert) => ({ title: tRisk(`rules.${alert.rule}.label`), detail: tRisk(`rules.${alert.rule}.alert`, { ...alert.facts, threshold: alert.thresholdDays }) }),
    },
    locale,
    undefined,
    undefined,
    { eventId: event.id },
  );
  const ranked = rankToday(items, props.today);
  const shown = props.expanded ? ranked.all : ranked.all.slice(0, FIRST_COUNT);
  const rest = ranked.all.slice(FIRST_COUNT);
  const steps = suite.kind === "lines" ? suite.steps : [];

  // Lot 70c (D3, M3) : une tâche prend la ligne type, forme `event` (sans la colonne Évènement) ; son titre
  // ouvre la fenêtre de la tâche par-dessus la Synthèse.
  const taskSources = shown.flatMap((item) => (item.task ? [item.task] : []));
  const lines =
    taskSources.length > 0
      ? await buildTaskLines({ organizationId: props.organizationId, locale, tasks: taskSources, members: await taskMemberOptions(props.organizationId, props.userId), href: (task) => hrefs.taskPanel(task.id) })
      : null;
  const lineOf = new Map((lines?.lines ?? []).map((line) => [line.id, line]));
  const line = (item: RankedItem) => {
    const view = item.task ? lineOf.get(item.task.id) : undefined;
    return view ? (
      <TaskLine key={item.key} line={view} form="event" shortcuts={lines!.shortcuts} assignOptions={lines!.assignOptions[event.id] ?? []} />
    ) : (
      <TodayItemLine key={item.key} item={item} locale={locale} returnTo="event" />
    );
  };

  // Rien d'ici 14 jours : la prochaine échéance au-delà, s'il y en a une.
  const horizon = plusDays(props.today, TODAY_HORIZON_DAYS);
  const nextDue = props.tasks.filter((task) => !task.done && task.dueDate > horizon).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const stepLine = (step: PendingStep) => (
    <li key={step} className="today-item event-suite-step" data-step={step}>
      <div className="today-item-body">
        <span className="today-item-title">{t(`step.${step}.title`)}</span>
        <p className="today-item-meta">
          {step === "prepare_program" && event.eventDate ? t("step.prepare_program.body", { days: daysBetween(props.today, event.eventDate) }) : t(`step.${step}.body`)}
        </p>
        <p className="today-item-tags">
          <span className="badge">{t("stepLabel")}</span>
        </p>
      </div>
      <div className="today-action">
        {step === "confirm_budget" ? (
          <form action={confirmEventBudgetAction}>
            <input type="hidden" name="eventId" value={event.id} />
            <button type="submit" className="button-secondary">
              {t("step.confirm_budget.action")}
            </button>
          </form>
        ) : (
          <Link href={step === "prepare_program" ? hrefs.program : hrefs.links} className="button-link">
            {t(`step.${step}.action`)}
          </Link>
        )}
      </div>
    </li>
  );

  const count = (
    <p className="event-suite-count">
      {t("points", { points: ranked.points, late: ranked.late })}
      {steps.length > 0 ? ` · ${t("steps", { count: steps.length })}` : null}
    </p>
  );
  const quiet = ranked.points === 0 && steps.length === 0;
  const body = (
    <>
      <UnavailableNotice sources={unavailable} />
      {quiet ? (
        <p className="event-suite-quiet">
          {suite.kind === "enquiry" ? t("enquiryQuiet") : t("quiet")} {nextDue && suite.kind !== "enquiry" ? t("quietNext", { task: nextDue.label, date: formatShortCalendarDate(nextDue.dueDate, locale) }) : null}{" "}
          <Link href={hrefs.tasks}>{t("tasksLink")}</Link>
        </p>
      ) : (
        <>
          {count}
          <ul className="today-items event-suite-lines">
            {shown.map(line)}
            {steps.map(stepLine)}
          </ul>
          {rest.length > 0 ? (
            <p className="event-suite-more">
              {props.expanded ? null : <span>{t("more", { count: rest.length, list: new Intl.ListFormat(locale, { type: "conjunction" }).format(rest.map((item) => item.title.charAt(0).toLocaleLowerCase(locale) + item.title.slice(1))) })} · </span>}
              <Link href={props.expanded ? hrefs.showLess : hrefs.showAll} scroll={false}>
                {props.expanded ? t("showLess") : t("showAll")}
              </Link>
            </p>
          ) : null}
        </>
      )}
    </>
  );
  return section(body, ranked.points + steps.length > 1 ? t("nextActions") : t("nextAction"), suite.kind === "enquiry" ? props.stateWords : undefined);
}
