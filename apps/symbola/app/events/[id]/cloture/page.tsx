// Lot 58 (PAR-09, PRE-08, EVT-08 ; D4, D5 ; ADR 0097) — la clôture d'un évènement : liste de clôture
// (dès le lendemain, dans le fuseau de l'évènement), évaluation interne des prestataires retenus, temps
// passé facultatif, trois leçons, frais propres, bilan financier, clôture, archivage, modèle et
// duplication. Écran de la planner seulement : jamais montré au client, au prestataire ni au comptable.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { starterClosingLimits } from "@symbola/starter-templates";
import { formatAmount, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { loadClosing } from "@/lib/closing/load";
import { closingDue, eventNames, getEvent, type ClosingStep } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../../module-access";
import { removeOwnExpenseAction } from "./actions";
import { ArchiveButton, ClosingNotesForm, CloseEventButton, DuplicateForm, EvaluationForm, OwnExpenseForm, StepToggleForm, TemplateForm } from "./closing-forms";

// Les étapes qu'une planner peut cocher à la main (« fait ailleurs ») ; le temps passé ne l'est jamais.
const CHECKABLE: readonly ClosingStep[] = ["balance_invoice", "vendor_payments", "commissions", "evaluations", "lessons", "review_request"];

function hours(minutes: number): string {
  return minutes % 60 === 0 ? String(minutes / 60) : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export default async function EventClosingPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const { id } = await params;
  if (!isValidId(id) || !(await isEventsModuleEnabled(organizationId))) notFound();
  const event = await getEvent(organizationId, id);
  if (!event) notFound();
  const state = await loadClosing(organizationId, id);
  if (!state) notFound();
  const t = await getTranslations("Closing");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const archived = Boolean(event.archivedAt);
  const names = eventNames(event.clients);
  const { closing, items, financial, budget } = state;
  const money = (cents: number) => formatAmount(cents, locale);
  const stepHref = (step: ClosingStep): string | null => {
    switch (step) {
      case "balance_invoice":
        return state.balanceQuoteIds[0] ? `/devis/${state.balanceQuoteIds[0]}` : null;
      case "vendor_payments":
        return state.modules.budget ? `/budget/${id}` : null;
      case "commissions":
        return state.modules.quotes ? `/devis/argent/${id}` : null;
      case "evaluations":
        return "#evaluations";
      case "time_spent":
      case "lessons":
        return "#notes";
      case "review_request":
        return `/events/${id}/cloture/avis`;
    }
  };

  return (
    <main>
      <Link href={`/events/${id}`} className="back-link">
        <ArrowLeft aria-hidden="true" />
        {t("back")}
      </Link>
      <PageHeader title={names ? `${t("title")} — ${names}` : t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("eventClosing.title")} body={tHelp("eventClosing.body")} />
      {archived ? (
        <section className="card notice" aria-labelledby="archived-title">
          <h2 id="archived-title">{t("archivedBanner")}</h2>
          <ArchiveButton eventId={id} unarchive />
        </section>
      ) : closingDue(event) && !closing.closedAt ? (
        <p className="card notice">{t("dueBanner")}</p>
      ) : null}

      <section className="card stack" aria-labelledby="checklist-title">
        <h2 id="checklist-title">{t("checklistTitle")}</h2>
        <ul className="plain-list stack" aria-label={t("checklistLabel")}>
          {items.map((item) => {
            const href = stepHref(item.step);
            return (
              <li key={item.step} className="row-wrap" data-step={item.step}>
                <strong>{t(`steps.${item.step}`)}</strong>
                <span className="badge">{t(`status.${item.status}`)}</span>
                {item.status === "todo" && item.count ? <span className="muted">{t("stepCount", { count: item.count })}</span> : null}
                {item.status === "unavailable" ? <span className="muted">{t("unavailableHelp")}</span> : null}
                {href && item.status !== "unavailable" ? <Link href={href}>{t("stepOpen")}</Link> : null}
                {!archived && CHECKABLE.includes(item.step) && item.status !== "unavailable" && (item.status === "todo" || closing.checkedSteps.includes(item.step)) ? (
                  <StepToggleForm eventId={id} step={item.step} checked={closing.checkedSteps.includes(item.step)} />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card stack" id="evaluations" aria-labelledby="evaluations-title">
        <h2 id="evaluations-title">{t("evaluationsTitle")}</h2>
        <p className="muted">{t("evaluationsHelp")}</p>
        {state.vendors.length === 0 ? <p>{t("noRetainedVendors")}</p> : null}
        <ul className="plain-list stack">
          {state.vendors.map((vendor) => (
            <li key={vendor.candidateId} className="stack">
              <h3>{vendor.name}</h3>
              {vendor.evaluation ? <p className="muted">{t("evaluatedOn", { rating: vendor.evaluation.rating })}</p> : null}
              {!vendor.vendorId ? (
                <p className="muted">{t("vendorNotLinked")}</p>
              ) : state.modules.vendors && !archived ? (
                <EvaluationForm eventId={id} vendorId={vendor.vendorId} name={vendor.name} evaluation={vendor.evaluation} />
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack" id="notes" aria-labelledby="notes-title">
        <h2 id="notes-title">{t("notesTitle")}</h2>
        {archived ? (
          <ul className="plain-list">
            {closing.lessons.map((lesson, index) => (
              <li key={index}>{lesson}</li>
            ))}
          </ul>
        ) : (
          <ClosingNotesForm eventId={id} timeSpent={closing.timeSpentMinutes === null ? "" : hours(closing.timeSpentMinutes)} lessons={closing.lessons} lessonCount={starterClosingLimits().lessonCount} />
        )}
      </section>

      <section className="card stack" aria-labelledby="expenses-title">
        <h2 id="expenses-title">{t("expensesTitle")}</h2>
        <p className="muted">{t("expensesHelp")}</p>
        {closing.ownExpenses.length === 0 ? <p>{t("noExpenses")}</p> : null}
        <ul className="plain-list stack">
          {closing.ownExpenses.map((expense, index) => (
            <li key={index} className="row-wrap">
              <span>{expense.label}</span>
              <span className="num">{money(expense.amountCents)}</span>
              {archived ? null : (
                <form action={removeOwnExpenseAction} className="inline-form">
                  <input type="hidden" name="eventId" value={id} />
                  <input type="hidden" name="index" value={index} />
                  <button type="submit" className="button-link" aria-label={t("removeExpense", { label: expense.label })}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {archived ? null : <OwnExpenseForm eventId={id} />}
      </section>

      <section className="card stack" aria-labelledby="summary-title">
        <h2 id="summary-title">{t("summaryTitle")}</h2>
        <p className="muted">{t("summaryHelp")}</p>
        <h3>{t("budgetTitle")}</h3>
        {budget ? (
          <>
            <dl className="row-wrap">
              {(["estimated", "committed", "paid", "remaining", "variance"] as const).map((key) => (
                <div key={key}>
                  <dt>{t(`budget.${key}`)}</dt>
                  <dd className="num">{money(budget[`${key}Cents`])}</dd>
                </div>
              ))}
            </dl>
            <p className="muted">{closing.closedAt ? t("budgetFrozen", { date: formatDateTime(new Date(closing.closedAt), locale) }) : t("budgetLive")}</p>
          </>
        ) : (
          <p className="muted">{t("budgetUnavailable")}</p>
        )}
        <dl className="row-wrap" data-testid="closing-margin">
          <div>
            <dt>{t("fees")}</dt>
            <dd className="num">{money(financial.feesCents)}</dd>
          </div>
          <div>
            <dt>{t("commissions")}</dt>
            <dd className="num">{money(financial.commissionsCents)}</dd>
          </div>
          <div>
            <dt>{t("ownExpenses")}</dt>
            <dd className="num">{money(financial.ownExpensesCents)}</dd>
          </div>
          <div>
            <dt>{t("margin")}</dt>
            <dd className="num">
              <strong>{money(financial.marginCents)}</strong>
            </dd>
          </div>
          {financial.marginPerHourCents !== null ? (
            <div>
              <dt>{t("marginPerHour")}</dt>
              <dd className="num">{money(financial.marginPerHourCents)}</dd>
            </div>
          ) : null}
        </dl>
        {/* Sans temps saisi, le tableau de bord n'est pas mis en avant (réponse de Julien du 18/11). */}
        {financial.timeSpentMinutes !== null ? <Link href="/events/bilans">{t("dashboardLink")}</Link> : null}
      </section>

      {archived ? null : (
        <section className="card stack" aria-labelledby="close-title">
          <h2 id="close-title">{t("closeTitle")}</h2>
          {closing.closedAt ? (
            <p>{t("closedOn", { date: formatDateTime(new Date(closing.closedAt), locale) })}</p>
          ) : (
            <>
              <p className="muted">{t("closeHelp")}</p>
              {state.complete ? null : <p>{t("incomplete")}</p>}
              <CloseEventButton eventId={id} />
            </>
          )}
          {event.status === "closed" || event.status === "cancelled" ? (
            <>
              <h3>{t("archiveTitle")}</h3>
              <p className="muted">{t("archiveHelp")}</p>
              <ArchiveButton eventId={id} unarchive={false} />
            </>
          ) : null}
        </section>
      )}

      <section className="card stack" aria-labelledby="template-title">
        <h2 id="template-title">{t("templateTitle")}</h2>
        <p className="muted">{t("templateHelp")}</p>
        <TemplateForm eventId={id} defaultName="" />
        <Link href="/events/modeles-evenement">{t("templatesLink")}</Link>
      </section>

      <section className="card stack" aria-labelledby="duplicate-title">
        <h2 id="duplicate-title">{t("duplicateTitle")}</h2>
        <p className="muted">{t("duplicateHelp")}</p>
        <DuplicateForm eventId={id} />
      </section>
    </main>
  );
}
