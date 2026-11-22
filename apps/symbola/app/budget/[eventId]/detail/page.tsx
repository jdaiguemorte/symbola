// Lot 63c (BUD-01, BUD-03 ; M9) : le suivi courant du budget (lignes, prestataires, échéances, pièces)
// est dans l'onglet « Budget et prestataires » de la fiche, où mène /budget/<id>. Cette page garde le
// détail : simulation et répartition, enveloppe et seuil, honoraires, montants HT, exports, payeurs.
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/ui/page-header";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getEvent, listDefaultVendorSlots, listVendorCandidates, eventNames } from "@/modules/events/service";
import { getBudgetAlertSettings, getEventBudget, listAllocationModels, listBudgetLines } from "@/modules/budget/service";
import { requirePlanner } from "@/lib/guards";
import { isBudgetModuleEnabled, isValidId } from "../../module-access";
import { BudgetSimulationForm } from "../budget-simulation-form";
import { BudgetLinesTable, type VendorOption } from "../budget-lines-table";
import { VendorSchedule } from "../vendor-schedule";
import { PlannerFeeLine } from "../planner-fee-line";
import { bankToVerifyCandidates } from "@/lib/vendors/bank-checks";
import { EnvelopeSummary } from "../envelope-summary";

export default async function EventBudgetPage({ params }: { params: Promise<{ eventId: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;

  const { eventId } = await params;
  const t = await getTranslations("Budget");
  const tHelp = await getTranslations("Help");

  if (!(await isBudgetModuleEnabled(organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  if (!isValidId(eventId)) notFound();

  const event = await getEvent(organizationId, eventId);
  if (!event) notFound();

  const [budget, models, vendorSlots, linesView, alertSettings, candidates] = await Promise.all([
    getEventBudget(organizationId, eventId),
    listAllocationModels(organizationId),
    listDefaultVendorSlots(organizationId),
    listBudgetLines(organizationId, eventId),
    getBudgetAlertSettings(organizationId, eventId),
    listVendorCandidates(organizationId, eventId),
  ]);
  // Lot 28b (BUD-01) : le prestataire d'une ligne est l'un des prestataires
  // rattachés à sa catégorie (les écartés exceptés).
  const vendorOptions: Record<string, VendorOption[]> = {};
  for (const candidate of candidates) {
    if (candidate.status === "dismissed") continue;
    (vendorOptions[candidate.vendorSlotId] ??= []).push({ id: candidate.id, name: candidate.vendorName });
  }
  const locale = (await getLocale()) as Locale;
  const clientNames = eventNames(event.clients, event.name) || t("noClient");

  return (
    <main className="event-sheet budget-sheet">
      <PageHeader
        title={`${t("title")} — ${clientNames}`}
        actions={
          <>
            {/* Lot 63b (HUB-14) : importer un budget depuis l'écran. */}
            <Link href={`/import?type=budget_lines&evenement=${eventId}#import-form`} className="button-link">
              {t("importHere")}
            </Link>
            <Link href={`/events/${eventId}?onglet=budget`} className="button-link">
              {t("backToEvent")}
            </Link>
          </>
        }
      />
      <ScreenHelp title={tHelp("budgetDetail.title")} body={tHelp("budgetDetail.body")} />

      {models.length === 0 ? <p role="status">{t("noModelsYet")}</p> : null}

      {/* Lot 62c (UX-12) : une fois les lignes du budget posées, la simulation et sa répartition se
          replient ; le suivi (enveloppe, lignes, échéancier) vient en premier. */}
      <details className="card budget-simulation" open={linesView.lines.length === 0}>
        <summary>{t("simulationSummary")}</summary>
        <BudgetSimulationForm eventId={eventId} models={models} budget={budget} locale={locale} vendorSlots={vendorSlots} wantedBudgetCents={event.wantedBudgetCents} />
      </details>

      {/* Lot 16 (L16-HUB-20) : chiffres clés alignés, au format de la langue. */}
      {budget ? (
        <dl className="effects budget-figures">
          {(
            [
              ["totalAmount", formatAmount(budget.totalAmountCents, locale)],
              ["guestCount", String(budget.guestCount)],
              ["costPerGuest", formatAmount(budget.costPerGuestCents, locale)],
              ["allocated", formatAmount(budget.allocatedCents, locale)],
              ["remaining", formatAmount(budget.remainingCents, locale)],
            ] as const
          ).map(([key, value]) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* Lot 28a (BUD-02) : enveloppe, part engagée et seuil d'alerte. */}
      <EnvelopeSummary eventId={eventId} envelope={linesView.envelope} committedCents={linesView.totalCommittedCents} settings={alertSettings} locale={locale} />
      {/* Lot 48b (BUD-08) : les honoraires de la planner, à part, hors des dépenses de l'évènement. */}
      <PlannerFeeLine organizationId={organizationId} eventId={eventId} locale={locale} />

      <h2>{t("linesTitle")}</h2>
      {/* Lot 28c (BUD-10) : export à la mise en forme de l'organisation. */}
      {linesView.lines.length > 0 ? (
        <nav aria-label={t("exportTitle")} className="page-actions">
          <a href={`/budget/${eventId}/export?format=xlsx`} className="button-link" download>
            {t("exportXlsx")}
          </a>
          <a href={`/budget/${eventId}/export?format=pdf`} className="button-link" download>
            {t("exportPdf")}
          </a>
        </nav>
      ) : null}
      {/* Lot 43 (BUD-06, BUD-11 ; D8, D9) : qui paie quoi, et le calendrier des sorties d'argent. */}
      <nav aria-label={t("payersNav")} className="page-actions">
        <Link href={`/budget/${eventId}/payeurs`} className="button-link">
          {t("payersLink")}
        </Link>
        <Link href={`/budget/${eventId}/calendrier`} className="button-link">
          {t("cashCalendarLink")}
        </Link>
      </nav>
      <BudgetLinesTable eventId={eventId} view={linesView} canConfirm={budget !== null} vendorOptions={vendorOptions} locale={locale} />
      {/* Lot 28b (BUD-03) : échéancier par prestataire. */}
      {/* Lot 48a (PRE-10, SEC-27) : un IBAN changé et pas encore vérifié est signalé sur ses échéances. */}
      {linesView.lines.length > 0 ? <VendorSchedule view={linesView} locale={locale} organizationId={organizationId} bankToVerify={await bankToVerifyCandidates(organizationId, eventId)} /> : null}
    </main>
  );
}
