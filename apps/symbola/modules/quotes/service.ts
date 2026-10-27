// Porte d'entrée publique du module quotes — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/quotes si ce module est extrait en app autonome.
import { createAppConnection } from "@symbola/db/client";
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
} from "@symbola/contracts";
import { EventNotFoundError, getEvent } from "@/modules/events/service";
import { computeLegalMention, getDocumentHeader, getOrganizationProfile, type OrganizationProfile } from "@/modules/hub/service";
import { computeQuoteTotals, formatDocumentNumber, lineAmounts, validUntil, type GlobalDiscount } from "./amounts";
import { addCalendarDays, groupByMonth, isOverdue, parisToday, resolveSchedule } from "./schedule";
import {
  archiveCatalogItemRow,
  archivePaymentMethodRow,
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

const DEFAULT_SETTINGS: QuoteSettings = {
  validityDays: 30,
  quotePrefix: "D",
  invoicePrefix: "F",
  creditNotePrefix: "A",
  upcomingHorizonDays: 90,
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
  };
}

const PREFIX_PATTERN = /^[A-Z0-9]{1,8}$/;

export async function updateQuoteSettings(organizationId: string, settings: QuoteSettings): Promise<QuoteSettings> {
  requireInteger(settings.validityDays, 1, 365, "validité");
  requireInteger(settings.upcomingHorizonDays, 1, 730, "horizon");
  for (const prefix of [settings.quotePrefix, settings.invoicePrefix, settings.creditNotePrefix]) {
    // DEMO est réservé à la série d'essai (ADR 0008).
    if (!PREFIX_PATTERN.test(prefix) || prefix === DEMO_PREFIX) throw new RangeError("préfixe invalide");
  }
  const row = await upsertQuoteSettings(organizationId, settings);
  return {
    validityDays: row.validityDays,
    quotePrefix: row.quotePrefix,
    invoicePrefix: row.invoicePrefix,
    creditNotePrefix: row.creditNotePrefix,
    upcomingHorizonDays: row.upcomingHorizonDays,
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

function toDetail(aggregate: QuoteAggregate, profile: OrganizationProfile, now: Date = new Date()): QuoteDetail {
  const versions = aggregate.versions.map((version) => toVersionView(version, aggregate, profile, now));
  const current = versions.find((version) => version.version === aggregate.quote.currentVersion);
  if (!current) throw new QuoteNotFoundError();
  return {
    ...toSummary(aggregate, current),
    versions,
    current,
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
  await deleteEventQuotes(organizationId, eventIds);
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
};
void _contractCheck;
