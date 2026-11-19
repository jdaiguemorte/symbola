// Lot 58 (PAR-09, PRE-08 ; D4 ; ADR 0097) — orchestration de la clôture d'un évènement entre les
// modules, par leurs service.ts (ADR 0011) : la liste de clôture (soldes à facturer, échéances des
// prestataires, commissions, évaluations, temps passé, leçons, demande d'avis), le bilan financier
// (budget final, honoraires, commissions, frais propres, marge) et les évaluations des prestataires
// retenus. Un module non souscrit rend son étape « indisponible », jamais une erreur (ARC-07).
import { appDatabase } from "@symbola/db/client";
import type { BudgetLinesView } from "@symbola/contracts";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { listBudgetLines } from "@/modules/budget/service";
import {
  assertEventWritable,
  closeEventWithBudget,
  closingChecklist,
  closingComplete,
  EventNotFoundError,
  getEvent,
  getEventClosing,
  listVendorCandidates,
  type ClosingBudgetSnapshot,
  type ClosingItem,
  type ClosingView,
} from "@/modules/events/service";
import { getDocumentHeader } from "@/modules/hub/service";
import { getPlannerFeeTerms, listEventCommissions, listEventQuotes, listQuoteInvoices } from "@/modules/quotes/service";
import { evaluateVendor, listEventEvaluations, type EvaluationInput, type VendorEvaluation } from "@/modules/vendors/service";
import { plannerFeeAmount } from "@/lib/money/planner-fees";
import { financialSummary, type FinancialSummary } from "./financial-rules";

const RETAINED = new Set(["retained", "contract_signed", "paid_off"]);

export type RetainedVendor = { candidateId: string; vendorId: string | null; name: string; evaluation: VendorEvaluation | null };

export type ClosingState = {
  closing: ClosingView;
  items: ClosingItem[];
  complete: boolean;
  budget: ClosingBudgetSnapshot | null;
  financial: FinancialSummary;
  vendors: RetainedVendor[];
  balanceQuoteIds: string[];
  modules: { budget: boolean; quotes: boolean; vendors: boolean };
};

function budgetSnapshot(view: BudgetLinesView): ClosingBudgetSnapshot {
  return { estimatedCents: view.totalEstimatedCents, committedCents: view.totalCommittedCents, paidCents: view.totalPaidCents, remainingCents: view.totalRemainingCents, varianceCents: view.totalVarianceCents };
}

export async function loadClosing(organizationId: string, eventId: string): Promise<ClosingState | null> {
  const [event, closing] = await Promise.all([getEvent(organizationId, eventId), getEventClosing(organizationId, eventId)]);
  if (!event || !closing) return null;
  const [budgetOn, quotesOn, vendorsOn] = await Promise.all([isBudgetModuleEnabled(organizationId), isQuotesModuleEnabled(organizationId), isVendorsModuleEnabled(organizationId)]);

  const lines = budgetOn ? await listBudgetLines(organizationId, eventId) : null;
  const vendorPaymentsLeft = lines ? lines.lines.flatMap((line) => line.payments).filter((payment) => payment.paidOn === null).length : null;

  let balanceQuoteIds: string[] = [];
  let commissionsCents = 0;
  let commissionsToInvoice: number | null = null;
  let feesCents = 0;
  if (quotesOn) {
    const quotes = (await listEventQuotes(organizationId, eventId)).filter((quote) => quote.status === "signed" && !quote.isDemo);
    for (const quote of quotes) {
      const invoices = await listQuoteInvoices(organizationId, quote.id);
      if (!invoices.some((invoice) => invoice.kind === "balance" && invoice.creditedCents < invoice.amountCents)) balanceQuoteIds.push(quote.id);
    }
    const commissions = await listEventCommissions(organizationId, eventId);
    commissionsCents = commissions.reduce((sum, commission) => sum + commission.amountCents, 0);
    commissionsToInvoice = commissions.filter((commission) => commission.status === "expected").length;
    const terms = await getPlannerFeeTerms(organizationId, eventId);
    feesCents = terms ? await plannerFeeAmount(organizationId, eventId, terms) : 0;
  } else {
    balanceQuoteIds = [];
  }

  const candidates = (await listVendorCandidates(organizationId, eventId)).filter((candidate) => RETAINED.has(candidate.status));
  const evaluations = vendorsOn ? await listEventEvaluations(organizationId, eventId) : [];
  const vendors = candidates.map((candidate) => ({
    candidateId: candidate.id,
    vendorId: candidate.vendorId,
    name: candidate.vendorName,
    evaluation: (candidate.vendorId && evaluations.find((evaluation) => evaluation.vendorId === candidate.vendorId)) || null,
  }));
  const toEvaluate = vendorsOn ? vendors.filter((vendor) => vendor.vendorId && !vendor.evaluation).length : null;

  const items = closingChecklist({
    balanceToInvoice: quotesOn ? balanceQuoteIds.length : null,
    vendorPaymentsLeft,
    commissionsToInvoice,
    vendorsToEvaluate: toEvaluate,
    timeSpentMinutes: closing.timeSpentMinutes,
    lessons: closing.lessons.length,
    reviewRequested: closing.reviewRequestedAt !== null,
    checked: closing.checkedSteps,
  });
  const budget = closing.budgetSnapshot ?? (lines ? budgetSnapshot(lines) : null);
  const financial = financialSummary({ feesCents, commissionsCents, ownExpensesCents: closing.ownExpensesCents, timeSpentMinutes: closing.timeSpentMinutes });
  return { closing, items, complete: closingComplete(items), budget, financial, vendors, balanceQuoteIds, modules: { budget: budgetOn, quotes: quotesOn, vendors: vendorsOn } };
}

// Clôturer : le budget du client se fige tel qu'il est (cinq montants), puis l'évènement passe
// « Clôturé ». Sans module Budget, un budget nul est figé.
export async function closeEventNow(organizationId: string, eventId: string, userId: string, now?: Date): Promise<ClosingView> {
  const lines = (await isBudgetModuleEnabled(organizationId)) ? await listBudgetLines(organizationId, eventId) : null;
  const budget = lines ? budgetSnapshot(lines) : { estimatedCents: 0, committedCents: 0, paidCents: 0, remainingCents: 0, varianceCents: 0 };
  return closeEventWithBudget({ organizationId, eventId, userId, budget, ...(now ? { now } : {}) });
}

export class EvaluationNotAllowedError extends Error {
  constructor() {
    super("ce prestataire n'est pas retenu sur cet évènement");
    this.name = "EvaluationNotAllowedError";
  }
}

// PRE-08 : seul un prestataire retenu sur l'évènement (et relié au carnet) s'évalue ; l'évènement ne
// doit pas être archivé (lecture seule).
export async function evaluateEventVendor(organizationId: string, input: EvaluationInput & { eventId: string; vendorId: string; userId: string; now?: Date }): Promise<VendorEvaluation> {
  const event = await getEvent(organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  await assertEventWritable(organizationId, input.eventId);
  const candidates = await listVendorCandidates(organizationId, input.eventId);
  if (!candidates.some((candidate) => candidate.vendorId === input.vendorId && RETAINED.has(candidate.status))) throw new EvaluationNotAllowedError();
  return evaluateVendor(organizationId, input);
}

export async function organizationName(organizationId: string): Promise<string> {
  return (await getDocumentHeader(appDatabase(), organizationId))?.organizationName ?? "";
}
