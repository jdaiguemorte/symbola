// Lot 62d (UX-12) — l'état de chaque rubrique du devis, en une phrase, pour l'encart « Avant
// d'envoyer » (brouillon) ou « Suivi du devis » (ensuite) : ce qui est réglé, ce qui reste à
// regarder. Des lectures seulement, par le service du module ; aucun calcul nouveau.
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import {
  getQuoteProposalGreeting,
  getQuoteScheduledDeposit,
  getQuoteSettlements,
  listClientCommissions,
  listQuoteContracts,
  quoteFranchiseAlert,
  quotePackageTravel,
  type InvoiceView,
  type QuoteDetail,
  type ReceiptView,
} from "@/modules/quotes/service";
import type { Rubric } from "./rubrics";

export type RubricState = { rubric: Rubric; label: string; state: string; attention: boolean };

export async function loadRubricStates(input: {
  organizationId: string;
  quote: QuoteDetail;
  rubrics: readonly Rubric[];
  invoices: InvoiceView[];
  receipts: ReceiptView[];
  locale: Locale;
}): Promise<RubricState[]> {
  const { organizationId, quote, invoices, receipts, locale } = input;
  const t = await getTranslations("QuoteRubrics");
  const current = quote.current;
  const isDraft = current.sentAt === null;
  const items = current.schedule.items;
  const [proposal, settlements, commissions, packageTravel, franchise, contracts, scheduled] = await Promise.all([
    getQuoteProposalGreeting(organizationId, quote.id),
    !isDraft && items.length > 0 ? getQuoteSettlements(organizationId, quote.id) : Promise.resolve([]),
    listClientCommissions(organizationId, quote.eventId, quote.clientKind),
    quotePackageTravel(organizationId, quote.id),
    quoteFranchiseAlert(organizationId, quote.id),
    isDraft ? Promise.resolve([]) : listQuoteContracts(organizationId, quote.id),
    quote.status === "signed" ? getQuoteScheduledDeposit(organizationId, quote.id) : Promise.resolve(null),
  ]);

  const states: Record<Rubric, { state: string; attention: boolean } | null> = { lignes: null, proposition: null, paiement: null, acheteur: null, honoraires: null, contrat: null, factures: null };

  // Page de proposition : le mot d'accueil avant l'envoi, la validité ensuite.
  const expired = quote.status === "sent" && current.validUntil !== null && parisToday() > current.validUntil;
  states.proposition = isDraft
    ? { state: t(proposal.greeting ? "stateGreetingOwn" : proposal.templateGreeting.trim() !== "" ? "stateGreetingTemplate" : "stateGreetingNone"), attention: false }
    : expired
      ? { state: t("stateProposalExpired", { date: formatCalendarDate(current.validUntil!, locale) }), attention: true }
      : { state: current.validUntil ? t("stateProposalValid", { date: formatCalendarDate(current.validUntil, locale) }) : t("stateProposalSent"), attention: false };

  // Paiement et acompte.
  const advance = t(current.advanceKind === "earnest" ? "advanceEarnest" : current.advanceKind === "deposit" ? "advanceDeposit" : "advanceUnset");
  if (isDraft) {
    states.paiement = items.length === 0 ? { state: t("stateNoSchedule"), attention: false } : { state: t("stateScheduleDraft", { advance, count: items.length }), attention: current.advanceKind === null || current.schedule.exceedsTotal };
  } else if (items.length === 0) {
    states.paiement = { state: t("stateNoSchedule"), attention: false };
  } else {
    const paid = items.filter((item) => item.paidOn !== null).length;
    const overdue = items.filter((item) => item.overdue && item.paidOn === null).length;
    const declared = items.filter((item) => item.paidOn === null && settlements.some((entry) => entry.scheduleItemId === item.id && entry.declaration)).length;
    const parts = [t("stateSchedule", { count: items.length, paid })];
    if (overdue > 0) parts.push(t("stateOverdue", { count: overdue }));
    if (declared > 0) parts.push(t("stateDeclared", { count: declared }));
    states.paiement = { state: parts.join(", "), attention: overdue > 0 || declared > 0 };
  }

  // Acheteur et livraison.
  const buyerParts = [t(`stateClient_${quote.clientKind}`)];
  const buyerMissing = quote.clientKind === "professional" && !quote.buyer.buyerContactId;
  if (buyerMissing) buyerParts.push(t("stateBuyerMissing"));
  buyerParts.push(quote.buyer.orderReference ? t("stateOrderReference", { reference: quote.buyer.orderReference }) : t("stateNoOrderReference"));
  states.acheteur = { state: buyerParts.join(", "), attention: buyerMissing };

  // Honoraires et commissions : les alertes de la rubrique remontent ici.
  const moneyParts = [commissions.length === 0 ? t("stateNoCommission") : t("stateCommissions", { count: commissions.length })];
  if (packageTravel) moneyParts.push(t("statePackageTravel"));
  const franchiseAlert = franchise.alert !== "none" && franchise.thresholdCents !== null;
  if (franchiseAlert) moneyParts.push(t(franchise.alert === "exceeded" ? "stateFranchiseExceeded" : "stateFranchiseApproaching"));
  states.honoraires = { state: moneyParts.join(", "), attention: packageTravel || franchiseAlert };

  // Contrat et signature.
  if (isDraft) {
    states.contrat = { state: t("stateContractAfterSending"), attention: false };
  } else {
    const contract = [...contracts].reverse().find((candidate) => candidate.quoteVersion === current.version) ?? null;
    const contractState = contract === null ? t("stateNoContract") : t(contract.outdated ? "stateContractOutdated" : "stateContract", { version: contract.version });
    const signature = quote.signature;
    const signatureState =
      signature === null
        ? t("stateSignatureNone")
        : signature.status === "pending"
          ? t("stateSignaturePending", { signed: signature.signers.filter((signer) => signer.status === "signed").length, total: signature.signers.length })
          : t(signature.status === "completed" ? "stateSignatureCompleted" : "stateSignatureDeclined");
    states.contrat = { state: `${contractState}, ${signatureState}`, attention: (contract?.outdated ?? false) || signature?.status === "declined" };
  }

  // Factures et avoirs.
  const credits = invoices.reduce((count, invoice) => count + invoice.creditNotes.length, 0);
  const invoiceParts = [invoices.length === 0 ? t("stateNoInvoice") : t("stateInvoices", { count: invoices.length })];
  if (credits > 0) invoiceParts.push(t("stateCreditNotes", { count: credits }));
  if (receipts.length > 0) invoiceParts.push(t("stateReceipts", { count: receipts.length }));
  if (scheduled?.status === "waiting") invoiceParts.push(t("stateDepositWaiting", { date: formatCalendarDate(scheduled.issueOn, locale) }));
  if (scheduled?.status === "blocked") invoiceParts.push(t("stateDepositBlocked"));
  states.factures = { state: invoiceParts.join(", "), attention: scheduled?.status === "blocked" };

  return input.rubrics.flatMap((rubric) => {
    const state = states[rubric];
    return state ? [{ rubric, label: t(`rubric_${rubric}`), ...state }] : [];
  });
}
