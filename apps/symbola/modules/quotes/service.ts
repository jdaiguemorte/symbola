// Porte d'entrée publique du module quotes — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/quotes si ce module est extrait en app autonome.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAppConnection } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { createStorageClient, deletePrivateObject, getSignedDownloadUrl, uploadFile } from "@symbola/files";
import { sendMail } from "@symbola/mail";
import type {
  CatalogItem,
  CatalogItemInput,
  CreateQuoteInput,
  GlobalDiscountInput,
  MarkScheduleItemPaidInput,
  PaymentMethod,
  PaymentScheduleView,
  QuoteDetail,
  QuoteLine,
  QuoteLineInput,
  QuoteSettings,
  QuoteSummary,
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
} from "@symbola/contracts";
import { QUOTES_QUOTE_SIGNED, QUOTES_QUOTE_SIGNED_VERSION, type QuoteSignedPayload } from "@symbola/contracts";
import { changeEventStatus, EventNotFoundError, getEvent } from "@/modules/events/service";
import {
  computeLegalMention,
  getDocumentHeader,
  getOrganizationProfile,
  getUserContact,
  type OrganizationProfile,
} from "@/modules/hub/service";
import { fakeSignatureProvider, realSignatureProvider, signatureProviderFor } from "./signature";
import { signatureTag, type SignatureProvider } from "./signature/provider";
import { computeQuoteTotals, formatDocumentNumber, lineAmounts, validUntil, type GlobalDiscount } from "./amounts";
import { addCalendarDays, groupByMonth, isOverdue, parisToday, resolveSchedule } from "./schedule";
import { addDays, prorateTotals } from "./invoicing";
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
  findEventSignatureContexts,
  findSignatureRequestByExternalId,
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
  setScheduleItemPayment,
  updateScheduleItemRow,
  type PaymentMethodRow,
  type PaymentResult,
  type ScheduleCheck,
  type ScheduleItemData,
  type ScheduleItemRow,
  deleteQuoteLine,
  findCatalogItem,
  findCatalogItems,
  findEventQuotes,
  findQuoteAggregate,
  findQuoteAggregates,
  findQuoteSettings,
  freezeCurrentVersion,
  insertCatalogItem,
  insertNextVersion,
  insertQuote,
  insertQuoteLine,
  setGlobalDiscountRow,
  updateCatalogItemRow,
  updateQuoteLineRow,
  upsertQuoteSettings,
  type CatalogItemData,
  type CatalogItemRow,
  type LineData,
  type QuoteAggregate,
  type QuoteLineRow,
  type QuoteVersionRow,
} from "./repository";

export type {
  CatalogItem,
  CatalogItemInput,
  CreateQuoteInput,
  GlobalDiscountInput,
  MarkScheduleItemPaidInput,
  PaymentMethod,
  PaymentScheduleView,
  QuoteDetail,
  QuoteLine,
  QuoteLineInput,
  QuoteSettings,
  QuoteStatus,
  QuoteSummary,
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
} from "@symbola/contracts";
export { EventNotFoundError };

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

// Fournisseur non configuré (production sans DocuSeal) : l'écran affiche
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

const DEFAULT_SETTINGS: QuoteSettings = {
  validityDays: 30,
  quotePrefix: "D",
  invoicePrefix: "F",
  creditNotePrefix: "A",
  upcomingHorizonDays: 90,
  invoicePaymentTermDays: 30,
  invoiceMentions: null,
};
const DEMO_PREFIX = "DEMO";
const MAX_AMOUNT_CENTS = 100_000_000_00; // 100 M€ : garde-fou contre les débordements d'entier
const MAX_QUANTITY_MILLI = 1_000_000_000;

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
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
  };
}

const PREFIX_PATTERN = /^[A-Z0-9]{1,8}$/;

export async function updateQuoteSettings(organizationId: string, settings: QuoteSettings): Promise<QuoteSettings> {
  requireInteger(settings.validityDays, 1, 365, "validité");
  requireInteger(settings.upcomingHorizonDays, 1, 730, "horizon");
  requireInteger(settings.invoicePaymentTermDays, 0, 120, "délai de paiement");
  const invoiceMentions = optionalText(settings.invoiceMentions);
  if (invoiceMentions && invoiceMentions.length > 2000) throw new RangeError("mentions trop longues");
  for (const prefix of [settings.quotePrefix, settings.invoicePrefix, settings.creditNotePrefix]) {
    // DEMO est réservé à la série d'essai (ADR 0008).
    if (!PREFIX_PATTERN.test(prefix) || prefix === DEMO_PREFIX) throw new RangeError("préfixe invalide");
  }
  const row = await upsertQuoteSettings(organizationId, { ...settings, invoiceMentions });
  return {
    validityDays: row.validityDays,
    quotePrefix: row.quotePrefix,
    invoicePrefix: row.invoicePrefix,
    creditNotePrefix: row.creditNotePrefix,
    upcomingHorizonDays: row.upcomingHorizonDays,
    invoicePaymentTermDays: row.invoicePaymentTermDays,
    invoiceMentions: row.invoiceMentions,
  };
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
  };
}

function totalsFor(lines: QuoteLineRow[], version: QuoteVersionRow, vatApplicable: boolean): QuoteTotalsView {
  return computeQuoteTotals(lines, toGlobalDiscount(version), vatApplicable);
}

function toScheduleView(
  items: ScheduleItemRow[],
  methods: PaymentMethodRow[],
  totalTtcCents: number,
  now: Date,
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
  aggregate: Pick<QuoteAggregate, "lines" | "scheduleItems" | "paymentMethods">,
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
    schedule: toScheduleView(ownItems, aggregate.paymentMethods, totals.totalTtcCents, now),
  };
}

function toSignatureView(request: SignatureRequestRow, signers: QuoteSignerRow[]): SignatureView {
  return {
    id: request.id,
    provider: request.provider,
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
  const request = aggregate.signatureRequests.find((candidate) => candidate.versionId === current.id);
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
  return loadDetail(input.organizationId, quote.id);
}

export async function listEventQuotes(organizationId: string, eventId: string): Promise<QuoteSummary[]> {
  const rows = await findEventQuotes(organizationId, eventId);
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

// DEV-01 — à l'envoi, la version courante fige régime de TVA, mention
// légale, en-tête vendeur, totaux et date de validité (ONB-02 : un document
// émis ne change jamais quand le profil change).
export async function sendQuote(input: SendQuoteInput): Promise<QuoteDetail> {
  const now = input.now ?? new Date();
  const { profile, header } = await withDb(async (db) => ({
    profile: await getOrganizationProfile(db, input.organizationId),
    header: await getDocumentHeader(db, input.organizationId),
  }));
  const settings = await getQuoteSettings(input.organizationId);
  const vatRegime = profile.vatRegime;
  const seller: SellerSnapshot = {
    organizationName: header?.organizationName ?? "",
    address: profile.address,
    siren: profile.siren,
    logoKey: profile.logoKey,
  };
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
// doublon avec les modes actifs.
export async function addPaymentMethods(organizationId: string, labels: string[]): Promise<PaymentMethod[]> {
  const existing = new Set((await findPaymentMethods(organizationId, false)).map((method) => method.label.toLocaleLowerCase("fr")));
  const fresh: string[] = [];
  for (const label of labels.map((value) => requireText(value, "mode de paiement"))) {
    const key = label.toLocaleLowerCase("fr");
    if (existing.has(key)) continue;
    existing.add(key);
    fresh.push(label);
  }
  if (fresh.length === 0) return [];
  return (await insertPaymentMethods(organizationId, fresh)).map(toPaymentMethod);
}

export async function archivePaymentMethod(organizationId: string, paymentMethodId: string): Promise<void> {
  await archivePaymentMethodRow(organizationId, paymentMethodId);
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
  const paidOn = requireDate(input.paidOn, "date de paiement");
  if (paidOn > parisToday(input.now ?? new Date())) throw new RangeError("date de paiement future");
  const quoteId = unwrap(
    await setScheduleItemPayment(input.organizationId, input.scheduleItemId, { paidOn, paymentMethodId: input.paymentMethodId }),
  );
  return loadDetail(input.organizationId, quoteId);
}

// Correction d'une saisie : l'échéance redevient à payer.
export async function markScheduleItemUnpaid(organizationId: string, scheduleItemId: string): Promise<QuoteDetail> {
  const quoteId = unwrap(await setScheduleItemPayment(organizationId, scheduleItemId, null));
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

const SIGNATURE_LINK_TTL_SECONDS = 10 * 60;
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
  return signatureRoles(count).map((role) => ({ role, tag: signatureTag(role) }));
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
    for (const signer of detail.signature?.signers ?? []) {
      const mail = signingMail({ locale: input.locale, organizationName, number: quote.number, url: signer.signingUrl });
      await sendMail({ to: signer.email, ...mail });
    }
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
  if (state.status === "completed") {
    const documents = await provider.downloadDocuments(request.externalId);
    const store = async (buffer: Buffer) => {
      const uploaded = await uploadFile({ organizationId, buffer, maxSizeBytes: SIGNED_DOCUMENT_MAX_BYTES });
      if (uploaded.status !== "uploaded" || uploaded.mime !== "application/pdf") throw new Error(`document signé refusé (${uploaded.status})`);
      return uploaded.key;
    };
    const signedDocumentKey = await store(documents.signedPdf);
    const auditCertificateKey = await store(documents.auditCertificatePdf);
    storedKeys = [signedDocumentKey, auditCertificateKey];
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
      completedAt: now,
      event: { name: QUOTES_QUOTE_SIGNED, version: QUOTES_QUOTE_SIGNED_VERSION, payload },
    };
  } else if (state.status === "declined") {
    outcome = { kind: "declined", completedAt: now };
  }

  const applied = await applySignatureStateRows(organizationId, request.id, { signers, outcome }, eventType);
  if (applied.status !== "ok") return "unknown_request";
  if (!applied.transitioned) {
    // Un appel concurrent a terminé la demande entre-temps : nos copies
    // des documents ne servent pas.
    const storage = storedKeys.length > 0 ? createStorageClient() : null;
    for (const key of storedKeys) await deletePrivateObject(storage!, key);
    return applied.changed ? "signer_updated" : outcome.kind === "pending" ? "unchanged" : "duplicate";
  }
  if (outcome.kind === "completed") await afterSigned(organizationId, context.quote.id);
  return outcome.kind;
}

// Effets qui suivent la signature, une seule fois (appel qui a terminé la
// demande) : événement Confirmé (EVT-02) et e-mail à la planner.
async function afterSigned(organizationId: string, quoteId: string): Promise<void> {
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

// Lien signé temporaire vers le document signé ou le certificat de preuve
// de la version courante.
export async function getSignatureDocumentUrl(organizationId: string, quoteId: string, kind: "signed" | "certificate"): Promise<string> {
  const aggregate = await findQuoteAggregate(organizationId, quoteId);
  if (!aggregate) throw new QuoteNotFoundError();
  const version = aggregate.versions.find((candidate) => candidate.version === aggregate.quote.currentVersion);
  const request = aggregate.signatureRequests.find((candidate) => candidate.versionId === version?.id);
  const key = kind === "signed" ? request?.signedDocumentKey : request?.auditCertificateKey;
  if (!key) throw new SignatureDocumentNotFoundError();
  return getSignedDownloadUrl(createStorageClient(), key, SIGNATURE_LINK_TTL_SECONDS);
}

// DEV-02 — espace du marié (accès à l'événement vérifié par l'appelant,
// EVT-06) : les devis à signer et le seul lien de ce marié, reconnu par
// l'e-mail de son compte.
export async function listClientQuotesToSign(organizationId: string, eventId: string, clientEmail: string): Promise<ClientQuoteToSign[]> {
  const email = clientEmail.trim().toLowerCase();
  const contexts = await findEventSignatureContexts(organizationId, eventId);
  return contexts
    .filter((context) => context.request.status !== "declined")
    .map((context) => {
      const own = context.signers.find((signer) => signer.email === email) ?? null;
      const totals = context.version.totalsSnapshot as QuoteTotalsView | null;
      return {
        quoteId: context.quote.id,
        number: context.quote.number,
        version: context.version.version,
        totalTtcCents: totals?.totalTtcCents ?? 0,
        status: context.request.status,
        ownSigningUrl: own && context.request.status === "pending" && own.status === "pending" ? own.signingUrl : null,
        ownStatus: own?.status ?? null,
      };
    });
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
  if (clientKind !== "individual" && clientKind !== "professional") throw new RangeError("type de client inconnu");
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

// Contrôles communs puis copies figées : vendeur et mention (figés à
// l'envoi du devis), acheteurs (signataires), réglages de facturation.
function invoiceBase(context: InvoicingContext, now: Date) {
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
      sellerSnapshot: context.version.sellerSnapshot ?? {},
      buyerSnapshot: buyers,
    },
  };
}

function frozenLines(context: InvoicingContext): FrozenLine[] {
  return context.lines.map((line) => ({
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
  deductions: { number: string; amountCents: number }[];
  depositLabel: string | null;
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
    quoteTotals: snapshot.quoteTotals,
    deductions: snapshot.deductions,
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
  const row = await insertInvoice(input.organizationId, { scheduleItemId: input.scheduleItemId }, (context) => {
    const base = invoiceBase(context, now);
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
        paymentDueOn: item.dueDate > base.issuedOn ? item.dueDate : base.issuedOn,
        amountCents,
        linesSnapshot: [],
        totalsSnapshot: snapshot,
      },
    };
  });
  if (!row) throw new QuoteNotFoundError();
  return getInvoice(input.organizationId, row.id);
}

// DEV-04 — facture de solde : lignes du devis, acomptes facturés déduits
// (nets de leurs avoirs), date de la prestation = date de l'événement.
export async function issueBalanceInvoice(input: IssueBalanceInvoiceInput): Promise<InvoiceView> {
  const now = input.now ?? new Date();
  const quote = await findQuoteAggregate(input.organizationId, input.quoteId);
  if (!quote) throw new QuoteNotFoundError();
  const event = await getEvent(input.organizationId, quote.quote.eventId);
  const row = await insertInvoice(input.organizationId, { quoteId: input.quoteId }, (context) => {
    const base = invoiceBase(context, now);
    const active = context.invoices.filter((invoice) => isActive(invoice, context.creditNotes));
    if (active.some((invoice) => invoice.kind === "balance")) throw new InvoiceAlreadyIssuedError();
    const deductions = active
      .filter((invoice) => invoice.kind === "deposit")
      .map((invoice) => ({ number: invoice.number, amountCents: invoice.amountCents - creditedOf(invoice.id, context.creditNotes) }));
    const amountCents = base.totals.totalTtcCents - deductions.reduce((sum, deduction) => sum + deduction.amountCents, 0);
    if (amountCents <= 0) throw new InvoiceAlreadyIssuedError();
    const snapshot: InvoiceTotalsSnapshot = {
      quoteTotals: base.totals,
      totals: prorateTotals(base.totals, amountCents),
      deductions,
      depositLabel: null,
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
  });
  if (!row) throw new QuoteNotFoundError();
  return getInvoice(input.organizationId, row.id);
}

// DEV-04 — avoir (série à part), partiel ou total ; jamais plus que le
// montant restant de la facture, qui elle ne change pas.
export async function issueCreditNote(input: IssueCreditNoteInput): Promise<CreditNoteView> {
  const now = input.now ?? new Date();
  requireInteger(input.amountCents, 1, MAX_AMOUNT_CENTS, "montant de l'avoir");
  const reason = requireText(input.reason, "motif de l'avoir");
  const row = await insertCreditNote(input.organizationId, input.invoiceId, (invoice, existing, settings) => {
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
  });
  if (!row) throw new InvoiceNotFoundError();
  return getCreditNote(input.organizationId, row.id);
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

const _contractCheck: QuotesServiceContract = {
  listCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  archiveCatalogItem,
  getQuoteSettings,
  updateQuoteSettings,
  createQuote,
  listEventQuotes,
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
  addScheduleItem,
  updateScheduleItem,
  removeScheduleItem,
  markScheduleItemPaid,
  markScheduleItemUnpaid,
  listUnpaidPayments,
  isSignatureAvailable,
  sendQuoteForSignature,
  handleSignatureWebhook,
  getSignatureDocumentUrl,
  listClientQuotesToSign,
  setQuoteClientKind,
  issueDepositInvoice,
  issueBalanceInvoice,
  issueCreditNote,
  listQuoteInvoices,
  getInvoice,
  getCreditNote,
  getEReporting,
};
void _contractCheck;
