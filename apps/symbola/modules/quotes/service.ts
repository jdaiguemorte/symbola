// Porte d'entrée publique du module quotes — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/quotes si ce module est extrait en app autonome.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { LATE_PENALTY_RATE_KEYS, starterContractRules, starterContractTemplates, starterDemoQuote, starterEventTypes, starterInvoiceMentions, starterProfessionalPaymentTerms, starterQuoteTemplates } from "@symbola/starter-templates";
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile, uploadPrivateObject } from "@symbola/files";
import { reserveOrganizationMail, sendMail } from "@symbola/mail";
import { formatAmount, formatCalendarDate, parisDaysSince } from "@symbola/i18n";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import type {
  AdvanceKind,
  ClientContract,
  ConclusionChannel,
  ContractCheck,
  ContractCheckInput,
  ContractClauseRole,
  ContractEvidenceDocument,
  ContractProblem,
  ContractTemplateClauseInput,
  ContractTemplateHeaderInput,
  ContractTemplateView,
  ContractView,
  GenerateContractInput,
  IssueScheduledDepositsInput,
  ScheduledDepositView,
  SendContractForSignatureInput,
  ClientQuoteOptions,
  MissingMention,
  OptionsChoice,
  QuoteSection,
  QuoteTemplateSummary,
  CatalogItem,
  FileDownload,
  MonthlyCount,
  QuotesSearchResults,
  CatalogItemInput,
  CreateQuoteInput,
  GlobalDiscountInput,
  MarkScheduleItemPaidInput,
  PaymentMethod,
  PaymentEntryView,
  PaymentScheduleView,
  RenderCreditNoteOriginal,
  RenderInvoiceOriginal,
  QuoteDetail,
  QuoteLine,
  QuoteLineInput,
  QuoteSettings,
  QuoteSummary,
  QuoteAwaitingAnswer,
  QuotesServiceContract,
  QuoteTotalsView,
  QuoteVersionView,
  ScheduleItemInput,
  ScheduleItemView,
  SellerSnapshot,
  SendQuoteInput,
  UnpaidPayment,
  UnpaidPaymentsView,
  ClientQuoteToSign,
  ClientKind,
  CreditNoteView,
  DocumentSettings,
  EReportingView,
  InvoiceBuyer,
  InvoiceTotalsView,
  InvoiceView,
  IssueBalanceInvoiceInput,
  IssueCreditNoteInput,
  IssueDepositInvoiceInput,
  LatePenaltyRate,
  ReceiptView,
  SendForSignatureInput,
  SignatureView,
  SignatureWebhookResult,
  SignerInput,
  StartQuotesTrialInput,
} from "@symbola/contracts";
import { QUOTES_QUOTE_SIGNED, QUOTES_QUOTE_SIGNED_VERSION, type QuoteSignedPayload } from "@symbola/contracts";
import { changeEventStatus, EventNotFoundError, getEvent, listEventLinks, listEventTypes } from "@/modules/events/service";
import {
  computeLegalMention,
  getOrganizationProfile,
  getRequiredMentionRules,
  getSellerDetails,
  getUserContact,
  type OrganizationProfile,
} from "@/modules/hub/service";
import { fakeSignatureProvider, realSignatureProvider, signatureProviderFor } from "./signature";
import { signatureTag, type SignatureProvider } from "./signature/provider";
import { computeQuoteTotals, formatDocumentNumber, lineAmounts, validUntil, type GlobalDiscount } from "./amounts";
import { addCalendarDays, groupByMonth, isOverdue, parisToday, resolveSchedule } from "./schedule";
import { addDays, balanceTotals, prorateTotals, subtractTotals, type InvoiceTotals } from "./invoicing";
import { paymentTermsFor } from "./payment-terms";
import { sellerDisplayName } from "@/lib/documents/seller-lines";
import { recordAudit } from "@symbola/db/audit";
import { cleanDocumentSettings, documentSnapshot, EMPTY_DOCUMENT_SETTINGS } from "./document-settings";
import { missingMentions, type MentionValues } from "./mentions";
import {
  advanceClauseProblem,
  contractRegime,
  missingRoles,
  resolveContractText,
  withdrawalPeriod,
  type ContractClauseText,
  type ContractVariableValues,
} from "./contract-text";
import {
  closeScheduledDepositForItem,
  deleteContractClauseRow,
  deleteContractTemplateRow,
  findContract,
  findContractRequests,
  findContractTemplate,
  findContractTemplates,
  findDueScheduledDeposits,
  findLatestEvidence,
  findOpenScheduledDeposits,
  findQuoteContracts,
  findQuoteScheduledDeposit,
  findScheduledDepositForItem,
  findSignersOfRequest,
  hasAcceptedTemplate,
  insertContract,
  insertContractClause,
  insertContractEvidence,
  insertContractTemplate,
  insertScheduledDeposit,
  insertSignerAct,
  insertTemplateAcceptance,
  moveContractClauseRow,
  updateContractClauseRow,
  updateContractTemplateHeader,
  updateScheduledDeposit,
  type ClauseData,
  type ContractRow,
  type ContractSignerActRow,
  type ContractTemplateWithClauses,
  type ScheduledDepositContext,
} from "./contracts-repository";
import {
  applyTemplateToDraft,
  deleteQuoteTemplateRow,
  findCurrentVersionContent,
  findQuoteTemplate,
  findQuoteTemplates,
  insertQuoteTemplate,
  replaceQuoteTemplateContent,
  updateQuoteTemplateHeader,
  type TemplateContent,
  type TemplateWithContent,
} from "./templates-repository";
import {
  findOriginal,
  ledgerEntriesOfYear,
  ledgerYears,
  readOriginalBytes,
  sha256Hex,
  storeOriginal,
  storeReconstructedOriginal,
  verifyLedgerRows,
  type LedgerAnomaly,
  type LedgerArchiveRow,
  type OriginalKind,
} from "./pieces";
import {
  findCreditNoteById,
  findEReportingRows,
  findInvoiceById,
  findQuoteInvoices,
  insertCreditNote,
  insertInvoice,
  updateQuoteClientKind,
  type CreditNoteRow,
  type InvoiceRow,
  type InvoicingContext,
  applySignatureStateRows,
  archiveCatalogItemRow,
  archivePaymentMethodRow,
  restorePaymentMethodRow,
  findEventSignatureContexts,
  findSignatureRequestByExternalId,
  listPendingSignatureRequests,
  insertSignatureRequest,
  insertWebhookLog,
  type QuoteSignerRow,
  type SignatureRequestRow,
  deleteEventQuotes,
  deleteScheduleItemRow,
  findPaymentMethods,
  findUnpaidScheduleItems,
  insertPaymentMethods,
  insertScheduleItem,
  recordScheduleItemPayment,
  findQuoteReceipts,
  findReceipt,
  type ReceiptWithState,
  reverseScheduleItemPayment,
  updateScheduleItemRow,
  type PaymentMethodRow,
  type PaymentResult,
  type ScheduleCheck,
  type ScheduleItemData,
  type ScheduleItemRow,
  deleteQuoteLine,
  findCatalogItem,
  countQuotesAndInvoicesByMonth as countQuotesAndInvoicesByMonthRows,
  searchQuoteRows,
  findCatalogItems,
  findEventQuotes,
  findQuotes,
  findSentQuotesWithSendDate,
  findQuoteAggregate,
  findQuoteAggregates,
  findQuoteSettings,
  freezeCurrentVersion,
  insertCatalogItem,
  insertNextVersion,
  insertQuote,
  insertQuoteLine,
  insertQuoteSection,
  updateQuoteSectionRow,
  deleteQuoteSection,
  setAdvanceKindRow,
  chooseOptionsRow,
  type QuoteSectionRow,
  setGlobalDiscountRow,
  updateCatalogItemRow,
  updateQuoteLineRow,
  upsertDocumentSettings,
  upsertQuoteSettings,
  type QuoteSettingsRow,
  type CatalogItemData,
  type CatalogItemRow,
  type LineData,
  type PaymentEntryRow,
  type QuoteAggregate,
  type QuoteLineRow,
  type QuoteVersionRow,
} from "./repository";

export type {
  ClientContract,
  ConclusionChannel,
  ContractActView,
  ContractCheck,
  ContractClauseRole,
  ContractEvidenceDocument,
  ContractProblem,
  ContractRegimeView,
  ContractTemplateClause,
  ContractTemplateView,
  ContractView,
  ScheduledDepositView,
  SignatureRequestKind,
  CatalogItem,
  CatalogItemInput,
  CreateQuoteInput,
  GlobalDiscountInput,
  MarkScheduleItemPaidInput,
  PaymentMethod,
  PaymentEntryView,
  PaymentScheduleView,
  QuoteDetail,
  QuoteLine,
  QuoteLineInput,
  QuoteSettings,
  QuoteStatus,
  AdvanceKind,
  ClientQuoteOptions,
  MissingMention,
  OptionsChoice,
  QuoteSection,
  QuoteTemplateSummary,
  QuoteSummary,
  QuoteAwaitingAnswer,
  QuotesServiceContract,
  QuoteTotalsView,
  QuoteVersionView,
  ScheduleItemInput,
  ScheduleItemView,
  SellerSnapshot,
  SendQuoteInput,
  UnpaidPayment,
  UnpaidPaymentsView,
  ClientQuoteToSign,
  ClientKind,
  CreditNoteView,
  DocumentFont,
  DocumentSettings,
  DocumentSnapshot,
  EReportingView,
  InvoiceBuyer,
  InvoiceTotalsView,
  InvoiceView,
  IssueBalanceInvoiceInput,
  IssueCreditNoteInput,
  IssueDepositInvoiceInput,
  SendForSignatureInput,
  SignatureView,
  SignatureWebhookResult,
  SignerInput,
  SignerView,
  StartQuotesTrialInput,
  LatePenaltyRate,
  ReceiptView,
} from "@symbola/contracts";
export { EventNotFoundError };
// Lot 31c (D18) : conditions de paiement d'un professionnel et phrase des pénalités, pour les PDF.
export { latePenaltySentence, professionalTermsText } from "./payment-terms";
// Lot 17 : numéros des documents d'exemple de l'écran Documents (aucun rang consommé).
export { formatDocumentNumber } from "./amounts";
export {
  DOCUMENT_INTRO_MAX_LENGTH,
  DOCUMENT_TERMS_MAX_LENGTH,
  formatIban,
  InvalidDocumentSettingsError,
  type DocumentSettingsField,
} from "./document-settings";

export class CatalogItemNotFoundError extends Error {
  constructor() {
    super("article introuvable");
    this.name = "CatalogItemNotFoundError";
  }
}

export class QuoteNotFoundError extends Error {
  constructor() {
    super("devis introuvable");
    this.name = "QuoteNotFoundError";
  }
}

// Une version envoyée est immuable : la modifier passe par une nouvelle
// version (reviseQuote).
export class QuoteVersionLockedError extends Error {
  constructor() {
    super("version de devis envoyée, non modifiable");
    this.name = "QuoteVersionLockedError";
  }
}

export class QuoteEmptyError extends Error {
  constructor() {
    super("devis sans ligne");
    this.name = "QuoteEmptyError";
  }
}

// DEV-01 — « Si le régime de TVA n'est pas renseigné, l'app le demande à
// l'envoi. »
export class QuoteVatRegimeRequiredError extends Error {
  constructor() {
    super("régime de TVA à renseigner avant l'envoi");
    this.name = "QuoteVatRegimeRequiredError";
  }
}

// DEV-03 — « Étant donné des acomptes dont la somme dépasse le total, alors
// l'app refuse. »
export class QuoteScheduleExceedsTotalError extends Error {
  constructor() {
    super("échéancier supérieur au total du devis");
    this.name = "QuoteScheduleExceedsTotalError";
  }
}

export class PaymentMethodNotFoundError extends Error {
  constructor() {
    super("mode de paiement introuvable ou archivé");
    this.name = "PaymentMethodNotFoundError";
  }
}

// Une échéance ne se paie que sur la version envoyée courante d'un devis
// envoyé ou signé (jamais sur un brouillon).
export class ScheduleItemNotPayableError extends Error {
  constructor() {
    super("échéance non encaissable");
    this.name = "ScheduleItemNotPayableError";
  }
}

// DEV-02 — seule la version courante envoyée d'un devis « envoyé » part en
// signature.
export class QuoteNotSentError extends Error {
  constructor() {
    super("devis non envoyé");
    this.name = "QuoteNotSentError";
  }
}

export class SignatureAlreadyRequestedError extends Error {
  constructor() {
    super("signature déjà demandée pour cette version");
    this.name = "SignatureAlreadyRequestedError";
  }
}

// Fournisseur non configuré (production sans Documenso) : l'écran affiche
// « indisponible », jamais une erreur (CLAUDE.md §2.3).
export class SignatureUnavailableError extends Error {
  constructor() {
    super("signature en ligne indisponible");
    this.name = "SignatureUnavailableError";
  }
}

// DEV-04 — une facture ne s'émet que depuis un devis signé.
export class QuoteNotSignedError extends Error {
  constructor() {
    super("devis non signé");
    this.name = "QuoteNotSignedError";
  }
}

export class InvoiceAlreadyIssuedError extends Error {
  constructor() {
    super("facture déjà émise");
    this.name = "InvoiceAlreadyIssuedError";
  }
}

// Décision 1 du lot 4 : Factur-X (client professionnel) vient dans un lot
// dédié ; d'ici là, l'émission est refusée avec un message clair.
export class ProfessionalInvoiceNotSupportedError extends Error {
  constructor() {
    super("facture Factur-X pour un client professionnel : pas encore disponible");
    this.name = "ProfessionalInvoiceNotSupportedError";
  }
}

export class InvoiceNotFoundError extends Error {
  constructor() {
    super("facture introuvable");
    this.name = "InvoiceNotFoundError";
  }
}

export class CreditNoteExceedsInvoiceError extends Error {
  constructor() {
    super("avoir supérieur au montant restant de la facture");
    this.name = "CreditNoteExceedsInvoiceError";
  }
}

export class SignatureDocumentNotFoundError extends Error {
  constructor() {
    super("document signé indisponible");
    this.name = "SignatureDocumentNotFoundError";
  }
}

// Lot 31c (JUR-08 ; réponse 7 bis de l'expert-comptable, D21) : des arrhes ne se facturent pas ;
// un reçu non fiscal est remis à leur encaissement.
export class EarnestNotInvoicedError extends Error {
  constructor() {
    super("des arrhes ne se facturent pas : un reçu est remis à l'encaissement");
    this.name = "EarnestNotInvoicedError";
  }
}

// Lot 31c (D22) : un devis à arrhes n'a qu'une échéance d'avance.
export class EarnestSingleInstalmentError extends Error {
  constructor() {
    super("des arrhes se versent en une seule échéance");
    this.name = "EarnestSingleInstalmentError";
  }
}

export class ReceiptNotFoundError extends Error {
  constructor() {
    super("reçu introuvable");
    this.name = "ReceiptNotFoundError";
  }
}

// Lot 31a (FAC-07, JUR-01, décision D4) : une mention requise manque ; chaque champ est nommé.
export class RequiredMentionsMissingError extends Error {
  constructor(readonly fields: MissingMention[]) {
    super(`mentions requises manquantes : ${fields.join(", ")}`);
    this.name = "RequiredMentionsMissingError";
  }
}

export class QuoteSectionNotFoundError extends Error {
  constructor() {
    super("section du devis introuvable");
    this.name = "QuoteSectionNotFoundError";
  }
}

// Lot 31a (FAC-01, décision D2) : la signature a commencé, ou le devis n'est pas envoyé.
export class QuoteOptionsLockedError extends Error {
  constructor() {
    super("choix des options figé");
    this.name = "QuoteOptionsLockedError";
  }
}

export class QuoteTemplateNotFoundError extends Error {
  constructor() {
    super("modèle de devis introuvable");
    this.name = "QuoteTemplateNotFoundError";
  }
}

const DEFAULT_SETTINGS: QuoteSettings = {
  validityDays: 30,
  quotePrefix: "D",
  invoicePrefix: "F",
  creditNotePrefix: "A",
  upcomingHorizonDays: 90,
  invoicePaymentTermDays: 30,
  invoiceMentions: null,
  // Lot 31b (réponse 2 de l'avocat, D17) : « acompte » proposé par défaut.
  advanceKindDefault: "deposit",
  // Lot 31c (D18, D21) : aucun taux des pénalités par défaut.
  invoiceMentionsProfessional: null,
  latePenaltyRate: null,
  receiptPrefix: "R",
};
const DEMO_PREFIX = "DEMO";
const MAX_AMOUNT_CENTS = 100_000_000_00; // 100 M€ : garde-fou contre les débordements d'entier
const MAX_QUANTITY_MILLI = 1_000_000_000;

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await fn(db);
}

// Dates du devis (année de numérotation, date d'envoi) en heure de Paris.
function parisDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function requireInteger(value: number, min: number, max: number, field: string): void {
  if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${field} hors bornes`);
}

function requireText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new RangeError(`${field} vide`);
  return trimmed;
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// --- Catalogue ---

function toCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    unit: row.unit,
    unitPriceCents: row.unitPriceCents,
    vatRateBasisPoints: row.vatRateBasisPoints,
    category: row.category,
    archived: row.archivedAt !== null,
    ...(row.importedFields ? { importedFields: row.importedFields } : {}),
  };
}

function catalogItemData(item: CatalogItemInput): CatalogItemData {
  requireInteger(item.unitPriceCents, 0, MAX_AMOUNT_CENTS, "prix");
  requireInteger(item.vatRateBasisPoints, 0, 10000, "taux de TVA");
  return {
    label: requireText(item.label, "intitulé"),
    description: optionalText(item.description),
    unit: requireText(item.unit, "unité"),
    unitPriceCents: item.unitPriceCents,
    vatRateBasisPoints: item.vatRateBasisPoints,
    category: optionalText(item.category),
  };
}

export async function listCatalogItems(organizationId: string, options: { includeArchived?: boolean } = {}): Promise<CatalogItem[]> {
  return (await findCatalogItems(organizationId, options.includeArchived ?? false)).map(toCatalogItem);
}

export async function createCatalogItem(organizationId: string, item: CatalogItemInput): Promise<CatalogItem> {
  return toCatalogItem(await insertCatalogItem(organizationId, catalogItemData(item)));
}

export async function updateCatalogItem(organizationId: string, itemId: string, item: CatalogItemInput): Promise<CatalogItem> {
  const row = await updateCatalogItemRow(organizationId, itemId, catalogItemData(item));
  if (!row) throw new CatalogItemNotFoundError();
  return toCatalogItem(row);
}

// Un article n'est jamais supprimé : les lignes de devis en gardent une copie.
export async function archiveCatalogItem(organizationId: string, itemId: string): Promise<void> {
  await archiveCatalogItemRow(organizationId, itemId);
}

// --- Réglages ---

export async function getQuoteSettings(organizationId: string): Promise<QuoteSettings> {
  const row = await findQuoteSettings(organizationId);
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    validityDays: row.validityDays,
    quotePrefix: row.quotePrefix,
    invoicePrefix: row.invoicePrefix,
    creditNotePrefix: row.creditNotePrefix,
    upcomingHorizonDays: row.upcomingHorizonDays,
    invoicePaymentTermDays: row.invoicePaymentTermDays,
    invoiceMentions: row.invoiceMentions,
    advanceKindDefault: row.advanceKindDefault,
    invoiceMentionsProfessional: row.invoiceMentionsProfessional,
    latePenaltyRate: row.latePenaltyRate,
    receiptPrefix: row.receiptPrefix,
  };
}

const PREFIX_PATTERN = /^[A-Z0-9]{1,8}$/;

function latePenaltyRateOf(value: string | null | undefined): LatePenaltyRate | null | undefined {
  if (value === undefined || value === null) return value;
  if (!(LATE_PENALTY_RATE_KEYS as readonly string[]).includes(value)) throw new RangeError("taux des pénalités inconnu");
  return value as LatePenaltyRate;
}

export async function updateQuoteSettings(organizationId: string, settings: QuoteSettings): Promise<QuoteSettings> {
  requireInteger(settings.validityDays, 1, 365, "validité");
  requireInteger(settings.upcomingHorizonDays, 1, 730, "horizon");
  requireInteger(settings.invoicePaymentTermDays, 0, 120, "délai de paiement");
  const invoiceMentions = optionalText(settings.invoiceMentions);
  if (invoiceMentions && invoiceMentions.length > 2000) throw new RangeError("mentions trop longues");
  // Lot 31c (D18, D21) : absents, inchangés.
  const invoiceMentionsProfessional = settings.invoiceMentionsProfessional === undefined ? undefined : optionalText(settings.invoiceMentionsProfessional);
  if (invoiceMentionsProfessional && invoiceMentionsProfessional.length > 2000) throw new RangeError("mentions trop longues");
  const latePenaltyRate = latePenaltyRateOf(settings.latePenaltyRate);
  const prefixes = [settings.quotePrefix, settings.invoicePrefix, settings.creditNotePrefix, ...(settings.receiptPrefix === undefined ? [] : [settings.receiptPrefix])];
  for (const prefix of prefixes) {
    // DEMO est réservé à la série d'essai (ADR 0008).
    if (!PREFIX_PATTERN.test(prefix) || prefix === DEMO_PREFIX) throw new RangeError("préfixe invalide");
  }
  const advanceKindDefault = settings.advanceKindDefault === "deposit" || settings.advanceKindDefault === "earnest" ? settings.advanceKindDefault : null;
  const row = await upsertQuoteSettings(organizationId, {
    validityDays: settings.validityDays,
    quotePrefix: settings.quotePrefix,
    invoicePrefix: settings.invoicePrefix,
    creditNotePrefix: settings.creditNotePrefix,
    upcomingHorizonDays: settings.upcomingHorizonDays,
    invoicePaymentTermDays: settings.invoicePaymentTermDays,
    invoiceMentions,
    advanceKindDefault,
    ...(invoiceMentionsProfessional === undefined ? {} : { invoiceMentionsProfessional }),
    ...(latePenaltyRate === undefined ? {} : { latePenaltyRate }),
    ...(settings.receiptPrefix === undefined ? {} : { receiptPrefix: settings.receiptPrefix }),
  });
  return {
    validityDays: row.validityDays,
    quotePrefix: row.quotePrefix,
    invoicePrefix: row.invoicePrefix,
    creditNotePrefix: row.creditNotePrefix,
    upcomingHorizonDays: row.upcomingHorizonDays,
    invoicePaymentTermDays: row.invoicePaymentTermDays,
    invoiceMentions: row.invoiceMentions,
    advanceKindDefault: row.advanceKindDefault,
    invoiceMentionsProfessional: row.invoiceMentionsProfessional,
    latePenaltyRate: row.latePenaltyRate,
    receiptPrefix: row.receiptPrefix,
  };
}

// Lot 31c (D18 ; remarque du rejeu du 31b) : à l'assistant de démarrage, les deux textes de départ
// des conditions de paiement sont enregistrés s'ils manquent ; le taux des pénalités, jamais.
export async function loadStarterPaymentTerms(organizationId: string, locale: "fr" | "en"): Promise<boolean> {
  const settings = await getQuoteSettings(organizationId);
  const missingIndividual = settings.invoiceMentions === null;
  const missingProfessional = (settings.invoiceMentionsProfessional ?? null) === null;
  if (!missingIndividual && !missingProfessional) return false;
  await updateQuoteSettings(organizationId, {
    ...settings,
    invoiceMentions: missingIndividual ? starterInvoiceMentions(locale) : settings.invoiceMentions,
    invoiceMentionsProfessional: missingProfessional ? starterProfessionalPaymentTerms(locale) : settings.invoiceMentionsProfessional,
  });
  return true;
}

// Lot 31c (D18) : les conditions de paiement selon la catégorie du client, depuis les réglages.
function termsSettings(settings: Pick<QuoteSettingsRow, "invoiceMentions" | "invoiceMentionsProfessional" | "latePenaltyRate"> | null) {
  return {
    individual: settings?.invoiceMentions ?? null,
    professional: settings?.invoiceMentionsProfessional ?? null,
    latePenaltyRate: settings?.latePenaltyRate ?? null,
  };
}

// --- Lot 17 (DEV-09 à DEV-11, ADR 0046) : apparence et textes des documents ---

function toDocumentSettings(row: QuoteSettingsRow | null): DocumentSettings {
  if (!row) return { ...EMPTY_DOCUMENT_SETTINGS };
  return {
    color: row.documentColor,
    font: row.documentFont,
    iban: row.iban,
    bic: row.bic,
    quoteIntro: row.quoteIntro,
    quoteTerms: row.quoteTerms,
    invoiceIntro: row.invoiceIntro,
    invoiceTerms: row.invoiceMentions,
    footer: row.documentFooter,
  };
}

export async function getDocumentSettings(organizationId: string): Promise<DocumentSettings> {
  return toDocumentSettings(await findQuoteSettings(organizationId));
}

// Réglages validés (InvalidDocumentSettingsError sinon) ; les documents
// déjà émis gardent leur copie figée.
export async function updateDocumentSettings(organizationId: string, input: DocumentSettings): Promise<DocumentSettings> {
  const clean = cleanDocumentSettings(input);
  const row = await upsertDocumentSettings(organizationId, {
    documentColor: clean.color,
    documentFont: clean.font,
    iban: clean.iban,
    bic: clean.bic,
    quoteIntro: clean.quoteIntro,
    quoteTerms: clean.quoteTerms,
    invoiceIntro: clean.invoiceIntro,
    invoiceMentions: clean.invoiceTerms,
    documentFooter: clean.footer,
  });
  return toDocumentSettings(row);
}

// Lot 18 (AIDE-13) : la couleur seule, choisie à l'assistant de démarrage ;
// les autres réglages des documents ne changent pas.
export async function updateDocumentColor(organizationId: string, color: string | null): Promise<DocumentSettings> {
  return updateDocumentSettings(organizationId, { ...(await getDocumentSettings(organizationId)), color });
}

// Identité du vendeur à jour et apparence du document, copiées dans
// l'instantané (règles 2 et 3 du lot 17).
async function currentSeller(organizationId: string, settings: QuoteSettingsRow | null, kind: "quote" | "invoice"): Promise<SellerSnapshot> {
  const details = await withDb((db) => getSellerDetails(db, organizationId));
  return { ...details, document: documentSnapshot(toDocumentSettings(settings), kind) };
}

// En-tête et apparence courants d'un devis en brouillon (PDF, aperçu) : ce
// que figera son envoi.
// Lot 31c (D18) : pour un client professionnel, ses conditions de paiement et le taux des pénalités.
export async function currentQuoteSeller(organizationId: string, clientKind?: ClientKind): Promise<SellerSnapshot> {
  const settings = await findQuoteSettings(organizationId);
  return withPaymentTerms(await currentSeller(organizationId, settings, "quote"), settings, clientKind);
}

function withPaymentTerms(seller: SellerSnapshot, settings: QuoteSettingsRow | null, clientKind: ClientKind | undefined): SellerSnapshot {
  if (clientKind !== "professional") return seller;
  const terms = paymentTermsFor(termsSettings(settings), clientKind);
  return { ...seller, paymentTerms: terms.text, latePenaltyRate: terms.latePenaltyRate };
}

// Exemple de facture de l'écran Documents : vendeur et apparence courants.
export async function currentInvoiceSeller(organizationId: string): Promise<SellerSnapshot> {
  return currentSeller(organizationId, await findQuoteSettings(organizationId), "invoice");
}

// --- Devis ---

function toGlobalDiscount(version: QuoteVersionRow): GlobalDiscountInput & GlobalDiscount {
  if (version.globalDiscountKind === "percent") return { kind: "percent", basisPoints: version.globalDiscountValue };
  if (version.globalDiscountKind === "amount") return { kind: "amount", cents: version.globalDiscountValue };
  return { kind: "none" };
}

function toLine(row: QuoteLineRow): QuoteLine {
  return {
    id: row.id,
    catalogItemId: row.catalogItemId,
    label: row.label,
    description: row.description,
    unit: row.unit,
    quantityMilli: row.quantityMilli,
    unitPriceCents: row.unitPriceCents,
    vatRateBasisPoints: row.vatRateBasisPoints,
    discountBasisPoints: row.discountBasisPoints,
    position: row.position,
    netCents: lineAmounts(row).netCents,
    sectionId: row.sectionId,
    isOption: row.isOption,
    optionChosen: row.optionChosen,
  };
}

// Lot 31a (FAC-01, décision D2) : une option compte au total une fois choisie.
function includedLines<T extends { isOption: boolean; optionChosen: boolean }>(lines: T[]): T[] {
  return lines.filter((line) => !line.isOption || line.optionChosen);
}

function totalsFor(lines: QuoteLineRow[], version: QuoteVersionRow, vatApplicable: boolean): QuoteTotalsView {
  return computeQuoteTotals(includedLines(lines), toGlobalDiscount(version), vatApplicable);
}

function toSections(sections: QuoteSectionRow[], lines: QuoteLineRow[]): QuoteSection[] {
  const counted = includedLines(lines);
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    position: section.position,
    subtotalCents: counted.filter((line) => line.sectionId === section.id).reduce((sum, line) => sum + lineAmounts(line).netCents, 0),
  }));
}

function toOptionsChoice(version: QuoteVersionRow): OptionsChoice | null {
  if (!version.optionsChosenAt || !version.optionsChosenBy) return null;
  return { chosenAt: version.optionsChosenAt.toISOString(), chosenBy: version.optionsChosenBy, byKind: version.optionsChosenByKind === "client" ? "client" : "planner" };
}

function toPaymentEntryView(entry: PaymentEntryRow): PaymentEntryView {
  return {
    id: entry.id,
    kind: entry.kind,
    amountCents: entry.amountCents,
    paidOn: entry.paidOn,
    paymentMethodLabel: entry.paymentMethodLabel,
    reason: entry.reason,
    recordedAt: entry.createdAt.toISOString(),
  };
}

function toScheduleView(
  items: ScheduleItemRow[],
  methods: PaymentMethodRow[],
  totalTtcCents: number,
  now: Date,
  entries: PaymentEntryRow[] = [],
): PaymentScheduleView {
  const resolved = resolveSchedule(items, totalTtcCents);
  const labels = new Map(methods.map((method) => [method.id, method.label]));
  const views: ScheduleItemView[] = items.map((item, index) => ({
    id: item.id,
    label: item.label,
    dueDate: item.dueDate,
    fixedAmountCents: item.amountCents,
    percentageBasisPoints: item.percentageBasisPoints,
    amountCents: resolved.amounts[index] ?? 0,
    paidOn: item.paidOn,
    paymentMethodId: item.paymentMethodId,
    paymentMethodLabel: item.paymentMethodId ? (labels.get(item.paymentMethodId) ?? null) : null,
    overdue: item.paidOn === null && isOverdue(item.dueDate, now),
    position: item.position,
    payments: entries.filter((entry) => entry.scheduleItemId === item.id).map(toPaymentEntryView),
  }));
  return {
    items: views,
    scheduledCents: totalTtcCents - resolved.balanceCents,
    balanceCents: resolved.balanceCents,
    exceedsTotal: resolved.exceedsTotal,
  };
}

function toVersionView(
  version: QuoteVersionRow,
  aggregate: Pick<QuoteAggregate, "lines" | "scheduleItems" | "paymentMethods"> & Partial<Pick<QuoteAggregate, "paymentEntries" | "sections">>,
  profile: OrganizationProfile,
  now: Date,
): QuoteVersionView {
  const ownLines = aggregate.lines.filter((line) => line.versionId === version.id);
  const sent = version.sentAt !== null;
  // Brouillon : régime courant de l'organisation ; envoyée : copie figée.
  const vatRegime = (sent ? version.vatRegime : profile.vatRegime) as QuoteVersionView["vatRegime"];
  const vatApplicable = vatRegime !== "franchise";
  const totals =
    sent && version.totalsSnapshot ? (version.totalsSnapshot as QuoteTotalsView) : totalsFor(ownLines, version, vatApplicable);
  const ownItems = aggregate.scheduleItems.filter((item) => item.versionId === version.id);
  return {
    id: version.id,
    version: version.version,
    lines: ownLines.map(toLine),
    globalDiscount: toGlobalDiscount(version),
    totals,
    vatApplicable,
    vatRegime: vatRegime ?? null,
    legalMention: version.legalMention,
    seller: (version.sellerSnapshot as SellerSnapshot | null) ?? null,
    validUntil: version.validUntil,
    sentAt: version.sentAt?.toISOString() ?? null,
    schedule: toScheduleView(ownItems, aggregate.paymentMethods, totals.totalTtcCents, now, aggregate.paymentEntries ?? []),
    sections: toSections((aggregate.sections ?? []).filter((section) => section.versionId === version.id), ownLines),
    advanceKind: version.advanceKind,
    optionsChoice: toOptionsChoice(version),
    template: version.templateVersion !== null ? { id: version.templateId, version: version.templateVersion } : null,
  };
}

function toSignatureView(request: SignatureRequestRow, signers: QuoteSignerRow[]): SignatureView {
  return {
    id: request.id,
    provider: request.provider,
    kind: request.kind,
    contractId: request.contractId,
    status: request.status,
    signers: signers
      .filter((signer) => signer.requestId === request.id)
      .map((signer) => ({
        id: signer.id,
        eventClientId: signer.eventClientId,
        name: signer.name,
        email: signer.email,
        billingAddress: signer.billingAddress,
        status: signer.status,
        signedAt: signer.signedAt?.toISOString() ?? null,
        signingUrl: signer.signingUrl,
      })),
    createdAt: request.createdAt.toISOString(),
    completedAt: request.completedAt?.toISOString() ?? null,
    hasSignedDocument: request.signedDocumentKey !== null,
  };
}

function toDetail(aggregate: QuoteAggregate, profile: OrganizationProfile, now: Date = new Date()): QuoteDetail {
  const versions = aggregate.versions.map((version) => toVersionView(version, aggregate, profile, now));
  const current = versions.find((version) => version.version === aggregate.quote.currentVersion);
  if (!current) throw new QuoteNotFoundError();
  // Lot 31b (D9) : la demande qui fait signer le devis (seul ou avec son contrat).
  const request = aggregate.signatureRequests.find((candidate) => candidate.versionId === current.id && candidate.kind !== "contract");
  return {
    ...toSummary(aggregate, current),
    versions,
    current,
    signature: request ? toSignatureView(request, aggregate.signers) : null,
    regimeChangedSinceSent:
      aggregate.quote.status === "sent" && current.sentAt !== null && current.vatRegime !== profile.vatRegime,
  };
}

function toSummary(aggregate: QuoteAggregate, current: QuoteVersionView): QuoteSummary {
  const { quote } = aggregate;
  return {
    id: quote.id,
    eventId: quote.eventId,
    number: quote.number,
    status: quote.status,
    currentVersion: quote.currentVersion,
    isDemo: quote.isDemo,
    clientKind: quote.clientKind,
    totalTtcCents: current.totals.totalTtcCents,
  };
}

async function loadDetail(organizationId: string, quoteId: string): Promise<QuoteDetail> {
  const aggregate = await findQuoteAggregate(organizationId, quoteId);
  if (!aggregate) throw new QuoteNotFoundError();
  const profile = await withDb((db) => getOrganizationProfile(db, organizationId));
  return toDetail(aggregate, profile);
}

function unwrap(result: PaymentResult | { status: "draft_exists" }): string {
  if (result.status === "not_found") throw new QuoteNotFoundError();
  if (result.status === "locked") throw new QuoteVersionLockedError();
  if (result.status === "draft_exists") throw new QuoteVersionLockedError();
  if (result.status === "not_payable") throw new ScheduleItemNotPayableError();
  if (result.status === "method_not_found") throw new PaymentMethodNotFoundError();
  if (result.status !== "ok") throw new QuoteNotFoundError();
  return result.quoteId;
}

// DEV-01 — le devis est numéroté dès sa création ; un devis sur un
// événement d'essai prend la série DEMO (ADR 0008).
export async function createQuote(input: CreateQuoteInput): Promise<QuoteDetail> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  const settings = await getQuoteSettings(input.organizationId);
  const year = Number(parisDate(input.now ?? new Date()).slice(0, 4));
  const prefix = event.isDemo ? `${DEMO_PREFIX}-${settings.quotePrefix}` : settings.quotePrefix;
  const quote = await insertQuote({
    organizationId: input.organizationId,
    eventId: input.eventId,
    isDemo: event.isDemo,
    createdByUserId: input.createdByUserId,
    year,
    formatNumber: (rank) => formatDocumentNumber(prefix, year, rank),
  });
  // Lot 31a (JUR-08, D5) : la valeur proposée par l'organisation, à confirmer avant l'envoi.
  if (settings.advanceKindDefault) unwrap(await setAdvanceKindRow(input.organizationId, quote.id, settings.advanceKindDefault));
  return loadDetail(input.organizationId, quote.id);
}

export async function listEventQuotes(organizationId: string, eventId: string): Promise<QuoteSummary[]> {
  return summarize(organizationId, await findEventQuotes(organizationId, eventId));
}

// Écran « Devis et factures » : tous les devis, les plus récents d'abord.
// Lot 13 (L13-HUB-15) — devis envoyés sans réponse depuis au moins `days`
// jours (calendrier de Paris), pour le bloc « À traiter » de l'accueil.
export async function listQuotesAwaitingAnswer(
  organizationId: string,
  days: number,
  now: Date = new Date(),
): Promise<QuoteAwaitingAnswer[]> {
  return (await findSentQuotesWithSendDate(organizationId))
    .map((row) => ({ quoteId: row.quote.id, number: row.quote.number, eventId: row.quote.eventId, sentAt: row.sentAt, daysSince: parisDaysSince(row.sentAt, now) }))
    .filter((row) => row.daysSince >= days);
}

export async function listQuotes(organizationId: string): Promise<QuoteSummary[]> {
  return summarize(organizationId, await findQuotes(organizationId));
}

async function summarize(organizationId: string, rows: Awaited<ReturnType<typeof findQuotes>>): Promise<QuoteSummary[]> {
  if (rows.length === 0) return [];
  const aggregates = await findQuoteAggregates(organizationId, rows.map((row) => row.id));
  const profile = await withDb((db) => getOrganizationProfile(db, organizationId));
  const byId = new Map(aggregates.map((aggregate) => [aggregate.quote.id, aggregate]));
  return rows.flatMap((row) => {
    const aggregate = byId.get(row.id);
    if (!aggregate) return [];
    const detail = toDetail(aggregate, profile);
    return [toSummary(aggregate, detail.current)];
  });
}

export async function getQuote(organizationId: string, quoteId: string): Promise<QuoteDetail> {
  return loadDetail(organizationId, quoteId);
}

function validateLineNumbers(line: { quantityMilli: number; unitPriceCents: number; vatRateBasisPoints: number; discountBasisPoints: number }): void {
  requireInteger(line.quantityMilli, 1, MAX_QUANTITY_MILLI, "quantité");
  requireInteger(line.unitPriceCents, 0, MAX_AMOUNT_CENTS, "prix");
  requireInteger(line.vatRateBasisPoints, 0, 10000, "taux de TVA");
  requireInteger(line.discountBasisPoints, 0, 10000, "remise");
}

// Ligne depuis le catalogue : copie de l'article (non archivé), ajustable ;
// ligne libre : intitulé, unité et prix obligatoires, taux par défaut de
// l'organisation si absent.
async function newLineData(organizationId: string, line: QuoteLineInput): Promise<LineData> {
  let base: { catalogItemId: string | null; label?: string; description: string | null; unit?: string; unitPriceCents?: number; vatRateBasisPoints?: number } = {
    catalogItemId: null,
    description: null,
  };
  if (line.catalogItemId) {
    const item = await findCatalogItem(organizationId, line.catalogItemId);
    if (!item || item.archivedAt) throw new CatalogItemNotFoundError();
    base = {
      catalogItemId: item.id,
      label: item.label,
      description: item.description,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      vatRateBasisPoints: item.vatRateBasisPoints,
    };
  }
  let vatRate = line.vatRateBasisPoints ?? base.vatRateBasisPoints;
  if (vatRate === undefined) {
    const profile = await withDb((db) => getOrganizationProfile(db, organizationId));
    vatRate = profile.vatRateDefaultBasisPoints ?? 0;
  }
  const unitPriceCents = line.unitPriceCents ?? base.unitPriceCents;
  if (unitPriceCents === undefined) throw new RangeError("prix manquant");
  const data: LineData = {
    catalogItemId: base.catalogItemId,
    label: requireText(line.label ?? base.label ?? "", "intitulé"),
    description: line.description !== undefined ? optionalText(line.description) : base.description,
    unit: requireText(line.unit ?? base.unit ?? "", "unité"),
    quantityMilli: line.quantityMilli,
    unitPriceCents,
    vatRateBasisPoints: vatRate,
    discountBasisPoints: line.discountBasisPoints ?? 0,
    sectionId: line.sectionId ?? null,
    isOption: line.isOption ?? false,
    optionChosen: false,
  };
  validateLineNumbers(data);
  return data;
}

export async function addQuoteLine(organizationId: string, quoteId: string, line: QuoteLineInput): Promise<QuoteDetail> {
  const data = await newLineData(organizationId, line);
  unwrap(await insertQuoteLine(organizationId, quoteId, data));
  return loadDetail(organizationId, quoteId);
}

// Seuls les champs fournis changent ; l'article d'origine n'est pas relu.
export async function updateQuoteLine(organizationId: string, lineId: string, line: QuoteLineInput): Promise<QuoteDetail> {
  const quoteId = unwrap(
    await updateQuoteLineRow(organizationId, lineId, (current) => {
      const data: LineData = {
        catalogItemId: current.catalogItemId,
        label: line.label !== undefined ? requireText(line.label, "intitulé") : current.label,
        description: line.description !== undefined ? optionalText(line.description) : current.description,
        unit: line.unit !== undefined ? requireText(line.unit, "unité") : current.unit,
        quantityMilli: line.quantityMilli,
        unitPriceCents: line.unitPriceCents ?? current.unitPriceCents,
        vatRateBasisPoints: line.vatRateBasisPoints ?? current.vatRateBasisPoints,
        discountBasisPoints: line.discountBasisPoints ?? current.discountBasisPoints,
        sectionId: line.sectionId !== undefined ? line.sectionId : current.sectionId,
        isOption: line.isOption ?? current.isOption,
        optionChosen: (line.isOption ?? current.isOption) ? current.optionChosen : false,
      };
      validateLineNumbers(data);
      return data;
    }),
  );
  return loadDetail(organizationId, quoteId);
}

export async function removeQuoteLine(organizationId: string, lineId: string): Promise<QuoteDetail> {
  const quoteId = unwrap(await deleteQuoteLine(organizationId, lineId));
  return loadDetail(organizationId, quoteId);
}

export async function setQuoteGlobalDiscount(organizationId: string, quoteId: string, discount: GlobalDiscountInput): Promise<QuoteDetail> {
  let value = 0;
  if (discount.kind === "percent") {
    requireInteger(discount.basisPoints, 0, 10000, "remise");
    value = discount.basisPoints;
  } else if (discount.kind === "amount") {
    requireInteger(discount.cents, 0, MAX_AMOUNT_CENTS, "remise");
    value = discount.cents;
  }
  unwrap(await setGlobalDiscountRow(organizationId, quoteId, discount.kind, value));
  return loadDetail(organizationId, quoteId);
}

// --- Lot 31a (FAC-01, FAC-07, JUR-01, JUR-08, JUR-09, HUB-21 ; D2 à D5) ---

function sectionTitle(title: string): string {
  const clean = requireText(title, "titre de section").replace(/\s+/g, " ");
  if (clean.length > 120) throw new RangeError("titre de section trop long");
  return clean;
}

function unwrapSection(result: Awaited<ReturnType<typeof updateQuoteSectionRow>>): string {
  if (result.status === "not_found") throw new QuoteSectionNotFoundError();
  if (result.status === "locked") throw new QuoteVersionLockedError();
  if (result.status !== "ok") throw new QuoteSectionNotFoundError();
  return result.quoteId;
}

export async function addQuoteSection(organizationId: string, quoteId: string, title: string): Promise<QuoteDetail> {
  unwrap(await insertQuoteSection(organizationId, quoteId, sectionTitle(title)));
  return loadDetail(organizationId, quoteId);
}

export async function renameQuoteSection(organizationId: string, sectionId: string, title: string): Promise<QuoteDetail> {
  const quoteId = unwrapSection(await updateQuoteSectionRow(organizationId, sectionId, sectionTitle(title)));
  return loadDetail(organizationId, quoteId);
}

// Les lignes de la section restent, sans section.
export async function removeQuoteSection(organizationId: string, sectionId: string): Promise<QuoteDetail> {
  const quoteId = unwrapSection(await deleteQuoteSection(organizationId, sectionId));
  return loadDetail(organizationId, quoteId);
}

export async function setQuoteAdvanceKind(organizationId: string, quoteId: string, kind: AdvanceKind | null): Promise<QuoteDetail> {
  if (kind !== null && kind !== "deposit" && kind !== "earnest") throw new RangeError("acompte ou arrhes");
  // Lot 31c (D22) : des arrhes se versent en une seule échéance.
  if (kind === "earnest" && (await loadDetail(organizationId, quoteId)).current.schedule.items.length > 1) throw new EarnestSingleInstalmentError();
  unwrap(await setAdvanceKindRow(organizationId, quoteId, kind));
  return loadDetail(organizationId, quoteId);
}

// Lot 31a (FAC-01, décision D2) — le client choisit ses options sur son portail (ou la
// planner pour lui) : figé dès que la signature commence ; les totaux figés suivent.
export async function chooseQuoteOptions(input: {
  organizationId: string;
  quoteId: string;
  // Lien personnel : l'événement du lien, que le devis doit porter.
  eventId?: string;
  chosenLineIds: string[];
  chosenBy: string;
  byKind: "client" | "planner";
  now?: Date;
}): Promise<QuoteDetail> {
  const chosenBy = requireText(input.chosenBy, "auteur du choix").slice(0, 200);
  const result = await chooseOptionsRow(
    input.organizationId,
    { quoteId: input.quoteId, ...(input.eventId ? { eventId: input.eventId } : {}), chosenLineIds: [...new Set(input.chosenLineIds)], chosenBy, byKind: input.byKind, now: input.now ?? new Date() },
    (lines, version) => totalsFor(lines, version, version.vatRegime !== "franchise"),
  );
  if (result.status === "not_found") throw new QuoteNotFoundError();
  if (result.status === "locked" || result.status === "no_options") throw new QuoteOptionsLockedError();
  return loadDetail(input.organizationId, input.quoteId);
}

// Options des devis envoyés de l'événement, pour le portail du client (rubrique devis).
export async function listClientQuoteOptions(organizationId: string, eventId: string): Promise<ClientQuoteOptions[]> {
  const summaries = await findEventQuotes(organizationId, eventId);
  const aggregates = await findQuoteAggregates(
    organizationId,
    summaries.filter((quote) => quote.status === "sent" || quote.status === "signed").map((quote) => quote.id),
  );
  const result: ClientQuoteOptions[] = [];
  for (const aggregate of aggregates) {
    const version = aggregate.versions.find((candidate) => candidate.version === aggregate.quote.currentVersion);
    if (!version?.sentAt) continue;
    const lines = aggregate.lines.filter((line) => line.versionId === version.id);
    const options = lines.filter((line) => line.isOption);
    if (options.length === 0) continue;
    const vatApplicable = version.vatRegime !== "franchise";
    const sections = new Map(aggregate.sections.filter((section) => section.versionId === version.id).map((section) => [section.id, section.title]));
    const totals = (version.totalsSnapshot as QuoteTotalsView | null) ?? totalsFor(lines, version, vatApplicable);
    result.push({
      quoteId: aggregate.quote.id,
      number: aggregate.quote.number,
      version: version.version,
      totalTtcCents: totals.totalTtcCents,
      vatApplicable,
      options: options.map((line) => {
        const net = lineAmounts(line).netCents;
        return {
          lineId: line.id,
          label: line.label,
          description: line.description,
          section: line.sectionId ? (sections.get(line.sectionId) ?? null) : null,
          amountCents: vatApplicable ? net + Math.round((net * line.vatRateBasisPoints) / 10000) : net,
          chosen: line.optionChosen,
        };
      }),
      choice: toOptionsChoice(version),
      locked: aggregate.quote.status !== "sent" || aggregate.signatureRequests.some((request) => request.versionId === version.id),
      advanceKind: version.advanceKind,
    });
  }
  return result;
}

// --- Mentions requises (FAC-07, JUR-01, JUR-09 ; D4) ---

function mentionValues(
  seller: Partial<SellerSnapshot> & { organizationName?: string | null },
  terms: { individual: string | null; professional: string | null; latePenaltyRate: LatePenaltyRate | null },
): MentionValues {
  return {
    organizationName: seller.organizationName ?? null,
    address: seller.address ?? null,
    siren: seller.siren ?? null,
    siret: seller.siret ?? null,
    registration: seller.registration ?? null,
    shareCapitalCents: seller.shareCapitalCents ?? null,
    vatNumber: seller.vatNumber ?? null,
    insurer: seller.insurer ?? null,
    insurancePolicy: seller.insurancePolicy ?? null,
    mediatorName: seller.mediatorName ?? null,
    mediatorUrl: seller.mediatorUrl ?? null,
    generalTerms: seller.generalTerms ?? null,
    paymentTerms: terms.individual,
    // Lot 31c (D18).
    professionalPaymentTerms: terms.professional,
    latePenaltyRate: terms.latePenaltyRate,
  };
}

function requireInvoiceMentions(
  rules: Awaited<ReturnType<typeof getRequiredMentionRules>>["rules"],
  document: "deposit_invoice" | "balance_invoice",
  context: InvoicingContext,
  seller: Awaited<ReturnType<typeof getSellerDetails>>,
): void {
  if (context.quote.isDemo) return;
  const missing = missingMentions(rules, {
    document,
    vatRegime: context.version.vatRegime === "assujetti" ? "assujetti" : context.version.vatRegime === "franchise" ? "franchise" : null,
    clientKind: context.quote.clientKind,
    legalForm: seller.legalForm,
    values: mentionValues(seller, termsSettings(context.settings)),
  });
  if (missing.length > 0) throw new RequiredMentionsMissingError(missing);
}

// Ce qui manque pour envoyer ce devis : mentions requises de la liste, et acompte ou arrhes
// s'il a un échéancier. Un devis d'essai n'est pas contrôlé (document fictif).
export async function quoteMissingMentions(organizationId: string, quoteId: string): Promise<MissingMention[]> {
  const aggregate = await findQuoteAggregate(organizationId, quoteId);
  if (!aggregate) throw new QuoteNotFoundError();
  if (aggregate.quote.isDemo) return [];
  const version = aggregate.versions.find((candidate) => candidate.version === aggregate.quote.currentVersion);
  if (!version) throw new QuoteNotFoundError();
  const [{ rules }, seller, profile, settings] = await Promise.all([
    withDb((db) => getRequiredMentionRules(db)),
    withDb((db) => getSellerDetails(db, organizationId)),
    withDb((db) => getOrganizationProfile(db, organizationId)),
    findQuoteSettings(organizationId),
  ]);
  const missing = missingMentions(rules, {
    document: "quote",
    vatRegime: profile.vatRegime,
    clientKind: aggregate.quote.clientKind,
    legalForm: seller.legalForm,
    values: mentionValues(seller, termsSettings(settings)),
  });
  const items = aggregate.scheduleItems.filter((item) => item.versionId === version.id);
  if (items.length > 0 && !version.advanceKind) missing.push("advanceKind");
  // Lot 31c (D22) : des arrhes se versent en une seule échéance.
  if (version.advanceKind === "earnest" && items.length > 1) missing.push("earnestSingleInstalment");
  return missing;
}

// --- Modèles de devis (FAC-01, HUB-21 ; D3) ---

function toTemplateSummary({ template, sections, lines, schedule }: TemplateWithContent): QuoteTemplateSummary {
  return {
    id: template.id,
    name: template.name,
    eventTypeId: template.eventTypeId,
    version: template.version,
    sectionCount: sections.length,
    lineCount: lines.length,
    optionCount: lines.filter((line) => line.isOption).length,
    scheduleCount: schedule.length,
    advanceKind: template.advanceKind,
  };
}

function templateName(name: string): string {
  const clean = requireText(name, "nom du modèle").replace(/\s+/g, " ");
  if (clean.length > 120) throw new RangeError("nom du modèle trop long");
  return clean;
}

export async function listQuoteTemplates(organizationId: string): Promise<QuoteTemplateSummary[]> {
  return (await findQuoteTemplates(organizationId)).map(toTemplateSummary);
}

// Le contenu de la version courante d'un devis : sections, lignes, options, remise,
// acompte ou arrhes, et l'échéancier en règles (« à la signature », « N jours avant »).
async function quoteAsTemplateContent(organizationId: string, quoteId: string): Promise<TemplateContent> {
  const content = await findCurrentVersionContent(organizationId, quoteId);
  if (!content) throw new QuoteNotFoundError();
  const event = await getEvent(organizationId, content.quote.eventId);
  const reference = parisDate(content.version.sentAt ?? content.version.createdAt);
  return {
    globalDiscountKind: content.version.globalDiscountKind,
    globalDiscountValue: content.version.globalDiscountValue,
    advanceKind: content.version.advanceKind,
    sections: content.sections.map((section) => ({ key: section.id, title: section.title })),
    lines: content.lines.map((line) => ({
      sectionKey: line.sectionId,
      catalogItemId: line.catalogItemId,
      label: line.label,
      description: line.description,
      unit: line.unit,
      quantityMilli: line.quantityMilli,
      unitPriceCents: line.unitPriceCents,
      vatRateBasisPoints: line.vatRateBasisPoints,
      discountBasisPoints: line.discountBasisPoints,
      isOption: line.isOption,
    })),
    schedule: content.schedule.map((item) => {
      const before = event?.eventDate && item.dueDate > reference ? daysBetweenDates(item.dueDate, event.eventDate) : null;
      return before !== null && before >= 0
        ? { label: item.label, amountCents: item.amountCents, percentageBasisPoints: item.percentageBasisPoints, dueRule: "before_event" as const, daysBeforeEvent: Math.min(before, 1095) }
        : { label: item.label, amountCents: item.amountCents, percentageBasisPoints: item.percentageBasisPoints, dueRule: "at_signature" as const, daysBeforeEvent: null };
    }),
  };
}

function daysBetweenDates(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export async function saveQuoteAsTemplate(input: { organizationId: string; quoteId: string; name: string; eventTypeId: string | null }): Promise<QuoteTemplateSummary> {
  const name = templateName(input.name);
  const content = await quoteAsTemplateContent(input.organizationId, input.quoteId);
  if (content.lines.length === 0) throw new QuoteEmptyError();
  const template = await insertQuoteTemplate(input.organizationId, { name, eventTypeId: input.eventTypeId }, content);
  return toTemplateSummary((await findQuoteTemplate(input.organizationId, template.id))!);
}

// Remplace le contenu d'un modèle par celui d'un devis ; sa version augmente.
export async function replaceQuoteTemplateFromQuote(input: { organizationId: string; templateId: string; quoteId: string }): Promise<QuoteTemplateSummary> {
  const content = await quoteAsTemplateContent(input.organizationId, input.quoteId);
  if (content.lines.length === 0) throw new QuoteEmptyError();
  if (!(await replaceQuoteTemplateContent(input.organizationId, input.templateId, content))) throw new QuoteTemplateNotFoundError();
  return toTemplateSummary((await findQuoteTemplate(input.organizationId, input.templateId))!);
}

export async function duplicateQuoteTemplate(input: { organizationId: string; templateId: string; name: string }): Promise<QuoteTemplateSummary> {
  const source = await findQuoteTemplate(input.organizationId, input.templateId);
  if (!source) throw new QuoteTemplateNotFoundError();
  const template = await insertQuoteTemplate(input.organizationId, { name: templateName(input.name), eventTypeId: source.template.eventTypeId }, templateContentOf(source));
  return toTemplateSummary((await findQuoteTemplate(input.organizationId, template.id))!);
}

function templateContentOf({ template, sections, lines, schedule }: TemplateWithContent): TemplateContent {
  return {
    globalDiscountKind: template.globalDiscountKind,
    globalDiscountValue: template.globalDiscountValue,
    advanceKind: template.advanceKind,
    sections: sections.map((section) => ({ key: section.id, title: section.title })),
    lines: lines.map((line) => ({
      sectionKey: line.sectionId,
      catalogItemId: line.catalogItemId,
      label: line.label,
      description: line.description,
      unit: line.unit,
      quantityMilli: line.quantityMilli,
      unitPriceCents: line.unitPriceCents,
      vatRateBasisPoints: line.vatRateBasisPoints,
      discountBasisPoints: line.discountBasisPoints,
      isOption: line.isOption,
    })),
    schedule: schedule.map((item) => ({ label: item.label, amountCents: item.amountCents, percentageBasisPoints: item.percentageBasisPoints, dueRule: item.dueRule === "before_event" ? "before_event" : "at_signature", daysBeforeEvent: item.daysBeforeEvent })),
  };
}

export async function renameQuoteTemplate(input: { organizationId: string; templateId: string; name: string; eventTypeId: string | null }): Promise<void> {
  if (!(await updateQuoteTemplateHeader(input.organizationId, input.templateId, { name: templateName(input.name), eventTypeId: input.eventTypeId }))) throw new QuoteTemplateNotFoundError();
}

export async function removeQuoteTemplate(organizationId: string, templateId: string): Promise<void> {
  if (!(await deleteQuoteTemplateRow(organizationId, templateId))) throw new QuoteTemplateNotFoundError();
}

// « Nouveau devis depuis un modèle » : le devis est créé, puis le modèle y est copié.
// Échéances : « à la signature » le jour même, « N jours avant » depuis la date de
// l'événement (à défaut, le jour même). Les lignes prennent le taux de TVA du modèle, ou le
// taux par défaut de l'organisation s'il est nul.
export async function createQuoteFromTemplate(input: CreateQuoteInput & { templateId: string }): Promise<QuoteDetail> {
  const template = await findQuoteTemplate(input.organizationId, input.templateId);
  if (!template) throw new QuoteTemplateNotFoundError();
  const created = await createQuote(input);
  const event = await getEvent(input.organizationId, input.eventId);
  const today = parisDate(input.now ?? new Date());
  const profile = await withDb((db) => getOrganizationProfile(db, input.organizationId));
  const defaultRate = profile.vatRegime === "assujetti" ? (profile.vatRateDefaultBasisPoints ?? 0) : 0;
  const result = await applyTemplateToDraft(input.organizationId, {
    quoteId: created.id,
    templateId: input.templateId,
    dueDate: (item) => {
      if (item.dueRule !== "before_event" || !event?.eventDate) return today;
      const due = addCalendarDays(event.eventDate, -(item.daysBeforeEvent ?? 0));
      return due < today ? today : due;
    },
    vatRateFor: (line) => (line.vatRateBasisPoints > 0 ? line.vatRateBasisPoints : defaultRate),
  });
  if (result.status === "not_found") throw new QuoteTemplateNotFoundError();
  if (result.status !== "ok") throw new QuoteVersionLockedError();
  return loadDetail(input.organizationId, created.id);
}

// Modèle de départ (HUB-26) : pour le métier de l'organisation, rattaché au type
// d'événement de même libellé s'il existe ; marqué « à adapter » dans son nom.
export async function addStarterQuoteTemplates(organizationId: string, locale: "fr" | "en"): Promise<QuoteTemplateSummary[]> {
  const profile = await withDb((db) => getOrganizationProfile(db, organizationId));
  const metier = profile.metier ?? "wedding_planner";
  const starters = starterQuoteTemplates(locale, metier);
  if (starters.length === 0) return [];
  const types = await listEventTypes(organizationId);
  const starterTypes = starterEventTypes(locale, metier);
  const rate = profile.vatRegime === "assujetti" ? (profile.vatRateDefaultBasisPoints ?? 0) : 0;
  const created: QuoteTemplateSummary[] = [];
  for (const starter of starters) {
    const label = starterTypes.find((type) => type.key === starter.eventTypeKey)?.label;
    const eventTypeId = label ? (types.find((type) => type.label.toLocaleLowerCase(locale) === label.toLocaleLowerCase(locale))?.id ?? null) : null;
    const template = await insertQuoteTemplate(organizationId, { name: starter.name, eventTypeId }, {
      globalDiscountKind: "none",
      globalDiscountValue: 0,
      advanceKind: null,
      sections: starter.sections,
      lines: starter.lines.map((line) => ({
        sectionKey: line.section,
        catalogItemId: null,
        label: line.label,
        description: null,
        unit: line.unit,
        quantityMilli: line.quantityMilli,
        unitPriceCents: 0,
        vatRateBasisPoints: rate,
        discountBasisPoints: 0,
        isOption: line.isOption,
      })),
      schedule: starter.schedule.map((entry) => ({ label: entry.label, amountCents: null, percentageBasisPoints: entry.percentageBasisPoints, dueRule: entry.dueRule, daysBeforeEvent: entry.daysBeforeEvent })),
    });
    created.push(toTemplateSummary((await findQuoteTemplate(organizationId, template.id))!));
  }
  return created;
}

// DEV-01 — à l'envoi, la version courante fige régime de TVA, mention
// légale, en-tête vendeur, totaux et date de validité (ONB-02 : un document
// émis ne change jamais quand le profil change).
export async function sendQuote(input: SendQuoteInput): Promise<QuoteDetail> {
  const now = input.now ?? new Date();
  const profile = await withDb((db) => getOrganizationProfile(db, input.organizationId));
  const settings = await getQuoteSettings(input.organizationId);
  const vatRegime = profile.vatRegime;
  const aggregate = await findQuoteAggregate(input.organizationId, input.quoteId);
  if (!aggregate) throw new QuoteNotFoundError();
  // Lot 31c (D18) : le devis d'un professionnel fige ses conditions de paiement et le taux choisi.
  const seller = await currentQuoteSeller(input.organizationId, aggregate.quote.clientKind);
  // Lot 31a (FAC-07, JUR-01, JUR-08 ; D4, D5) : mentions requises et acompte ou arrhes, nommés.
  const missing = await quoteMissingMentions(input.organizationId, input.quoteId);
  if (missing.length > 0) throw new RequiredMentionsMissingError(missing);
  const legalMention = computeLegalMention(profile);

  const result = await freezeCurrentVersion(input.organizationId, input.quoteId, (version, lines, items) => {
    // Vérifié ici, après « devis vide » : un devis vide est signalé d'abord.
    if (!vatRegime) throw new QuoteVatRegimeRequiredError();
    const totals = totalsFor(lines, version, vatRegime !== "franchise");
    // DEV-03 : un échéancier qui dépasse le total (après une baisse du
    // total) bloque l'envoi.
    if (resolveSchedule(items, totals.totalTtcCents).exceedsTotal) throw new QuoteScheduleExceedsTotalError();
    return {
      sentAt: now,
      validUntil: validUntil(parisDate(now), settings.validityDays),
      vatRegime,
      legalMention: legalMention === "" ? null : legalMention,
      sellerSnapshot: seller,
      totalsSnapshot: totals,
    };
  });
  if (result.status === "empty") throw new QuoteEmptyError();
  unwrap(result);
  return loadDetail(input.organizationId, input.quoteId);
}

// DEV-01 — « Modifier un devis envoyé crée une nouvelle version. »
export async function reviseQuote(organizationId: string, quoteId: string): Promise<QuoteDetail> {
  // DEV-02 : une version en cours de signature ne se remplace pas ; un devis
  // refusé, lui, peut repartir dans une nouvelle version.
  const before = await loadDetail(organizationId, quoteId);
  if (before.signature?.status === "pending" || before.status === "signed") throw new QuoteVersionLockedError();
  unwrap(await insertNextVersion(organizationId, quoteId));
  return loadDetail(organizationId, quoteId);
}

// --- DEV-03 : modes de paiement ---

function toPaymentMethod(row: PaymentMethodRow): PaymentMethod {
  return { id: row.id, label: row.label, archived: row.archivedAt !== null };
}

export async function listPaymentMethods(organizationId: string, options: { includeArchived?: boolean } = {}): Promise<PaymentMethod[]> {
  return (await findPaymentMethods(organizationId, options.includeArchived ?? false)).map(toPaymentMethod);
}

// Ajout d'un ou plusieurs modes (saisie libre ou modèle de départ), sans
// doublon. Lot 21 (DEV-13) : un mode désactivé du même nom est réactivé
// plutôt que créé une seconde fois.
export async function addPaymentMethods(organizationId: string, labels: string[]): Promise<PaymentMethod[]> {
  const all = await findPaymentMethods(organizationId, true);
  const existing = new Map(all.map((method) => [method.label.toLocaleLowerCase("fr"), method]));
  const fresh: string[] = [];
  const restored: PaymentMethod[] = [];
  for (const label of labels.map((value) => requireText(value, "mode de paiement"))) {
    const key = label.toLocaleLowerCase("fr");
    const known = existing.get(key);
    if (known) {
      if (known.archivedAt !== null) {
        await restorePaymentMethodRow(organizationId, known.id);
        restored.push({ ...toPaymentMethod(known), archived: false });
        existing.set(key, { ...known, archivedAt: null });
      }
      continue;
    }
    const now = new Date();
    existing.set(key, { id: "", label, position: 0, archivedAt: null, organizationId, createdAt: now, createdBy: null, updatedAt: now, updatedBy: null });
    fresh.push(label);
  }
  const created = fresh.length > 0 ? (await insertPaymentMethods(organizationId, fresh)).map(toPaymentMethod) : [];
  return [...restored, ...created];
}

// Lot 21 (DEV-13) : désactiver un mode le retire des choix à l'encaissement ;
// les paiements déjà enregistrés gardent leur mode. Il se réactive à tout moment.
export async function archivePaymentMethod(organizationId: string, paymentMethodId: string): Promise<void> {
  await archivePaymentMethodRow(organizationId, paymentMethodId);
}

export async function restorePaymentMethod(organizationId: string, paymentMethodId: string): Promise<void> {
  await restorePaymentMethodRow(organizationId, paymentMethodId);
}

// --- DEV-03 : échéancier ---

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requireDate(value: string, field: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!DATE_PATTERN.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`${field} invalide`);
  }
  return value;
}

function scheduleItemData(item: ScheduleItemInput): ScheduleItemData {
  const hasAmount = item.amountCents !== null && item.amountCents !== undefined;
  const hasPercentage = item.percentageBasisPoints !== null && item.percentageBasisPoints !== undefined;
  if (hasAmount === hasPercentage) throw new RangeError("montant ou pourcentage, l'un des deux");
  if (hasAmount) requireInteger(item.amountCents!, 1, MAX_AMOUNT_CENTS, "montant");
  if (hasPercentage) requireInteger(item.percentageBasisPoints!, 1, 10000, "pourcentage");
  return {
    label: requireText(item.label, "intitulé"),
    dueDate: requireDate(item.dueDate, "échéance"),
    amountCents: hasAmount ? item.amountCents! : null,
    percentageBasisPoints: hasPercentage ? item.percentageBasisPoints! : null,
  };
}

// Contrôle dans la transaction d'écriture : sur le total du brouillon, au
// régime courant de l'organisation.
async function scheduleCheck(organizationId: string): Promise<ScheduleCheck> {
  const profile = await withDb((db) => getOrganizationProfile(db, organizationId));
  return (version, lines, items) => {
    // Lot 31c (D22) : une deuxième échéance sur un devis à arrhes est refusée.
    if (version.advanceKind === "earnest" && items.length > 1) throw new EarnestSingleInstalmentError();
    const totals = totalsFor(lines, version, profile.vatRegime !== "franchise");
    if (resolveSchedule(items, totals.totalTtcCents).exceedsTotal) throw new QuoteScheduleExceedsTotalError();
  };
}

export async function addScheduleItem(organizationId: string, quoteId: string, item: ScheduleItemInput): Promise<QuoteDetail> {
  const data = scheduleItemData(item);
  unwrap(await insertScheduleItem(organizationId, quoteId, data, await scheduleCheck(organizationId)));
  return loadDetail(organizationId, quoteId);
}

export async function updateScheduleItem(organizationId: string, scheduleItemId: string, item: ScheduleItemInput): Promise<QuoteDetail> {
  const data = scheduleItemData(item);
  const quoteId = unwrap(await updateScheduleItemRow(organizationId, scheduleItemId, data, await scheduleCheck(organizationId)));
  return loadDetail(organizationId, quoteId);
}

export async function removeScheduleItem(organizationId: string, scheduleItemId: string): Promise<QuoteDetail> {
  const quoteId = unwrap(await deleteScheduleItemRow(organizationId, scheduleItemId));
  return loadDetail(organizationId, quoteId);
}

// DEV-03 — « Quand elle marque une échéance payée, alors elle saisit la
// date et le mode de paiement. » Pas de date future (heure de Paris).
export async function markScheduleItemPaid(input: MarkScheduleItemPaidInput): Promise<QuoteDetail> {
  const now = input.now ?? new Date();
  const paidOn = requireDate(input.paidOn, "date de paiement");
  if (paidOn > parisToday(now)) throw new RangeError("date de paiement future");
  // Lot 31c (JUR-08, D21) : si ce sont des arrhes, un reçu non fiscal de sa propre série, avec le
  // vendeur et l'apparence courants (le dépôt n'en crée un que pour un devis à arrhes).
  const settings = await findQuoteSettings(input.organizationId);
  const prefix = settings?.receiptPrefix ?? DEFAULT_SETTINGS.receiptPrefix!;
  const year = Number(parisDate(now).slice(0, 4));
  const receipt = {
    issuedAt: now,
    issuedOn: parisDate(now),
    year,
    formatNumber: (isDemo: boolean, rank: number) => formatDocumentNumber(isDemo ? `${DEMO_PREFIX}-${prefix}` : prefix, year, rank),
    sellerSnapshot: await currentSeller(input.organizationId, settings, "invoice"),
  };
  const quoteId = unwrap(
    await recordScheduleItemPayment(input.organizationId, input.scheduleItemId, { paidOn, paymentMethodId: input.paymentMethodId }, receipt),
  );
  return loadDetail(input.organizationId, quoteId);
}

// --- Lot 31c (JUR-08, D21) : reçus d'arrhes ---

function toReceiptView({ receipt, quoteNumber, cancelled }: ReceiptWithState): ReceiptView {
  return {
    id: receipt.id,
    quoteId: receipt.quoteId,
    quoteNumber,
    scheduleItemId: receipt.scheduleItemId,
    number: receipt.number,
    isDemo: receipt.isDemo,
    issuedOn: receipt.issuedOn,
    paidOn: receipt.paidOn,
    amountCents: receipt.amountCents,
    label: receipt.label,
    paymentMethodLabel: receipt.paymentMethodLabel,
    seller: receipt.sellerSnapshot as SellerSnapshot,
    buyers: receipt.buyerSnapshot as InvoiceBuyer[],
    cancelled,
  };
}

export async function listQuoteReceipts(organizationId: string, quoteId: string): Promise<ReceiptView[]> {
  const rows = await findQuoteReceipts(organizationId, quoteId);
  if (!rows) throw new QuoteNotFoundError();
  return rows.map(toReceiptView);
}

export async function getReceipt(organizationId: string, receiptId: string): Promise<ReceiptView> {
  const row = await findReceipt(organizationId, receiptId);
  if (!row) throw new ReceiptNotFoundError();
  return toReceiptView(row);
}

// Correction d'une saisie : l'échéance redevient à payer. Lot 23b (D2,
// FAC-14) : par une écriture inverse motivée ; la saisie reste.
export async function markScheduleItemUnpaid(organizationId: string, scheduleItemId: string, reason: string): Promise<QuoteDetail> {
  const motive = requireText(reason, "motif de l'annulation");
  const quoteId = unwrap(await reverseScheduleItemPayment(organizationId, scheduleItemId, motive));
  return loadDetail(organizationId, quoteId);
}

// DEV-03 — encaissements à venir. Sans horizon : toutes les échéances non
// payées (écran « Encaissements ») ; avec horizon : celles des N prochains
// jours (tableau de bord). Les retards sont toujours inclus, en tête.
export async function listUnpaidPayments(
  organizationId: string,
  options: { now?: Date; horizonDays?: number } = {},
): Promise<UnpaidPaymentsView> {
  const now = options.now ?? new Date();
  const rows = await findUnpaidScheduleItems(organizationId);
  // Montants résolus sur l'échéancier complet de chaque version (même
  // arrondi que la fiche du devis), à partir des totaux figés à l'envoi.
  const byVersion = new Map<string, typeof rows>();
  for (const row of rows) byVersion.set(row.version.id, [...(byVersion.get(row.version.id) ?? []), row]);

  const payments: UnpaidPayment[] = [];
  for (const versionRows of byVersion.values()) {
    const { version, quote } = versionRows[0]!;
    const totalTtcCents = (version.totalsSnapshot as QuoteTotalsView | null)?.totalTtcCents ?? 0;
    const resolved = resolveSchedule(versionRows.map((row) => row.item), totalTtcCents);
    versionRows.forEach((row, index) => {
      payments.push({
        scheduleItemId: row.item.id,
        quoteId: quote.id,
        quoteNumber: quote.number,
        eventId: quote.eventId,
        label: row.item.label,
        dueDate: row.item.dueDate,
        amountCents: resolved.amounts[index] ?? 0,
        overdue: isOverdue(row.item.dueDate, now),
      });
    });
  }
  payments.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.quoteNumber.localeCompare(b.quoteNumber));

  const limit = options.horizonDays === undefined ? null : addCalendarDays(parisToday(now), options.horizonDays);
  const overdue = payments.filter((payment) => payment.overdue);
  const upcoming = payments.filter((payment) => !payment.overdue && (limit === null || payment.dueDate <= limit));
  return {
    overdue,
    upcoming,
    overdueTotalCents: overdue.reduce((sum, payment) => sum + payment.amountCents, 0),
    months: groupByMonth(upcoming),
  };
}

// AIDE-02 — appelé par l'orchestrateur de purge des essais (lib/demo-purge).
export async function removeEventQuotesData(organizationId: string, eventIds: string[]): Promise<void> {
  const documentKeys = await deleteEventQuotes(organizationId, eventIds);
  const storage = documentKeys.length > 0 ? createStorageClient() : null;
  for (const key of documentKeys) await deletePrivateObject(storage!, key);
}

// --- DEV-02 : signature en ligne ---

const SIGNED_DOCUMENT_MAX_BYTES = 30 * 1024 * 1024;
const MAX_SIGNERS = 4;
const emailSchema = z.email();

export function isSignatureAvailable(isDemo: boolean): boolean {
  return signatureProviderFor(isDemo) !== null;
}

function signerRole(index: number): string {
  return `Signataire ${index + 1}`;
}

// Rôles des signataires, dans l'ordre : le PDF doit porter une balise par rôle.
export function signatureRoles(count: number): string[] {
  return Array.from({ length: count }, (_, index) => signerRole(index));
}

// Zones de signature du PDF envoyé : un rôle et sa balise par signataire.
export function signatureSlots(count: number): { role: string; tag: string }[] {
  return signatureRoles(count).map((role, index) => ({ role, tag: signatureTag(index) }));
}

function validSigners(signers: SignerInput[]): SignerInput[] {
  if (signers.length === 0 || signers.length > MAX_SIGNERS) throw new RangeError("un à quatre signataires");
  return signers.map((signer) => {
    const email = signer.email.trim().toLowerCase();
    if (!emailSchema.safeParse(email).success) throw new RangeError("e-mail du signataire invalide");
    return {
      eventClientId: signer.eventClientId ?? null,
      name: requireText(signer.name, "nom du signataire"),
      email,
      billingAddress: requireText(signer.billingAddress, "adresse de facturation"),
    };
  });
}

function signingMail(input: { locale: "fr" | "en"; organizationName: string; number: string; url: string }) {
  if (input.locale === "en") {
    return {
      subject: `Quote ${input.number} to sign — ${input.organizationName}`,
      text: `Hello,\n\n${input.organizationName} sends you quote ${input.number} to sign online. Your personal signing link:\n${input.url}\n\nThis link is personal: please do not forward it.\n\nThe Symbola team`,
    };
  }
  return {
    subject: `Devis ${input.number} à signer — ${input.organizationName}`,
    text: `Bonjour,\n\n${input.organizationName} vous envoie le devis ${input.number} à signer en ligne. Votre lien personnel de signature :\n${input.url}\n\nCe lien vous est personnel : merci de ne pas le transférer.\n\nL'équipe Symbola`,
  };
}

// La demande de signature est enregistrée, mais un ou plusieurs e-mails
// portant les liens n'ont pas pu partir (SMTP indisponible).
export class SignatureLinksNotMailedError extends Error {
  constructor(readonly count: number) {
    super("liens de signature non envoyés par e-mail");
    this.name = "SignatureLinksNotMailedError";
  }
}

// DEV-02 — « Envoi du devis (version courante figée) au fournisseur de
// signature ; chaque signataire reçoit son lien (e-mail envoyé par
// Symbola). » Un devis d'essai passe par le faux fournisseur, sans e-mail.
export async function sendQuoteForSignature(input: SendForSignatureInput): Promise<QuoteDetail> {
  const people = validSigners(input.signers);
  const quote = await loadDetail(input.organizationId, input.quoteId);
  if (quote.status !== "sent" || quote.current.sentAt === null) throw new QuoteNotSentError();
  if (quote.signature) throw new SignatureAlreadyRequestedError();
  const provider = signatureProviderFor(quote.isDemo);
  if (!provider) throw new SignatureUnavailableError();
  // Lot 31b (DOC-03, D9) : le contrat signé avec le devis doit être celui de la version courante,
  // généré après le dernier choix des options, et pas encore en signature.
  let orderFirst = false;
  if (input.contractId) {
    const contract = (await listQuoteContracts(input.organizationId, input.quoteId)).find((candidate) => candidate.id === input.contractId);
    if (!contract) throw new ContractNotFoundError();
    if (contract.outdated) throw new ContractOutdatedError();
    if (contract.signature) throw new SignatureAlreadyRequestedError();
    orderFirst = contract.regime.orderRequired;
    if (orderFirst) await requirePortalLinks(input.organizationId, quote.eventId, people);
  }

  const signerIds = people.map(() => randomUUID());
  const created = await provider.createRequest({
    title: `${quote.number} V${quote.current.version}`,
    pdf: Buffer.from(input.documentPdf),
    signers: people.map((signer, index) => ({
      externalId: `${input.organizationId}.${signerIds[index]}`,
      name: signer.name,
      email: signer.email,
      role: signerRole(index),
    })),
  });

  const result = await insertSignatureRequest(input.organizationId, input.quoteId, {
    provider: provider.name,
    externalId: created.externalId,
    kind: input.contractId ? "quote_contract" : "quote",
    contractId: input.contractId ?? null,
    signers: people.map((signer, index) => {
      const externalId = `${input.organizationId}.${signerIds[index]}`;
      const link = created.signers.find((candidate) => candidate.externalId === externalId);
      if (!link) throw new Error("lien de signature manquant");
      return {
        id: signerIds[index]!,
        eventClientId: signer.eventClientId ?? null,
        name: signer.name,
        email: signer.email,
        billingAddress: signer.billingAddress,
        signingUrl: link.signingUrl,
        externalId,
        position: index,
      };
    }),
  });
  if (result.status === "exists") throw new SignatureAlreadyRequestedError();
  if (result.status === "not_sent") throw new QuoteNotSentError();
  unwrap(result as PaymentResult);

  const detail = await loadDetail(input.organizationId, input.quoteId);
  if (!quote.isDemo) {
    const organizationName = quote.current.seller?.organizationName ?? "";
    let notMailed = 0;
    for (const signer of detail.signature?.signers ?? []) {
      const mail = orderFirst
        ? orderFirstMail({ locale: input.locale, organizationName, number: quote.number })
        : signingMail({ locale: input.locale, organizationName, number: quote.number, url: signer.signingUrl });
      try {
        // Lot 24b (SEC-22, décision D5) : au-delà du plafond de l'heure, l'e-mail
        // ne part pas ; la planner copie le lien depuis le devis.
        await reserveOrganizationMail(input.organizationId);
        await sendMail({ to: signer.email, ...mail });
      } catch (error) {
        // La demande existe chez le fournisseur : on n'annule rien, la
        // planner copie les liens depuis le devis (jamais l'adresse au journal).
        notMailed += 1;
        console.error(`e-mail de signature non envoyé (signataire ${signer.id})`, error instanceof Error ? error.message : error);
      }
    }
    if (notMailed > 0) throw new SignatureLinksNotMailedError(notMailed);
  }
  return detail;
}

function rejected(reason: string): SignatureWebhookResult {
  // Journal applicatif : motif seulement, jamais le corps ni d'en-tête
  // (CLAUDE.md §5 : aucune donnée personnelle dans les journaux).
  console.warn(`webhook de signature rejeté : ${reason}`);
  return { httpStatus: 401, outcome: reason };
}

const ORGANIZATION_PREFIX = /^([0-9a-f-]{36})\.([0-9a-f-]{36})$/;

// DEV-02, ADR 0021 — webhook du fournisseur : authentification par le
// secret partagé, puis relecture de l'état réel chez le fournisseur avant
// toute écriture ; idempotent.
export async function handleSignatureWebhook(input: { headers: Headers; rawBody: string }): Promise<SignatureWebhookResult> {
  const provider = realSignatureProvider();
  if (!provider) return rejected("unavailable");
  const authentication = provider.authenticateWebhook(input.headers, input.rawBody);
  if (!authentication.ok) return rejected(authentication.reason);

  // Organisation portée par l'identifiant externe du signataire.
  const match = authentication.signerExternalIds.map((id) => ORGANIZATION_PREFIX.exec(id)).find((found) => found !== null);
  if (!match) return { httpStatus: 200, outcome: "unknown_request" };
  const organizationId = match[1]!;
  const context = await findSignatureRequestByExternalId(organizationId, provider.name, authentication.requestExternalId);
  const signerIds = new Set(context?.signers.map((signer) => signer.externalId));
  if (!context || !authentication.signerExternalIds.every((id) => signerIds.has(id))) {
    await insertWebhookLog(organizationId, { requestId: null, eventType: authentication.eventType, outcome: "unknown_request" });
    return { httpStatus: 200, outcome: "unknown_request" };
  }
  const outcome = await applySignatureState(organizationId, context.request, provider, authentication.eventType);
  return { httpStatus: 200, outcome };
}

// Relit l'état chez le fournisseur et l'applique (webhook, page de
// signature fictive). Renvoie le résultat journalisé.
async function applySignatureState(
  organizationId: string,
  request: SignatureRequestRow,
  provider: SignatureProvider,
  eventType: string,
  options: { logUnchanged?: boolean } = {},
): Promise<string> {
  if (request.status !== "pending") {
    await insertWebhookLog(organizationId, { requestId: request.id, eventType, outcome: "duplicate" });
    return "duplicate";
  }
  const state = await provider.getRequest(request.externalId);
  const context = await findSignatureRequestByExternalId(organizationId, provider.name, request.externalId);
  if (!context) return "unknown_request";
  const byExternalId = new Map(state.signers.map((signer) => [signer.externalId, signer]));
  const signers = context.signers.map((signer) => {
    const remote = signer.externalId ? byExternalId.get(signer.externalId) : undefined;
    return {
      id: signer.id,
      status: remote?.status ?? ("pending" as const),
      signedAt: remote?.status === "signed" && remote.signedAt ? new Date(remote.signedAt) : null,
    };
  });

  const now = new Date();
  let outcome: Parameters<typeof applySignatureStateRows>[2]["outcome"] = { kind: "pending" };
  let storedKeys: string[] = [];
  let signedDocuments: { signedPdf: Buffer; signedDocumentSha256: string; auditCertificateSha256: string } | null = null;
  if (state.status === "completed") {
    const documents = await provider.downloadDocuments(request.externalId);
    const store = async (buffer: Buffer) => {
      const uploaded = await uploadFile({ organizationId, buffer, maxSizeBytes: SIGNED_DOCUMENT_MAX_BYTES });
      if (uploaded.status !== "uploaded" || uploaded.mime !== "application/pdf") throw new Error(`document signé refusé (${uploaded.status})`);
      return uploaded.key;
    };
    const signedDocumentKey = await store(documents.signedPdf);
    const auditCertificateKey = await store(documents.auditCertificatePdf);
    // Lot 23b (DOC-08) : empreintes des fichiers archivés, vérifiées à la relecture.
    const signedDocumentSha256 = sha256Hex(documents.signedPdf);
    const auditCertificateSha256 = sha256Hex(documents.auditCertificatePdf);
    storedKeys = [signedDocumentKey, auditCertificateKey];
    signedDocuments = { signedPdf: documents.signedPdf, signedDocumentSha256, auditCertificateSha256 };
    const totals = context.version.totalsSnapshot as QuoteTotalsView | null;
    const payload: QuoteSignedPayload = {
      quoteId: context.quote.id,
      eventId: context.quote.eventId,
      version: context.version.version,
      totalTtcCents: totals?.totalTtcCents ?? 0,
      currency: "EUR",
      signedAt: now.toISOString(),
    };
    outcome = {
      kind: "completed",
      signedDocumentKey,
      auditCertificateKey,
      signedDocumentSha256,
      auditCertificateSha256,
      completedAt: now,
      event: { name: QUOTES_QUOTE_SIGNED, version: QUOTES_QUOTE_SIGNED_VERSION, payload },
    };
  } else if (state.status === "declined") {
    outcome = { kind: "declined", completedAt: now };
  }

  const applied = await applySignatureStateRows(organizationId, request.id, { signers, outcome }, eventType, options);
  if (applied.status !== "ok") return "unknown_request";
  if (!applied.transitioned) {
    // Un appel concurrent a terminé la demande entre-temps : nos copies
    // des documents ne servent pas.
    const storage = storedKeys.length > 0 ? createStorageClient() : null;
    for (const key of storedKeys) await deletePrivateObject(storage!, key);
    return applied.changed ? "signer_updated" : outcome.kind === "pending" ? "unchanged" : "duplicate";
  }
  if (outcome.kind === "completed" && signedDocuments) await afterSigned(organizationId, context.quote.id, request.id, signedDocuments, now);
  return outcome.kind;
}

// ADR 0026 — vérification régulière des demandes en attente : relit leur
// état chez le fournisseur, comme le ferait un webhook, au cas où un appel
// se serait perdu (réseau, Documenso redémarré). Une erreur sur une
// demande n'empêche pas de vérifier les suivantes.
export async function reconcilePendingSignatures(organizationId: string): Promise<{ checked: number; completed: number }> {
  const provider = realSignatureProvider();
  if (!provider) return { checked: 0, completed: 0 };
  const pending = await listPendingSignatureRequests(organizationId, provider.name);
  let completed = 0;
  for (const request of pending) {
    try {
      const outcome = await applySignatureState(organizationId, request, provider, "reconciliation", { logUnchanged: false });
      if (outcome === "completed" || outcome === "declined") completed += 1;
    } catch (error) {
      // Identifiants seulement, jamais de donnée personnelle (CLAUDE.md §5).
      console.error(`vérification de la demande de signature ${request.id} échouée`, error instanceof Error ? error.message : error);
    }
  }
  return { checked: pending.length, completed };
}

// Effets qui suivent la signature, une seule fois (appel qui a terminé la
// demande) : événement Confirmé (PRD-EVT-02) et e-mail à la planner ; lot 31b : dossier de
// preuve et exemplaire signé remis aux signataires quand un contrat est signé, facture
// d'acompte à émettre d'elle-même quand le devis est signé. Une erreur sur un effet n'empêche
// pas les suivants (la signature, elle, est enregistrée).
async function afterSigned(
  organizationId: string,
  quoteId: string,
  requestId: string,
  documents: { signedPdf: Buffer; signedDocumentSha256: string; auditCertificateSha256: string },
  now: Date,
): Promise<void> {
  const aggregate = await findQuoteAggregate(organizationId, quoteId);
  const request = aggregate?.signatureRequests.find((candidate) => candidate.id === requestId);
  if (!aggregate || !request) return;
  const contract = request.contractId ? await findContract(organizationId, request.contractId) : null;
  const signers = aggregate.signers.filter((signer) => signer.requestId === request.id);
  const effects: [string, () => Promise<void>][] = [];
  if (contract) {
    effects.push(["dossier de preuve", () => writeContractEvidence(organizationId, aggregate.quote, request, contract.contract, contract.acts, signers, documents, now)]);
    effects.push(["exemplaire signé", () => mailSignedContract(organizationId, aggregate.quote, signers, documents.signedPdf)]);
  }
  if (request.kind !== "contract") {
    effects.push(["facture d'acompte", () => scheduleDepositInvoice(organizationId, aggregate, request, contract, now)]);
    effects.push(["confirmation", () => confirmSignedQuote(organizationId, quoteId)]);
  }
  for (const [label, effect] of effects) {
    try {
      await effect();
    } catch (error) {
      // Identifiants seulement, jamais de donnée personnelle (CLAUDE.md §5).
      console.error(`effet de la signature « ${label} » échoué (demande ${requestId})`, error instanceof Error ? error.message : error);
    }
  }
}

async function confirmSignedQuote(organizationId: string, quoteId: string): Promise<void> {
  const quote = await loadDetail(organizationId, quoteId);
  const aggregate = await findQuoteAggregate(organizationId, quoteId);
  const createdByUserId = aggregate?.quote.createdByUserId;
  const event = await getEvent(organizationId, quote.eventId);
  if (event && createdByUserId && event.status !== "confirmed" && event.status !== "done") {
    await changeEventStatus({ organizationId, eventId: quote.eventId, changedByUserId: createdByUserId, toStatus: "confirmed" });
  }
  if (quote.isDemo || !createdByUserId) return;
  const contact = await withDb((db) => getUserContact(db, organizationId, createdByUserId));
  if (!contact) return;
  const env = parseEnv(process.env);
  const link = `${env.APP_PUBLIC_URL}/devis/${quoteId}`;
  await sendMail(
    contact.language === "en"
      ? {
          to: contact.email,
          subject: `Quote ${quote.number} signed`,
          text: `Hello,\n\nQuote ${quote.number} has been signed by all signers. The event is now confirmed. The signed document and its audit certificate are available on the quote:\n${link}\n\nThe Symbola team`,
        }
      : {
          to: contact.email,
          subject: `Devis ${quote.number} signé`,
          text: `Bonjour,\n\nLe devis ${quote.number} a été signé par tous les signataires. L'événement passe en « Confirmé ». Le document signé et son certificat de preuve sont disponibles sur le devis :\n${link}\n\nL'équipe Symbola`,
        },
  );
}

// Document signé ou certificat de preuve de la version courante, lu dans le
// stockage privé et servi par l'app (ADR 0027).
// Lot 31b (D9) : « contract » sert le document du contrat signé seul, après le devis.
export async function getSignatureDocument(organizationId: string, quoteId: string, kind: "signed" | "certificate", scope: "quote" | "contract" = "quote"): Promise<FileDownload> {
  const aggregate = await findQuoteAggregate(organizationId, quoteId);
  if (!aggregate) throw new QuoteNotFoundError();
  const version = aggregate.versions.find((candidate) => candidate.version === aggregate.quote.currentVersion);
  const request = aggregate.signatureRequests
    .filter((candidate) => candidate.versionId === version?.id && (scope === "contract" ? candidate.kind === "contract" : candidate.kind !== "contract"))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const key = kind === "signed" ? request?.signedDocumentKey : request?.auditCertificateKey;
  const expected = kind === "signed" ? request?.signedDocumentSha256 : request?.auditCertificateSha256;
  if (!key) throw new SignatureDocumentNotFoundError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), key);
    // Lot 23b (DOC-08) : le fichier relu doit être celui de l'archivage (les
    // documents signés avant le lot 23b n'ont pas d'empreinte).
    if (expected && sha256Hex(data) !== expected) {
      await withDb((db) =>
        recordAudit(db, { organizationId, action: "quotes.original.altered", objectType: "quote", objectId: aggregate.quote.id, details: { number: aggregate.quote.number, file: kind } }),
      );
      throw new OriginalAlteredError();
    }
    const suffix = `${scope === "contract" ? "contrat-" : ""}${kind === "signed" ? "signe" : "certificat"}`;
    return { data, contentType: "application/pdf", fileName: `${aggregate.quote.number}-${suffix}.pdf` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new SignatureDocumentNotFoundError();
    throw error;
  }
}

// DEV-02 — espace du marié (accès à l'événement vérifié par l'appelant,
// PRD-EVT-06) : les devis à signer et le seul lien de ce marié, reconnu par
// l'e-mail de son compte.
export async function listClientQuotesToSign(organizationId: string, eventId: string, clientEmail: string): Promise<ClientQuoteToSign[]> {
  const email = clientEmail.trim().toLowerCase();
  const contexts = (await findEventSignatureContexts(organizationId, eventId)).filter((context) => context.request.status !== "declined");
  const result: ClientQuoteToSign[] = [];
  for (const context of contexts) {
    const own = context.signers.find((signer) => signer.email === email) ?? null;
    const totals = context.version.totalsSnapshot as QuoteTotalsView | null;
    const open = Boolean(own && context.request.status === "pending" && own.status === "pending");
    const contract = context.request.contractId ? await clientContract(organizationId, context.request.contractId, own?.id ?? null, open) : null;
    // Lot 31b (D13) : à distance, le lien de signature suit la commande avec obligation de paiement.
    const ordered = !contract || !contract.orderRequired || contract.orderedAt !== null;
    result.push({
      quoteId: context.quote.id,
      number: context.quote.number,
      version: context.version.version,
      totalTtcCents: totals?.totalTtcCents ?? 0,
      status: context.request.status,
      ownSigningUrl: own && open && ordered ? own.signingUrl : null,
      ownStatus: own?.status ?? null,
      advanceKind: context.version.advanceKind,
      kind: context.request.kind,
      contract,
    });
  }
  return result;
}

async function clientContract(organizationId: string, contractId: string, signerId: string | null, open: boolean): Promise<ClientContract | null> {
  const found = await findContract(organizationId, contractId);
  if (!found) return null;
  const regime = regimeOf(found.contract);
  const own = (kind: ContractSignerActRow["kind"]) => found.acts.find((act) => act.signerId === signerId && act.kind === kind)?.actedAt.toISOString() ?? null;
  const earlyExecution = regime.withdrawalApplies ? (found.contract.clauses.find((clause) => clause.role === "early_execution")?.body ?? null) : null;
  return {
    contractId: found.contract.id,
    title: found.contract.title,
    version: found.contract.version,
    withdrawalApplies: found.contract.withdrawalApplies,
    orderRequired: regime.orderRequired,
    orderedAt: own("order"),
    earlyExecutionText: earlyExecution,
    earlyExecutionRequestedAt: own("early_execution"),
    open: open && signerId !== null,
  };
}

// Page de signature du faux fournisseur (développement, essai guidé) : en
// production, seuls les devis d'essai peuvent s'y signer (ADR 0021).
export async function findFakeSignature(token: string): Promise<{ quoteNumber: string; signerName: string; status: string; isDemo: boolean } | null> {
  const fake = fakeSignatureProvider();
  const found = fake.findByToken(token);
  const match = found ? ORGANIZATION_PREFIX.exec(found.signer.externalId) : null;
  if (!found || !match) return null;
  const context = await findSignatureRequestByExternalId(match[1]!, "fake", found.request.externalId);
  if (!context || !fakeSigningAllowed(context.quote.isDemo)) return null;
  const signer = context.signers.find((candidate) => candidate.externalId === found.signer.externalId);
  return { quoteNumber: context.quote.number, signerName: signer?.name ?? "", status: found.signer.status, isDemo: context.quote.isDemo };
}

function fakeSigningAllowed(isDemo: boolean): boolean {
  return isDemo || parseEnv(process.env).NODE_ENV !== "production";
}

export async function actOnFakeSignature(token: string, action: "sign" | "decline"): Promise<boolean> {
  const fake = fakeSignatureProvider();
  const found = fake.findByToken(token);
  const match = found ? ORGANIZATION_PREFIX.exec(found.signer.externalId) : null;
  if (!found || !match) return false;
  const organizationId = match[1]!;
  const context = await findSignatureRequestByExternalId(organizationId, "fake", found.request.externalId);
  if (!context || !fakeSigningAllowed(context.quote.isDemo)) return false;
  fake.act(found.request.externalId, found.signer.externalId, action);
  await applySignatureState(organizationId, context.request, fake, action === "sign" ? "form.completed" : "form.declined");
  return true;
}

// --- DEV-04 : factures conformes ---

export async function setQuoteClientKind(organizationId: string, quoteId: string, clientKind: ClientKind): Promise<QuoteDetail> {
  if (clientKind !== "individual" && clientKind !== "professional" && clientKind !== "non_professional") throw new RangeError("type de client inconnu");
  if (!(await updateQuoteClientKind(organizationId, quoteId, clientKind))) throw new QuoteNotFoundError();
  return loadDetail(organizationId, quoteId);
}

type FrozenLine = InvoiceView["lines"][number];

function creditedOf(invoiceId: string, notes: CreditNoteRow[]): number {
  return notes.filter((note) => note.invoiceId === invoiceId).reduce((sum, note) => sum + note.amountCents, 0);
}

// Facture « active » : pas entièrement annulée par ses avoirs.
function isActive(invoice: InvoiceRow, notes: CreditNoteRow[]): boolean {
  return invoice.amountCents - creditedOf(invoice.id, notes) > 0;
}

function documentNumbering(settingsPrefix: string, isDemo: boolean, now: Date) {
  const year = Number(parisDate(now).slice(0, 4));
  const prefix = isDemo ? `${DEMO_PREFIX}-${settingsPrefix}` : settingsPrefix;
  return { year, formatNumber: (rank: number) => formatDocumentNumber(prefix, year, rank) };
}

// Contrôles communs puis copies figées : mention de TVA (figée à l'envoi du
// devis), vendeur à jour et apparence de la facture (lot 17, ADR 0046),
// acheteurs (signataires), réglages de facturation.
function invoiceBase(context: InvoicingContext, now: Date, seller: Omit<SellerSnapshot, "document">) {
  if (context.quote.status !== "signed" || !context.version.sentAt) throw new QuoteNotSignedError();
  if (context.quote.clientKind === "professional") throw new ProfessionalInvoiceNotSupportedError();
  const buyers: InvoiceBuyer[] = context.signers.map((signer) => ({ name: signer.name, billingAddress: signer.billingAddress }));
  if (buyers.length === 0) throw new QuoteNotSignedError();
  const totals = context.version.totalsSnapshot as QuoteTotalsView;
  const settings = context.settings;
  return {
    issuedOn: parisDate(now),
    totals,
    buyers,
    settings: {
      invoicePrefix: settings?.invoicePrefix ?? DEFAULT_SETTINGS.invoicePrefix,
      paymentTermDays: settings?.invoicePaymentTermDays ?? DEFAULT_SETTINGS.invoicePaymentTermDays,
      mentions: settings?.invoiceMentions ?? null,
    },
    common: {
      quoteId: context.quote.id,
      versionId: context.version.id,
      issuedAt: now,
      vatRegime: context.version.vatRegime ?? "franchise",
      legalMention: context.version.legalMention,
      mentions: settings?.invoiceMentions ?? null,
      sellerSnapshot: { ...seller, document: documentSnapshot(toDocumentSettings(settings), "invoice") } satisfies SellerSnapshot,
      buyerSnapshot: buyers,
    },
  };
}

function frozenLines(context: InvoicingContext): FrozenLine[] {
  return includedLines(context.lines).map((line) => ({
    label: line.label,
    description: line.description,
    unit: line.unit,
    quantityMilli: line.quantityMilli,
    unitPriceCents: line.unitPriceCents,
    vatRateBasisPoints: line.vatRateBasisPoints,
    discountBasisPoints: line.discountBasisPoints,
    netCents: lineAmounts(line).netCents,
  }));
}

type InvoiceTotalsSnapshot = {
  quoteTotals: QuoteTotalsView;
  totals: InvoiceTotalsView;
  // Lot 31c (D20) : chaque acompte déduit avec son HT et sa TVA par taux (absents avant le 31c).
  deductions: { number: string; amountCents: number; totals?: InvoiceTotalsView }[];
  depositLabel: string | null;
  // Lot 31a (JUR-08) : acompte ou arrhes, repris du devis.
  advanceKind?: AdvanceKind | null;
  // Lot 31c (D21) : arrhes reçues, en règlement sur le solde d'un devis à arrhes.
  settlements?: { label: string; paidOn: string; amountCents: number }[];
};

function toCreditNoteView(note: CreditNoteRow, invoiceNumber: string): CreditNoteView {
  return {
    id: note.id,
    invoiceId: note.invoiceId,
    invoiceNumber,
    number: note.number,
    isDemo: note.isDemo,
    issuedOn: note.issuedOn,
    amountCents: note.amountCents,
    reason: note.reason,
    legalMention: note.legalMention,
    seller: note.sellerSnapshot as SellerSnapshot,
    buyers: note.buyerSnapshot as InvoiceBuyer[],
    totals: note.totalsSnapshot as InvoiceTotalsView,
  };
}

function toInvoiceView(invoice: InvoiceRow, quoteNumber: string, notes: CreditNoteRow[]): InvoiceView {
  const snapshot = invoice.totalsSnapshot as InvoiceTotalsSnapshot;
  const own = notes.filter((note) => note.invoiceId === invoice.id);
  return {
    id: invoice.id,
    quoteId: invoice.quoteId,
    quoteNumber,
    kind: invoice.kind,
    scheduleItemId: invoice.scheduleItemId,
    number: invoice.number,
    isDemo: invoice.isDemo,
    issuedOn: invoice.issuedOn,
    serviceDate: invoice.serviceDate,
    paymentDueOn: invoice.paymentDueOn,
    amountCents: invoice.amountCents,
    vatRegime: invoice.vatRegime === "assujetti" ? "assujetti" : "franchise",
    vatApplicable: invoice.vatRegime !== "franchise",
    legalMention: invoice.legalMention,
    mentions: invoice.mentions,
    seller: invoice.sellerSnapshot as SellerSnapshot,
    buyers: invoice.buyerSnapshot as InvoiceBuyer[],
    lines: invoice.linesSnapshot as FrozenLine[],
    depositLabel: snapshot.depositLabel,
    advanceKind: snapshot.advanceKind ?? null,
    quoteTotals: snapshot.quoteTotals,
    deductions: snapshot.deductions,
    settlements: snapshot.settlements ?? [],
    amountDueCents: invoice.amountCents - (snapshot.settlements ?? []).reduce((sum, settlement) => sum + settlement.amountCents, 0),
    totals: snapshot.totals,
    creditNotes: own.map((note) => toCreditNoteView(note, invoice.number)),
    creditedCents: own.reduce((sum, note) => sum + note.amountCents, 0),
  };
}

// DEV-04 — « Quand elle génère une facture d'acompte depuis un devis signé,
// alors elle reçoit un numéro de la série de facturation, continu et sans
// trou. » Une facture par échéance (sauf si un avoir l'a annulée), jamais
// après la facture de solde.
export async function issueDepositInvoice(input: IssueDepositInvoiceInput): Promise<InvoiceView> {
  const now = input.now ?? new Date();
  const seller = await withDb((db) => getSellerDetails(db, input.organizationId));
  const { rules } = await withDb((db) => getRequiredMentionRules(db));
  // Lot 31b (réponse 1 de l'avocat) : hors établissement, aucun paiement avant sept jours.
  const paymentNotBefore = input.paymentNotBefore === undefined ? ((await findScheduledDepositForItem(input.organizationId, input.scheduleItemId))?.paymentNotBefore ?? null) : input.paymentNotBefore;
  const row = await insertInvoice(input.organizationId, { scheduleItemId: input.scheduleItemId }, (context) => {
    // Lot 31c (D21) : des arrhes ne se facturent pas ; aucun numéro n'est consommé.
    if (context.version.advanceKind === "earnest") throw new EarnestNotInvoicedError();
    // Le refus du client professionnel (Factur-X, lot 41) passe avant ses mentions (D18).
    if (context.quote.clientKind === "professional") throw new ProfessionalInvoiceNotSupportedError();
    requireInvoiceMentions(rules, "deposit_invoice", context, seller);
    const base = invoiceBase(context, now, seller);
    const index = context.scheduleItems.findIndex((item) => item.id === input.scheduleItemId);
    const item = context.scheduleItems[index];
    if (!item) throw new QuoteVersionLockedError();
    const active = context.invoices.filter((invoice) => isActive(invoice, context.creditNotes));
    if (active.some((invoice) => invoice.kind === "balance" || invoice.scheduleItemId === item.id)) throw new InvoiceAlreadyIssuedError();
    const amountCents = resolveSchedule(context.scheduleItems, base.totals.totalTtcCents).amounts[index] ?? 0;
    const snapshot: InvoiceTotalsSnapshot = {
      quoteTotals: base.totals,
      totals: prorateTotals(base.totals, amountCents),
      deductions: [],
      depositLabel: item.label,
      advanceKind: context.version.advanceKind,
    };
    return {
      isDemo: context.quote.isDemo,
      ...documentNumbering(base.settings.invoicePrefix, context.quote.isDemo, now),
      values: {
        ...base.common,
        scheduleItemId: item.id,
        kind: "deposit",
        issuedOn: base.issuedOn,
        // « Date de l'acompte » : celle du paiement s'il est reçu, sinon l'échéance.
        serviceDate: item.paidOn ?? item.dueDate,
        paymentDueOn: [item.dueDate, base.issuedOn, paymentNotBefore ?? ""].reduce((latest, date) => (date > latest ? date : latest)),
        amountCents,
        linesSnapshot: [],
        totalsSnapshot: snapshot,
      },
    };
  }, keepInvoiceOriginal(input.organizationId, input.renderOriginal));
  if (!row) throw new QuoteNotFoundError();
  // Lot 31b (FAC-05) : émise à la main ou d'elle-même, elle clôt la facture à émettre.
  await closeScheduledDepositForItem(input.organizationId, input.scheduleItemId, row.id);
  return getInvoice(input.organizationId, row.id);
}

// DEV-04 — facture de solde : lignes du devis, acomptes facturés déduits
// (nets de leurs avoirs), date de la prestation = date de l'événement.
export async function issueBalanceInvoice(input: IssueBalanceInvoiceInput): Promise<InvoiceView> {
  const now = input.now ?? new Date();
  const quote = await findQuoteAggregate(input.organizationId, input.quoteId);
  if (!quote) throw new QuoteNotFoundError();
  const event = await getEvent(input.organizationId, quote.quote.eventId);
  const seller = await withDb((db) => getSellerDetails(db, input.organizationId));
  const { rules } = await withDb((db) => getRequiredMentionRules(db));
  const row = await insertInvoice(input.organizationId, { quoteId: input.quoteId }, (context) => {
    if (context.quote.clientKind === "professional") throw new ProfessionalInvoiceNotSupportedError();
    requireInvoiceMentions(rules, "balance_invoice", context, seller);
    const base = invoiceBase(context, now, seller);
    const active = context.invoices.filter((invoice) => isActive(invoice, context.creditNotes));
    if (active.some((invoice) => invoice.kind === "balance")) throw new InvoiceAlreadyIssuedError();
    // Lot 31c (D20) : chaque acompte, net de ses avoirs, est retiré en HT et en TVA de son propre
    // taux, depuis les copies figées ; le reste n'est plus ventilé au prorata.
    const deductions = active
      .filter((invoice) => invoice.kind === "deposit")
      .map((invoice) => {
        const own = context.creditNotes.filter((note) => note.invoiceId === invoice.id);
        const net = own.reduce((totals, note) => subtractTotals(totals, note.totalsSnapshot as InvoiceTotals), (invoice.totalsSnapshot as InvoiceTotalsSnapshot).totals as InvoiceTotals);
        return { number: invoice.number, amountCents: invoice.amountCents - creditedOf(invoice.id, context.creditNotes), totals: net };
      });
    const totals = balanceTotals(base.totals, deductions.map((deduction) => deduction.totals));
    const amountCents = totals.totalTtcCents;
    if (amountCents <= 0) throw new InvoiceAlreadyIssuedError();
    // Lot 31c (D21) : un devis à arrhes est facturé au prix total ; les arrhes reçues (non
    // annulées) viennent en règlement.
    const reversed = new Set(context.payments.flatMap((payment) => (payment.reversesEntryId ? [payment.reversesEntryId] : [])));
    const labelOf = new Map(context.scheduleItems.map((item) => [item.id, item.label]));
    const settlements =
      context.version.advanceKind === "earnest"
        ? context.payments
            .filter((payment) => payment.kind === "received" && !reversed.has(payment.id) && payment.paidOn !== null)
            .map((payment) => ({ label: labelOf.get(payment.scheduleItemId) ?? "", paidOn: payment.paidOn!, amountCents: payment.amountCents }))
        : [];
    const snapshot: InvoiceTotalsSnapshot = {
      quoteTotals: base.totals,
      totals,
      deductions,
      depositLabel: null,
      advanceKind: context.version.advanceKind,
      settlements,
    };
    return {
      isDemo: context.quote.isDemo,
      ...documentNumbering(base.settings.invoicePrefix, context.quote.isDemo, now),
      values: {
        ...base.common,
        scheduleItemId: null,
        kind: "balance",
        issuedOn: base.issuedOn,
        serviceDate: event?.eventDate ?? null,
        paymentDueOn: addDays(base.issuedOn, base.settings.paymentTermDays),
        amountCents,
        linesSnapshot: frozenLines(context),
        totalsSnapshot: snapshot,
      },
    };
  }, keepInvoiceOriginal(input.organizationId, input.renderOriginal));
  if (!row) throw new QuoteNotFoundError();
  return getInvoice(input.organizationId, row.id);
}

// DEV-04 — avoir (série à part), partiel ou total ; jamais plus que le
// montant restant de la facture, qui elle ne change pas.
export async function issueCreditNote(input: IssueCreditNoteInput): Promise<CreditNoteView> {
  const now = input.now ?? new Date();
  requireInteger(input.amountCents, 1, MAX_AMOUNT_CENTS, "montant de l'avoir");
  const reason = requireText(input.reason, "motif de l'avoir");
  const { rules } = await withDb((db) => getRequiredMentionRules(db));
  const row = await insertCreditNote(input.organizationId, input.invoiceId, (invoice, existing, settings) => {
    if (!invoice.isDemo) {
      const frozen = invoice.sellerSnapshot as SellerSnapshot;
      const missing = missingMentions(rules, {
        document: "credit_note",
        vatRegime: invoice.vatRegime === "assujetti" ? "assujetti" : "franchise",
        clientKind: "individual",
        legalForm: frozen.legalForm ?? null,
        values: mentionValues(frozen, { individual: invoice.mentions, professional: null, latePenaltyRate: null }),
      });
      if (missing.length > 0) throw new RequiredMentionsMissingError(missing);
    }
    const remaining = invoice.amountCents - existing.reduce((sum, note) => sum + note.amountCents, 0);
    if (input.amountCents > remaining) throw new CreditNoteExceedsInvoiceError();
    const invoiceTotals = (invoice.totalsSnapshot as InvoiceTotalsSnapshot).totals;
    const asQuoteTotals = { subtotalCents: invoiceTotals.totalHtCents, globalDiscountCents: 0, ...invoiceTotals };
    return {
      isDemo: invoice.isDemo,
      ...documentNumbering(settings?.creditNotePrefix ?? DEFAULT_SETTINGS.creditNotePrefix, invoice.isDemo, now),
      values: {
        invoiceId: invoice.id,
        issuedAt: now,
        issuedOn: parisDate(now),
        amountCents: input.amountCents,
        reason,
        legalMention: invoice.legalMention,
        sellerSnapshot: invoice.sellerSnapshot,
        buyerSnapshot: invoice.buyerSnapshot,
        totalsSnapshot: prorateTotals(asQuoteTotals, input.amountCents),
      },
    };
  }, async (tx, creditNote, invoice) => {
    // Lot 23b (DOC-08) : l'original de l'avoir, dans la transaction du numéro.
    if (creditNote.isDemo) return;
    const pdf = await input.renderOriginal(toCreditNoteView(creditNote, invoice.number), invoice.vatRegime !== "franchise");
    await storeOriginal(tx, { organizationId: input.organizationId, kind: "credit_note", documentId: creditNote.id, pdf });
  });
  if (!row) throw new InvoiceNotFoundError();
  return getCreditNote(input.organizationId, row.id);
}

// Lot 23b (DOC-08, ADR 0061) — l'original d'une facture : rendu depuis la copie
// figée et déposé tel quel, dans la transaction qui attribue son numéro. Si le
// stockage ne répond pas, la facture n'est pas émise et le numéro n'est pas
// consommé. Pas d'original pour une facture d'essai (rendue à la demande).
function keepInvoiceOriginal(organizationId: string, render: RenderInvoiceOriginal) {
  return async (tx: Parameters<NonNullable<Parameters<typeof insertInvoice>[3]>>[0], invoice: InvoiceRow, context: InvoicingContext) => {
    if (invoice.isDemo) return;
    const pdf = await render(toInvoiceView(invoice, context.quote.number, []));
    await storeOriginal(tx, { organizationId, kind: "invoice", documentId: invoice.id, pdf });
  };
}

export class OriginalAlteredError extends Error {
  constructor() {
    super("l'original conservé ne correspond plus à son empreinte d'émission");
    this.name = "OriginalAlteredError";
  }
}

// Lot 23b (DOC-08) — le PDF d'une pièce émise : l'original conservé, servi
// seulement si son empreinte est celle de l'émission ; sinon rien n'est
// reconstruit à sa place et l'anomalie va au journal. Une pièce émise avant
// le lot 23b reçoit son original à sa première ouverture, marqué « reconstitué »
// (décision D6). Une pièce d'essai se rend à la demande.
async function originalPdf(
  organizationId: string,
  kind: OriginalKind,
  document: { id: string; number: string; isDemo: boolean },
  render: () => Promise<Uint8Array>,
): Promise<{ pdf: Buffer; reconstructed: boolean }> {
  if (document.isDemo) return { pdf: Buffer.from(await render()), reconstructed: false };
  const original =
    (await findOriginal(organizationId, kind, document.id)) ??
    (await storeReconstructedOriginal(organizationId, kind, document.id, await render()));
  const pdf = await readOriginalBytes(original);
  if (sha256Hex(pdf) !== original.sha256) {
    await withDb((db) =>
      recordAudit(db, {
        organizationId,
        action: "quotes.original.altered",
        objectType: kind,
        objectId: document.id,
        details: { number: document.number },
      }),
    );
    throw new OriginalAlteredError();
  }
  return { pdf, reconstructed: original.isReconstructed };
}

export async function getInvoicePdf(
  organizationId: string,
  invoiceId: string,
  render: RenderInvoiceOriginal,
): Promise<{ pdf: Buffer; number: string; reconstructed: boolean }> {
  const invoice = await getInvoice(organizationId, invoiceId);
  const found = await originalPdf(organizationId, "invoice", invoice, () => render(invoice));
  return { ...found, number: invoice.number };
}

export async function getCreditNotePdf(
  organizationId: string,
  creditNoteId: string,
  render: RenderCreditNoteOriginal,
): Promise<{ pdf: Buffer; number: string; reconstructed: boolean }> {
  const creditNote = await getCreditNote(organizationId, creditNoteId);
  const invoice = await getInvoice(organizationId, creditNote.invoiceId);
  const found = await originalPdf(organizationId, "credit_note", creditNote, () => render(creditNote, invoice.vatApplicable));
  return { ...found, number: creditNote.number };
}

// Lot 23b (FAC-14, ADR 0061) — vérification de la chaîne d'empreintes de
// l'organisation : rang, maillons, et chaque écriture comparée à sa pièce.
export type LedgerVerification = { ok: boolean; entries: number; lastHash: string | null; anomalies: LedgerAnomaly[] };

export async function verifyLedger(organizationId: string): Promise<LedgerVerification> {
  const result = await verifyLedgerRows(organizationId);
  return { ok: result.anomalies.length === 0, ...result };
}

// Lot 23b (JUR-06) — archive comptable : années, et écritures d'une année.
export async function listLedgerYears(organizationId: string): Promise<number[]> {
  return ledgerYears(organizationId);
}

export type LedgerArchiveEntry = {
  sequence: number;
  objectId: string;
  recordedAt: Date;
  kind: LedgerArchiveRow["entryKind"];
  number: string | null;
  quoteNumber: string | null;
  amountCents: number | null;
  paymentMethodLabel: string | null;
  isBackfill: boolean;
  hash: string;
  previousHash: string;
};

export async function listLedgerEntries(organizationId: string, year: number): Promise<LedgerArchiveEntry[]> {
  return (await ledgerEntriesOfYear(organizationId, year)).map((row) => {
    const payload = row.payload as Record<string, unknown>;
    return {
      sequence: Number(row.sequence),
      objectId: row.objectId,
      recordedAt: row.recordedAt,
      kind: row.entryKind,
      number: typeof payload.number === "string" ? payload.number : null,
      quoteNumber: row.quoteNumber,
      amountCents: typeof payload.amountCents === "number" ? payload.amountCents : null,
      paymentMethodLabel: typeof payload.paymentMethodLabel === "string" ? payload.paymentMethodLabel : null,
      isBackfill: row.isBackfill,
      hash: row.hash,
      previousHash: row.previousHash,
    };
  });
}

export async function listQuoteInvoices(organizationId: string, quoteId: string): Promise<InvoiceView[]> {
  const found = await findQuoteInvoices(organizationId, quoteId);
  if (!found) throw new QuoteNotFoundError();
  return found.invoices.map((invoice) => toInvoiceView(invoice, found.quote.number, found.creditNotes));
}

export async function getInvoice(organizationId: string, invoiceId: string): Promise<InvoiceView> {
  const found = await findInvoiceById(organizationId, invoiceId);
  if (!found) throw new InvoiceNotFoundError();
  return toInvoiceView(found.invoice, found.quote.number, found.creditNotes);
}

export async function getCreditNote(organizationId: string, creditNoteId: string): Promise<CreditNoteView> {
  const found = await findCreditNoteById(organizationId, creditNoteId);
  if (!found) throw new InvoiceNotFoundError();
  return toCreditNoteView(found.creditNote, found.invoice.number);
}

// DEV-04 — e-reporting (clients particuliers) : factures et avoirs émis,
// encaissements reçus sur la période ; jamais de donnée d'essai.
export async function getEReporting(organizationId: string, period: { from: string; to: string }): Promise<EReportingView> {
  const from = requireDate(period.from, "début de période");
  const to = requireDate(period.to, "fin de période");
  if (from > to) throw new RangeError("période inversée");
  const rows = await findEReportingRows(organizationId, from, to);
  const invoiceRows = rows.invoices.map((invoice) => {
    const totals = (invoice.totalsSnapshot as InvoiceTotalsSnapshot).totals;
    return {
      number: invoice.number,
      issuedOn: invoice.issuedOn,
      kind: invoice.kind,
      totalHtCents: totals.totalHtCents,
      totalVatCents: totals.totalVatCents,
      totalTtcCents: totals.totalTtcCents,
    };
  });
  const noteRows = rows.creditNotes.map((note) => {
    const totals = note.totalsSnapshot as InvoiceTotalsView;
    return {
      number: note.number,
      invoiceNumber: note.invoiceNumber,
      issuedOn: note.issuedOn,
      totalHtCents: totals.totalHtCents,
      totalVatCents: totals.totalVatCents,
      totalTtcCents: totals.totalTtcCents,
    };
  });
  const payments = rows.payments.map((row) => {
    const totalTtcCents = (row.version.totalsSnapshot as QuoteTotalsView | null)?.totalTtcCents ?? 0;
    const index = row.versionItems.findIndex((item) => item.id === row.item.id);
    return {
      paidOn: row.item.paidOn!,
      amountCents: resolveSchedule(row.versionItems, totalTtcCents).amounts[index] ?? 0,
      paymentMethod: row.method,
      quoteNumber: row.quote.number,
      label: row.item.label,
    };
  });
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const invoicedTtcCents = sum(invoiceRows.map((row) => row.totalTtcCents));
  const creditedTtcCents = sum(noteRows.map((row) => row.totalTtcCents));
  return {
    from,
    to,
    invoices: invoiceRows,
    creditNotes: noteRows,
    payments,
    totals: {
      invoicedTtcCents,
      creditedTtcCents,
      netHtCents: sum(invoiceRows.map((row) => row.totalHtCents)) - sum(noteRows.map((row) => row.totalHtCents)),
      netVatCents: sum(invoiceRows.map((row) => row.totalVatCents)) - sum(noteRows.map((row) => row.totalVatCents)),
      netTtcCents: invoicedTtcCents - creditedTtcCents,
      collectedCents: sum(payments.map((payment) => payment.amountCents)),
    },
  };
}

// --- AIDE-02 : essai guidé du module Devis ---

// Devis fictif (série DEMO) sur l'événement d'essai, depuis le modèle de
// départ traduisible : lignes et échéancier relatif au jour de l'essai.
// Jamais sur un vrai événement.
export async function startQuotesTrial(input: StartQuotesTrialInput): Promise<QuoteDetail> {
  const now = input.now ?? new Date();
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event?.isDemo) throw new EventNotFoundError();
  const template = starterDemoQuote(input.locale);
  const quote = await createQuote({ organizationId: input.organizationId, eventId: input.eventId, createdByUserId: input.createdByUserId, now });
  for (const line of template.lines) await addQuoteLine(input.organizationId, quote.id, line);
  const today = parisToday(now);
  for (const item of template.schedule) {
    await addScheduleItem(input.organizationId, quote.id, {
      label: item.label,
      dueDate: addCalendarDays(today, item.dueOffsetDays),
      percentageBasisPoints: item.percentageBasisPoints,
    });
  }
  return loadDetail(input.organizationId, quote.id);
}

// IMP-05 — fonctions d'import (lot 5, ADR 0022).
export {
  findModifiedImportedQuotesElements,
  importCatalogItemRows,
  importPaymentMethodRows,
  undoImportedQuotesElements,
} from "./import";

// --- Lot 31b : contrats (FAC-04, FAC-05, DOC-02, DOC-03, JUR-07, JUR-08, HUB-21 ; décisions D6,
// D7, D9, D11 à D17, révisées après les réponses de l'avocat du 13/11/2026) ---

export class ContractTemplateNotFoundError extends Error {
  constructor() {
    super("modèle de contrat introuvable");
    this.name = "ContractTemplateNotFoundError";
  }
}

export class ContractNotFoundError extends Error {
  constructor() {
    super("contrat introuvable");
    this.name = "ContractNotFoundError";
  }
}

// FAC-04 : « Aucune variable non remplie ne part au client » ; le refus nomme chaque problème.
export class ContractNotGeneratableError extends Error {
  constructor(readonly problems: ContractProblem[]) {
    super("contrat impossible à générer");
    this.name = "ContractNotGeneratableError";
  }
}

// Le devis a changé depuis la génération (autre version, options choisies ensuite).
export class ContractOutdatedError extends Error {
  constructor() {
    super("contrat à générer de nouveau");
    this.name = "ContractOutdatedError";
  }
}

export class ContractSigningInProgressError extends Error {
  constructor() {
    super("un contrat de ce devis est en cours de signature");
    this.name = "ContractSigningInProgressError";
  }
}

// D13 : à distance, chaque signataire commande sur son espace personnel avant de signer ; sans
// lien personnel actif (client, rubrique devis), il ne le pourrait pas.
export class SignersWithoutPortalError extends Error {
  constructor(readonly names: string[]) {
    super("signataires sans lien personnel");
    this.name = "SignersWithoutPortalError";
  }
}

// Commande ou demande d'exécution anticipée impossible : régime, signataire ou demande close.
export class ContractActNotAllowedError extends Error {
  constructor() {
    super("acte du signataire impossible");
    this.name = "ContractActNotAllowedError";
  }
}

const CHANNELS: readonly ConclusionChannel[] = ["on_premises", "distance", "off_premises", "fair"];
const CLAUSE_ROLES: readonly ContractClauseRole[] = [
  "precontractual_information",
  "withdrawal_period",
  "withdrawal_form",
  "early_execution",
  "termination",
  "no_withdrawal",
  "advance_deposit",
  "advance_earnest",
];
const REVIEW_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function contractWords(locale: "fr" | "en") {
  return (locale === "en" ? enMessages : frMessages).Contracts.values;
}

// Lot 31c (D19) : mêmes mots que les PDF (section « Documents »).
function soleTraderWords(locale: "fr" | "en") {
  const documents = (locale === "en" ? enMessages : frMessages).Documents as Record<string, string>;
  const forms = ["ei", "eirl", "eurl", "sarl", "sas", "sasu", "sa", "auto_entrepreneur", "autre"] as const;
  return {
    soleTrader: documents.pdfSoleTrader!,
    legalForms: Object.fromEntries(forms.map((form) => [form, documents[`pdfLegalForm_${form}`]!])) as Record<(typeof forms)[number], string>,
  };
}

function boundedText(value: string, max: number, field: string): string {
  const text = requireText(value, field);
  if (text.length > max) throw new RangeError(`${field} trop long`);
  return text;
}

function templateHeader(input: ContractTemplateHeaderInput): ContractTemplateHeaderInput {
  const legalReviewedOn = input.legalReviewedOn?.trim() || null;
  if (legalReviewedOn && (!REVIEW_DATE_PATTERN.test(legalReviewedOn) || Number.isNaN(Date.parse(legalReviewedOn)))) throw new RangeError("date de revue invalide");
  return { name: boundedText(input.name, 120, "nom du modèle"), title: boundedText(input.title, 200, "titre du contrat"), eventTypeId: input.eventTypeId || null, legalReviewedOn };
}

function clauseData(input: ContractTemplateClauseInput): ClauseData {
  if (input.body.length > 20000) throw new RangeError("clause trop longue");
  if (input.role !== null && !CLAUSE_ROLES.includes(input.role)) throw new RangeError("rôle de clause inconnu");
  return { title: boundedText(input.title, 200, "titre de la clause"), body: input.body.trim(), optional: input.optional, role: input.role };
}

function toContractTemplateView({ template, clauses }: ContractTemplateWithClauses): ContractTemplateView {
  return {
    id: template.id,
    name: template.name,
    title: template.title,
    eventTypeId: template.eventTypeId,
    legalReviewedOn: template.legalReviewedOn,
    version: template.version,
    clauses: clauses.map((clause) => ({ id: clause.id, title: clause.title, body: clause.body, optional: clause.optional, role: clause.role, position: clause.position })),
  };
}

export async function listContractTemplates(organizationId: string): Promise<ContractTemplateView[]> {
  return (await findContractTemplates(organizationId)).map(toContractTemplateView);
}

export async function getContractTemplate(organizationId: string, templateId: string): Promise<ContractTemplateView> {
  const found = await findContractTemplate(organizationId, templateId);
  if (!found) throw new ContractTemplateNotFoundError();
  return toContractTemplateView(found);
}

export async function createContractTemplate(input: ContractTemplateHeaderInput & { organizationId: string }): Promise<ContractTemplateView> {
  const template = await insertContractTemplate(input.organizationId, templateHeader(input), []);
  return getContractTemplate(input.organizationId, template.id);
}

export async function updateContractTemplate(input: ContractTemplateHeaderInput & { organizationId: string; templateId: string }): Promise<ContractTemplateView> {
  if (!(await updateContractTemplateHeader(input.organizationId, input.templateId, templateHeader(input)))) throw new ContractTemplateNotFoundError();
  return getContractTemplate(input.organizationId, input.templateId);
}

export async function duplicateContractTemplate(input: { organizationId: string; templateId: string; name: string }): Promise<ContractTemplateView> {
  const source = await getContractTemplate(input.organizationId, input.templateId);
  const header = templateHeader({ name: input.name, title: source.title, eventTypeId: source.eventTypeId, legalReviewedOn: source.legalReviewedOn });
  const copy = await insertContractTemplate(
    input.organizationId,
    header,
    source.clauses.map(({ title, body, optional, role }) => ({ title, body, optional, role })),
  );
  return getContractTemplate(input.organizationId, copy.id);
}

export async function removeContractTemplate(organizationId: string, templateId: string): Promise<void> {
  if (!(await deleteContractTemplateRow(organizationId, templateId))) throw new ContractTemplateNotFoundError();
}

export async function addContractClause(organizationId: string, templateId: string, clause: ContractTemplateClauseInput): Promise<ContractTemplateView> {
  if (!(await insertContractClause(organizationId, templateId, clauseData(clause)))) throw new ContractTemplateNotFoundError();
  return getContractTemplate(organizationId, templateId);
}

export async function updateContractClause(organizationId: string, clauseId: string, clause: ContractTemplateClauseInput): Promise<ContractTemplateView> {
  const templateId = await updateContractClauseRow(organizationId, clauseId, clauseData(clause));
  if (!templateId) throw new ContractTemplateNotFoundError();
  return getContractTemplate(organizationId, templateId);
}

export async function removeContractClause(organizationId: string, clauseId: string): Promise<ContractTemplateView> {
  const templateId = await deleteContractClauseRow(organizationId, clauseId);
  if (!templateId) throw new ContractTemplateNotFoundError();
  return getContractTemplate(organizationId, templateId);
}

export async function moveContractClause(organizationId: string, clauseId: string, direction: "up" | "down"): Promise<ContractTemplateView> {
  const templateId = await moveContractClauseRow(organizationId, clauseId, direction);
  if (!templateId) throw new ContractTemplateNotFoundError();
  return getContractTemplate(organizationId, templateId);
}

// HUB-26, JUR-20 (D10) : modèle de départ « à adapter », en données, rattaché au type d'événement.
export async function addStarterContractTemplates(organizationId: string, locale: "fr" | "en", chosenMetier?: "wedding_planner" | "event_agency" | "autre"): Promise<ContractTemplateView[]> {
  const profile = await withDb((db) => getOrganizationProfile(db, organizationId));
  const metier = chosenMetier ?? profile.metier ?? "wedding_planner";
  const starters = starterContractTemplates(locale, metier);
  if (starters.length === 0) return [];
  const types = await listEventTypes(organizationId);
  const starterTypes = starterEventTypes(locale, metier);
  const created: ContractTemplateView[] = [];
  for (const starter of starters) {
    const label = starterTypes.find((type) => type.key === starter.eventTypeKey)?.label;
    const eventTypeId = label ? (types.find((type) => type.label.toLocaleLowerCase(locale) === label.toLocaleLowerCase(locale))?.id ?? null) : null;
    const template = await insertContractTemplate(organizationId, { name: starter.name, title: starter.title, eventTypeId, legalReviewedOn: null }, starter.clauses);
    created.push(await getContractTemplate(organizationId, template.id));
  }
  return created;
}

// Valeurs des variables pour un devis envoyé : sa copie figée du vendeur et de l'échéancier.
async function contractVariableValues(organizationId: string, quote: QuoteDetail, locale: "fr" | "en", now: Date): Promise<ContractVariableValues> {
  const words = contractWords(locale);
  const rules = starterContractRules();
  const event = await getEvent(organizationId, quote.eventId);
  const seller = quote.current.seller ?? (await currentQuoteSeller(organizationId));
  const join = (parts: (string | null | undefined)[]) => parts.filter((part): part is string => Boolean(part && part.trim())).join(", ") || null;
  const names = (event?.clients ?? []).map((client) => [client.firstName, client.lastName].filter(Boolean).join(" ")).filter(Boolean);
  const schedule = quote.current.schedule.items
    .map((item) => words.scheduleLine.replace("{label}", item.label).replace("{amount}", formatAmount(item.amountCents, locale)).replace("{date}", formatCalendarDate(item.dueDate, locale)))
    .join("\n");
  return {
    "client.noms": names.length > 0 ? names.join(words.namesJoin) : null,
    "evenement.date": event?.eventDate ? formatCalendarDate(event.eventDate, locale) : null,
    "evenement.lieu": join([event?.venueName, event?.venueCity]),
    "devis.numero": quote.number,
    "devis.total_ttc": formatAmount(quote.current.totals.totalTtcCents, locale),
    "devis.echeancier": schedule || null,
    "devis.acompte_ou_arrhes": quote.current.advanceKind ? words[quote.current.advanceKind] : null,
    // Lot 31c (D19) : « EI » après le nom d'un entrepreneur individuel, comme sur les devis et factures.
    "organisation.nom": seller.organizationName ? sellerDisplayName(seller, soleTraderWords(locale)) : null,
    "organisation.adresse": seller.address,
    "organisation.siren": seller.siren,
    "organisation.assurance": join([seller.insurer, seller.insurancePolicy, seller.insuranceCoverage]),
    "organisation.mediateur": join([seller.mediatorName, seller.mediatorUrl]),
    "contrat.date": formatCalendarDate(parisDate(now), locale),
    "retractation.delai": words.days.replace("{days}", String(rules.withdrawal.periodDays)),
  };
}

// Régime d'un contrat généré : la rétractation figée à la génération ; commande et délai sans
// paiement suivent les règles.
function regimeOf(contract: ContractRow) {
  const regime = contractRegime({ channel: contract.conclusionChannel, category: contract.clientCategory, smallBusinessConfirmed: contract.smallBusinessConfirmed }, starterContractRules());
  return {
    withdrawalApplies: contract.withdrawalApplies,
    orderRequired: contract.withdrawalApplies && regime.orderRequired,
    noPaymentDays: contract.withdrawalApplies ? regime.noPaymentDays : null,
    requiredRoles: regime.requiredRoles,
  };
}

function recommendedSignatureLevel(totalTtcCents: number): "simple" | "advanced" {
  return totalTtcCents >= starterContractRules().signature.advancedThresholdCents ? "advanced" : "simple";
}

// Contrôle avant la génération (FAC-04, DOC-02 ; D11, D12, D21) : tout ce qui l'empêche, nommé.
export async function checkContract(input: ContractCheckInput): Promise<ContractCheck> {
  if (!CHANNELS.includes(input.channel)) throw new RangeError("canal de conclusion inconnu");
  const rules = starterContractRules();
  const now = input.now ?? new Date();
  const quote = await loadDetail(input.organizationId, input.quoteId);
  const found = await findContractTemplate(input.organizationId, input.templateId);
  if (!found) throw new ContractTemplateNotFoundError();
  const chosen = new Set(input.optionalClauseIds);
  const selected = found.clauses.filter((clause) => !clause.optional || chosen.has(clause.id));
  const values = await contractVariableValues(input.organizationId, quote, input.locale, now);
  const text = resolveContractText(
    [{ title: found.template.title, body: "", role: null }, ...selected.map((clause): ContractClauseText => ({ title: clause.title, body: clause.body, role: clause.role }))],
    values,
    rules.placeholderMarkers,
  );
  const [titleText, ...clauses] = text.clauses;
  const regime = contractRegime({ channel: input.channel, category: quote.clientKind, smallBusinessConfirmed: input.smallBusinessConfirmed }, rules);
  const roles = selected.map((clause) => clause.role);
  const problems: ContractProblem[] = [];
  if (quote.current.sentAt === null) problems.push({ kind: "quote_not_sent" });
  if (regime.blocked) problems.push({ kind: "channel_blocked" });
  for (const variable of text.missing) problems.push({ kind: "variable_missing", variable });
  for (const variable of text.unknown) problems.push({ kind: "variable_unknown", variable });
  for (const clause of text.unwritten) problems.push({ kind: "clause_unwritten", clause });
  if (!regime.blocked) for (const role of missingRoles(regime.requiredRoles, roles)) problems.push({ kind: "role_missing", role });
  const advance = advanceClauseProblem(quote.current.advanceKind, quote.current.schedule.items.length > 0, roles, rules);
  if (advance === "missing" && quote.current.advanceKind) problems.push({ kind: "advance_missing", advanceKind: quote.current.advanceKind });
  if (advance === "mismatch") problems.push({ kind: "advance_mismatch", advanceKind: quote.current.advanceKind });
  if (regime.noPaymentDays !== null) {
    const firstAllowed = addCalendarDays(parisDate(now), regime.noPaymentDays);
    if (quote.current.schedule.items.some((item) => !item.paidOn && item.dueDate < firstAllowed)) problems.push({ kind: "payment_too_soon", firstAllowed });
  }
  return {
    templateVersion: found.template.version,
    templateReviewedOn: found.template.legalReviewedOn,
    title: titleText?.title ?? found.template.title,
    clauses,
    regime: { withdrawalApplies: regime.withdrawalApplies, orderRequired: regime.orderRequired, noPaymentDays: regime.noPaymentDays, requiredRoles: regime.requiredRoles },
    problems,
    warningAccepted: await hasAcceptedTemplate(input.organizationId, found.template.id, found.template.version, input.userId),
    signature: { recommended: recommendedSignatureLevel(quote.current.totals.totalTtcCents), available: rules.signature.availableLevel },
  };
}

// FAC-04 (D7) : contrat figé, nouvelle version à chaque génération ; l'avertissement « base à
// adapter » est accepté à la première génération avec chaque version du modèle (réponse 6).
export async function generateContract(input: GenerateContractInput): Promise<ContractView> {
  const now = input.now ?? new Date();
  const check = await checkContract({ ...input, now });
  const problems = [...check.problems];
  if (!check.warningAccepted && !input.acceptWarning) problems.push({ kind: "warning_not_accepted" });
  if (problems.length > 0) throw new ContractNotGeneratableError(problems);
  const quote = await loadDetail(input.organizationId, input.quoteId);
  if (!check.warningAccepted) await insertTemplateAcceptance(input.organizationId, { templateId: input.templateId, templateVersion: check.templateVersion, userId: input.userId, acceptedAt: now });
  const result = await insertContract(input.organizationId, {
    quoteId: input.quoteId,
    quoteVersionId: quote.current.id,
    templateId: input.templateId,
    templateVersion: check.templateVersion,
    templateReviewedOn: check.templateReviewedOn,
    title: check.title,
    clauses: check.clauses,
    conclusionChannel: input.channel,
    clientCategory: quote.clientKind,
    smallBusinessConfirmed: input.smallBusinessConfirmed && quote.clientKind !== "individual",
    withdrawalApplies: check.regime.withdrawalApplies,
    signatureLevel: starterContractRules().signature.availableLevel,
    generatedAt: now,
    isDemo: quote.isDemo,
    quoteNumber: quote.number,
  });
  if (result.status !== "ok") throw result.status === "signing" ? new ContractSigningInProgressError() : new QuoteNotFoundError();
  const contractId = result.row.id;
  const view = (await listQuoteContracts(input.organizationId, input.quoteId)).find((contract) => contract.id === contractId);
  if (!view) throw new ContractNotFoundError();
  return view;
}

export async function listQuoteContracts(organizationId: string, quoteId: string): Promise<ContractView[]> {
  const quote = await loadDetail(organizationId, quoteId);
  const { contracts, acts, evidence } = await findQuoteContracts(organizationId, quoteId);
  const requests = await findContractRequests(organizationId, contracts.map((contract) => contract.id));
  const versions = new Map(quote.versions.map((version) => [version.id, version.version]));
  const chosenAt = quote.current.optionsChoice ? new Date(quote.current.optionsChoice.chosenAt) : null;
  return contracts.map((contract) => {
    const request = requests.filter((candidate) => candidate.contractId === contract.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const outdated = contract.quoteVersionId !== quote.current.id || (!request && chosenAt !== null && chosenAt > contract.generatedAt);
    return {
      id: contract.id,
      quoteId,
      quoteVersion: versions.get(contract.quoteVersionId) ?? 0,
      version: contract.version,
      templateId: contract.templateId,
      templateVersion: contract.templateVersion,
      templateReviewedOn: contract.templateReviewedOn,
      title: contract.title,
      clauses: contract.clauses,
      conclusionChannel: contract.conclusionChannel,
      clientCategory: contract.clientCategory,
      smallBusinessConfirmed: contract.smallBusinessConfirmed,
      regime: regimeOf(contract),
      signatureLevel: contract.signatureLevel,
      recommendedSignatureLevel: recommendedSignatureLevel(quote.current.totals.totalTtcCents),
      generatedAt: contract.generatedAt.toISOString(),
      outdated,
      signature: request ? { kind: request.kind, status: request.status, hasSignedDocument: request.signedDocumentKey !== null } : null,
      acts: acts
        .filter((act) => act.contractId === contract.id)
        .map((act) => ({ signerId: act.signerId, signerName: act.signerName, kind: act.kind, actedAt: act.actedAt.toISOString() })),
      hasEvidence: evidence.some((row) => row.contractId === contract.id),
    };
  });
}

// Le contrat d'un devis, lu par le client sur son portail : seulement un contrat envoyé en
// signature, et seulement pour l'événement de son lien.
export async function getClientContract(organizationId: string, eventId: string, contractId: string): Promise<{ quote: QuoteDetail; contract: ContractView }> {
  const found = await findContract(organizationId, contractId);
  if (!found) throw new ContractNotFoundError();
  const quote = await loadDetail(organizationId, found.contract.quoteId).catch(() => null);
  if (!quote || quote.eventId !== eventId) throw new ContractNotFoundError();
  const contract = (await listQuoteContracts(organizationId, quote.id)).find((candidate) => candidate.id === contractId);
  if (!contract?.signature) throw new ContractNotFoundError();
  return { quote, contract };
}

function contractSigningMail(input: { locale: "fr" | "en"; organizationName: string; number: string; url: string }) {
  if (input.locale === "en") {
    return {
      subject: `Contract for quote ${input.number} to sign — ${input.organizationName}`,
      text: `Hello,\n\n${input.organizationName} sends you the contract for quote ${input.number} to sign online. Your personal signing link:\n${input.url}\n\nThis link is personal: please do not forward it.\n\nThe Symbola team`,
    };
  }
  return {
    subject: `Contrat du devis ${input.number} à signer — ${input.organizationName}`,
    text: `Bonjour,\n\n${input.organizationName} vous envoie le contrat du devis ${input.number} à signer en ligne. Votre lien personnel de signature :\n${input.url}\n\nCe lien vous est personnel : merci de ne pas le transférer.\n\nL'équipe Symbola`,
  };
}

// D13 (réponse 1 de l'avocat) — contrat à distance : le lien de signature ne part pas par e-mail ;
// il s'affiche sur l'espace personnel du signataire après sa commande. Chacun doit donc en avoir un.
async function requirePortalLinks(organizationId: string, eventId: string, people: { name: string; email: string }[]): Promise<void> {
  const links = (await listEventLinks(organizationId, eventId)).filter((link) => link.audience === "client" && link.status === "active" && link.rights.rubrics.includes("quotes"));
  const emails = new Set(links.map((link) => link.email.trim().toLowerCase()));
  const missing = people.filter((person) => !emails.has(person.email.trim().toLowerCase())).map((person) => person.name);
  if (missing.length > 0) throw new SignersWithoutPortalError(missing);
}

function orderFirstMail(input: { locale: "fr" | "en"; organizationName: string; number: string }) {
  if (input.locale === "en") {
    return {
      subject: `Quote ${input.number} and its contract — ${input.organizationName}`,
      text: `Hello,\n\n${input.organizationName} sends you quote ${input.number} and its contract. Open your personal space (the link ${input.organizationName} gave you) to read the contract, place your order, then sign.\n\nThe Symbola team`,
    };
  }
  return {
    subject: `Devis ${input.number} et son contrat — ${input.organizationName}`,
    text: `Bonjour,\n\n${input.organizationName} vous envoie le devis ${input.number} et son contrat. Ouvrez votre espace personnel (le lien que ${input.organizationName} vous a remis) pour lire le contrat, passer commande, puis signer.\n\nL'équipe Symbola`,
  };
}

// DOC-03 (D9) : contrat généré après la signature du devis, signé seul par les mêmes signataires.
export async function sendContractForSignature(input: SendContractForSignatureInput): Promise<ContractView> {
  const quote = await loadDetail(input.organizationId, input.quoteId);
  if (quote.status !== "signed" || quote.signature?.status !== "completed") throw new QuoteNotSignedError();
  const contract = (await listQuoteContracts(input.organizationId, input.quoteId)).find((candidate) => candidate.id === input.contractId);
  if (!contract) throw new ContractNotFoundError();
  if (contract.signature) throw new SignatureAlreadyRequestedError();
  if (contract.outdated) throw new ContractOutdatedError();
  const provider = signatureProviderFor(quote.isDemo);
  if (!provider) throw new SignatureUnavailableError();
  const people = quote.signature.signers.map((signer) => ({ eventClientId: signer.eventClientId, name: signer.name, email: signer.email, billingAddress: signer.billingAddress }));
  if (contract.regime.orderRequired) await requirePortalLinks(input.organizationId, quote.eventId, people);
  const signerIds = people.map(() => randomUUID());
  const created = await provider.createRequest({
    title: `${quote.number} — ${contract.title} V${contract.version}`,
    pdf: Buffer.from(input.documentPdf),
    signers: people.map((signer, index) => ({ externalId: `${input.organizationId}.${signerIds[index]}`, name: signer.name, email: signer.email, role: signerRole(index) })),
  });
  const result = await insertSignatureRequest(input.organizationId, input.quoteId, {
    provider: provider.name,
    externalId: created.externalId,
    kind: "contract",
    contractId: contract.id,
    signers: people.map((signer, index) => {
      const externalId = `${input.organizationId}.${signerIds[index]}`;
      const link = created.signers.find((candidate) => candidate.externalId === externalId);
      if (!link) throw new Error("lien de signature manquant");
      return { id: signerIds[index]!, eventClientId: signer.eventClientId, name: signer.name, email: signer.email, billingAddress: signer.billingAddress, signingUrl: link.signingUrl, externalId, position: index };
    }),
  });
  if (result.status === "exists") throw new SignatureAlreadyRequestedError();
  if (result.status === "not_sent") throw new QuoteNotSignedError();
  if (result.status !== "ok") throw new ContractNotFoundError();
  if (!quote.isDemo) {
    const organizationName = quote.current.seller?.organizationName ?? "";
    const request = (await findContractRequests(input.organizationId, [contract.id])).find((candidate) => candidate.kind === "contract");
    const signers = request ? await findSignersOfRequest(input.organizationId, request.id) : [];
    let notMailed = 0;
    for (const signer of signers) {
      try {
        await reserveOrganizationMail(input.organizationId);
        const mail = contract.regime.orderRequired
          ? orderFirstMail({ locale: input.locale, organizationName, number: quote.number })
          : contractSigningMail({ locale: input.locale, organizationName, number: quote.number, url: signer.signingUrl });
        await sendMail({ to: signer.email, ...mail });
      } catch (error) {
        notMailed += 1;
        console.error(`e-mail de signature du contrat non envoyé (signataire ${signer.id})`, error instanceof Error ? error.message : error);
      }
    }
    if (notMailed > 0) throw new SignatureLinksNotMailedError(notMailed);
  }
  const view = (await listQuoteContracts(input.organizationId, input.quoteId)).find((candidate) => candidate.id === contract.id);
  if (!view) throw new ContractNotFoundError();
  return view;
}

// JUR-07 (réponse 1 de l'avocat, D13) — actes du signataire sur son portail, avant de signer :
// commande avec obligation de paiement (à distance) ; demande d'exécution avant la fin du délai
// (case distincte de la signature, texte de la clause du contrat). Horodatés et nominatifs.
export async function recordSignerAct(input: {
  organizationId: string;
  eventId: string;
  clientEmail: string;
  contractId: string;
  kind: "order" | "early_execution";
  orderText?: string;
  now?: Date;
}): Promise<void> {
  const found = await findContract(input.organizationId, input.contractId);
  if (!found) throw new ContractNotFoundError();
  const aggregate = await findQuoteAggregate(input.organizationId, found.contract.quoteId);
  if (!aggregate || aggregate.quote.eventId !== input.eventId) throw new ContractNotFoundError();
  const request = aggregate.signatureRequests.find((candidate) => candidate.contractId === found.contract.id && candidate.status === "pending");
  const email = input.clientEmail.trim().toLowerCase();
  const signer = request ? aggregate.signers.find((candidate) => candidate.requestId === request.id && candidate.email === email && candidate.status === "pending") : undefined;
  if (!request || !signer) throw new ContractActNotAllowedError();
  const regime = regimeOf(found.contract);
  let presentedText: string | null = null;
  if (input.kind === "order") {
    if (!regime.orderRequired) throw new ContractActNotAllowedError();
    presentedText = input.orderText?.trim() || null;
  } else {
    if (!regime.withdrawalApplies) throw new ContractActNotAllowedError();
    presentedText = found.contract.clauses.find((clause) => clause.role === "early_execution")?.body ?? null;
  }
  if (!presentedText) throw new ContractActNotAllowedError();
  await insertSignerAct(input.organizationId, {
    contractId: found.contract.id,
    signerId: signer.id,
    kind: input.kind,
    signerName: signer.name,
    presentedText,
    actedAt: input.now ?? new Date(),
    quoteId: aggregate.quote.id,
    quoteNumber: aggregate.quote.number,
    isDemo: aggregate.quote.isDemo,
  });
}

// Dossier de preuve de Symbola (réponses 1 et 5 de l'avocat) : faits figés en JSON, stockés en
// privé avec leur empreinte, au moment où tous ont signé.
async function writeContractEvidence(
  organizationId: string,
  quote: QuoteAggregate["quote"],
  request: SignatureRequestRow,
  contract: ContractRow,
  acts: ContractSignerActRow[],
  signers: QuoteSignerRow[],
  documents: { signedDocumentSha256: string; auditCertificateSha256: string },
  now: Date,
): Promise<void> {
  const aggregate = await findQuoteAggregate(organizationId, quote.id);
  const version = aggregate?.versions.find((candidate) => candidate.id === request.versionId);
  const signerIds = new Set(signers.map((signer) => signer.id));
  const document: ContractEvidenceDocument = {
    version: 1,
    writtenAt: now.toISOString(),
    quote: { number: quote.number, version: version?.version ?? 0 },
    contract: {
      id: contract.id,
      version: contract.version,
      title: contract.title,
      templateVersion: contract.templateVersion,
      templateReviewedOn: contract.templateReviewedOn,
      generatedAt: contract.generatedAt.toISOString(),
      conclusionChannel: contract.conclusionChannel,
      clientCategory: contract.clientCategory,
      smallBusinessConfirmed: contract.smallBusinessConfirmed,
      withdrawalApplies: contract.withdrawalApplies,
      signatureLevel: contract.signatureLevel,
    },
    request: { kind: request.kind, provider: request.provider, externalId: request.externalId, createdAt: request.createdAt.toISOString(), completedAt: (request.completedAt ?? now).toISOString() },
    signers: signers.map((signer) => ({ id: signer.id, name: signer.name, email: signer.email, status: signer.status, signedAt: signer.signedAt?.toISOString() ?? null })),
    acts: acts
      .filter((act) => signerIds.has(act.signerId))
      .map((act) => ({ signerId: act.signerId, signerName: act.signerName, kind: act.kind, actedAt: act.actedAt.toISOString(), presentedText: act.presentedText })),
    documents,
  };
  const body = Buffer.from(JSON.stringify(document, null, 2), "utf8");
  const key = `evidence/${organizationId}/${contract.id}/${request.id}.json`;
  await uploadPrivateObject(createStorageClient(), { key, body, contentType: "application/json" });
  await insertContractEvidence(organizationId, { requestId: request.id, contractId: contract.id, documentKey: key, sha256: sha256Hex(body) });
}

export async function getContractEvidence(organizationId: string, quoteId: string, contractId: string): Promise<ContractEvidenceDocument & { sha256: string }> {
  const found = await findContract(organizationId, contractId);
  if (!found || found.contract.quoteId !== quoteId) throw new ContractNotFoundError();
  const row = await findLatestEvidence(organizationId, contractId);
  if (!row) throw new SignatureDocumentNotFoundError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), row.documentKey);
    if (sha256Hex(data) !== row.sha256) {
      await withDb((db) =>
        recordAudit(db, { organizationId, action: "quotes.original.altered", objectType: "quote", objectId: quoteId, details: { file: "contract_evidence", contractId } }),
      );
      throw new OriginalAlteredError();
    }
    return { ...(JSON.parse(data.toString("utf8")) as ContractEvidenceDocument), sha256: row.sha256 };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new SignatureDocumentNotFoundError();
    throw error;
  }
}

// Exemplaire signé remis à chaque signataire (support durable, réponse 1 de l'avocat).
async function mailSignedContract(organizationId: string, quote: QuoteAggregate["quote"], signers: QuoteSignerRow[], signedPdf: Buffer): Promise<void> {
  if (quote.isDemo) return;
  const contact = await withDb((db) => getUserContact(db, organizationId, quote.createdByUserId));
  const seller = await currentQuoteSeller(organizationId);
  const english = contact?.language === "en";
  for (const signer of signers) {
    try {
      await reserveOrganizationMail(organizationId);
      await sendMail({
        to: signer.email,
        subject: english ? `Your signed copy — quote ${quote.number}` : `Votre exemplaire signé — devis ${quote.number}`,
        text: english
          ? `Hello,\n\nPlease find attached your signed copy of quote ${quote.number} and its contract with ${seller.organizationName}. Keep it: it is your confirmation of the contract.\n\nThe Symbola team`
          : `Bonjour,\n\nVous trouverez ci-joint votre exemplaire signé du devis ${quote.number} et de son contrat avec ${seller.organizationName}. Conservez-le : c'est la confirmation de votre contrat.\n\nL'équipe Symbola`,
        attachments: [{ filename: `${quote.number}-signe.pdf`, content: signedPdf, contentType: "application/pdf" }],
      });
    } catch (error) {
      console.error(`exemplaire signé non envoyé (signataire ${signer.id})`, error instanceof Error ? error.message : error);
    }
  }
}

// FAC-05 (D6, D21) — facture d'acompte de la première échéance, à émettre d'elle-même : le jour
// de la signature, ou le lendemain de la fin du délai de rétractation si tous les signataires
// n'ont pas demandé l'exécution anticipée. Pas pour des arrhes (D21), ni pour un client
// professionnel (Factur-X, lot 41). Hors établissement : aucun paiement avant sept jours.
async function scheduleDepositInvoice(
  organizationId: string,
  aggregate: QuoteAggregate,
  request: SignatureRequestRow,
  contract: { contract: ContractRow; acts: ContractSignerActRow[] } | null,
  now: Date,
): Promise<void> {
  const version = aggregate.versions.find((candidate) => candidate.id === request.versionId);
  if (!version || version.advanceKind !== "deposit" || aggregate.quote.clientKind === "professional") return;
  const first = aggregate.scheduleItems.filter((item) => item.versionId === version.id)[0];
  if (!first) return;
  const signedOn = parisDate(now);
  let issueOn = signedOn;
  let paymentNotBefore: string | null = null;
  if (contract) {
    const regime = regimeOf(contract.contract);
    const signerIds = new Set(aggregate.signers.filter((signer) => signer.requestId === request.id).map((signer) => signer.id));
    const early = new Set(contract.acts.filter((act) => act.kind === "early_execution" && signerIds.has(act.signerId)).map((act) => act.signerId));
    if (regime.withdrawalApplies && early.size < signerIds.size) issueOn = withdrawalPeriod(signedOn, starterContractRules().withdrawal).issueOn;
    if (regime.noPaymentDays !== null) paymentNotBefore = addCalendarDays(signedOn, regime.noPaymentDays);
  }
  await insertScheduledDeposit(organizationId, { quoteId: aggregate.quote.id, versionId: version.id, scheduleItemId: first.id, issueOn, paymentNotBefore });
}

async function creatorLocale(organizationId: string, userId: string): Promise<"fr" | "en"> {
  const contact = await withDb((db) => getUserContact(db, organizationId, userId));
  return contact?.language === "en" ? "en" : "fr";
}

// Traitement régulier (et worker d'événements à la signature) : émet les factures arrivées à
// leur date. Une mention manquante bloque l'émission, « À traiter » nomme le champ, et la
// planner l'émet ensuite en un clic.
export async function issueScheduledDepositInvoices(input: IssueScheduledDepositsInput): Promise<{ issued: number; blocked: number }> {
  const now = input.now ?? new Date();
  const due = await findDueScheduledDeposits(input.organizationId, parisDate(now), input.quoteId);
  let issued = 0;
  let blocked = 0;
  for (const entry of due) {
    const locale = await creatorLocale(input.organizationId, entry.createdByUserId);
    try {
      await issueDepositInvoice({
        organizationId: input.organizationId,
        scheduleItemId: entry.row.scheduleItemId,
        now,
        paymentNotBefore: entry.row.paymentNotBefore,
        renderOriginal: (invoice) => input.renderOriginal(invoice, locale),
      });
      issued += 1;
    } catch (error) {
      if (error instanceof InvoiceAlreadyIssuedError) {
        const existing = (await listQuoteInvoices(input.organizationId, entry.row.quoteId)).find(
          (invoice) => invoice.kind === "deposit" && invoice.scheduleItemId === entry.row.scheduleItemId && invoice.creditedCents < invoice.amountCents,
        );
        if (existing) {
          await updateScheduledDeposit(input.organizationId, entry.row.id, { status: "issued", missingFields: [], invoiceId: existing.id });
          continue;
        }
      }
      const fields = error instanceof RequiredMentionsMissingError ? error.fields : ["unavailable"];
      if (!(error instanceof RequiredMentionsMissingError)) {
        console.error(`facture d'acompte automatique non émise (devis ${entry.row.quoteId})`, error instanceof Error ? error.name : error);
      }
      await updateScheduledDeposit(input.organizationId, entry.row.id, { status: "blocked", missingFields: fields, invoiceId: null });
      blocked += 1;
    }
  }
  return { issued, blocked };
}

function toScheduledDepositView(entry: ScheduledDepositContext): ScheduledDepositView {
  return {
    quoteId: entry.row.quoteId,
    quoteNumber: entry.quoteNumber,
    eventId: entry.eventId,
    scheduleItemLabel: entry.label,
    status: entry.row.status,
    issueOn: entry.row.issueOn,
    paymentNotBefore: entry.row.paymentNotBefore,
    missingFields: entry.row.missingFields,
    invoiceId: entry.row.invoiceId,
  };
}

export async function listOpenScheduledDeposits(organizationId: string): Promise<ScheduledDepositView[]> {
  return (await findOpenScheduledDeposits(organizationId)).map(toScheduledDepositView);
}

export async function getQuoteScheduledDeposit(organizationId: string, quoteId: string): Promise<ScheduledDepositView | null> {
  const entry = await findQuoteScheduledDeposit(organizationId, quoteId);
  return entry ? toScheduledDepositView(entry) : null;
}

// Lot 31b (FAC-04, DOC-02) : la liste fixe des variables des contrats, documentée à l'écran.
export { CONTRACT_VARIABLES } from "./contract-text";

// Lot 6 — contrat privacy/v1 du module (ADR 0023).
export { quotesPrivacy } from "./privacy";

// Lot 9 (ADR 0029) — statistique d'usage pour l'Admin : devis créés et
// factures émises par mois, essais exclus.
export async function countQuotesAndInvoicesByMonth(
  organizationIds: string[],
  since: Date,
): Promise<Record<string, { quotes: MonthlyCount[]; invoices: MonthlyCount[] }>> {
  return countQuotesAndInvoicesByMonthRows(organizationIds, since);
}

// Lot 10 (AIDE-08) — recherche globale : devis et factures réels par numéro,
// ou rattachés aux événements trouvés.
export async function searchQuotes(organizationId: string, words: string[], eventIds: string[], limit: number): Promise<QuotesSearchResults> {
  return searchQuoteRows(organizationId, words, eventIds, limit);
}

const _contractCheck: QuotesServiceContract = {
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  archiveCatalogItem,
  getQuoteSettings,
  updateQuoteSettings,
  createQuote,
  listEventQuotes,
  listQuotes,
  listQuotesAwaitingAnswer,
  getQuote,
  addQuoteLine,
  updateQuoteLine,
  removeQuoteLine,
  setQuoteGlobalDiscount,
  sendQuote,
  reviseQuote,
  removeEventQuotesData,
  listPaymentMethods,
  addPaymentMethods,
  archivePaymentMethod,
  restorePaymentMethod,
  addScheduleItem,
  updateScheduleItem,
  removeScheduleItem,
  markScheduleItemPaid,
  markScheduleItemUnpaid,
  listUnpaidPayments,
  isSignatureAvailable,
  sendQuoteForSignature,
  handleSignatureWebhook,
  reconcilePendingSignatures,
  countQuotesAndInvoicesByMonth,
  searchQuotes,
  getSignatureDocument,
  listClientQuotesToSign,
  setQuoteClientKind,
  issueDepositInvoice,
  issueBalanceInvoice,
  issueCreditNote,
  listQuoteInvoices,
  getInvoice,
  getCreditNote,
  getEReporting,
  startQuotesTrial,
  addQuoteSection,
  renameQuoteSection,
  removeQuoteSection,
  setQuoteAdvanceKind,
  chooseQuoteOptions,
  listClientQuoteOptions,
  quoteMissingMentions,
  listQuoteTemplates,
  saveQuoteAsTemplate,
  replaceQuoteTemplateFromQuote,
  duplicateQuoteTemplate,
  renameQuoteTemplate,
  removeQuoteTemplate,
  createQuoteFromTemplate,
  addStarterQuoteTemplates,
  listContractTemplates,
  createContractTemplate,
  updateContractTemplate,
  duplicateContractTemplate,
  removeContractTemplate,
  addContractClause,
  updateContractClause,
  removeContractClause,
  moveContractClause,
  addStarterContractTemplates,
  checkContract,
  generateContract,
  listQuoteContracts,
  sendContractForSignature,
  recordSignerAct,
  getContractEvidence,
  issueScheduledDepositInvoices,
  listOpenScheduledDeposits,
  getQuoteScheduledDeposit,
  listQuoteReceipts,
  getReceipt,
  loadStarterPaymentTerms,
};
void _contractCheck;

// Lot 6 (RGPD-05) — données nécessaires aux règles de conservation.
export { lastPaymentDates, listExpiredDocuments, type ExpiredDocument } from "./privacy-retention";
