// Porte d'entrée publique du module quotes — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/quotes si ce module est extrait en app autonome.
import { createAppConnection } from "@symbola/db/client";
import type {
  CatalogItem,
  CatalogItemInput,
  CreateQuoteInput,
  GlobalDiscountInput,
  QuoteDetail,
  QuoteLine,
  QuoteLineInput,
  QuoteSettings,
  QuoteSummary,
  QuotesServiceContract,
  QuoteTotalsView,
  QuoteVersionView,
  SellerSnapshot,
  SendQuoteInput,
} from "@symbola/contracts";
import { EventNotFoundError, getEvent } from "@/modules/events/service";
import { computeLegalMention, getDocumentHeader, getOrganizationProfile, type OrganizationProfile } from "@/modules/hub/service";
import { computeQuoteTotals, formatDocumentNumber, lineAmounts, validUntil, type GlobalDiscount } from "./amounts";
import {
  archiveCatalogItemRow,
  deleteEventQuotes,
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
  type WriteResult,
} from "./repository";

export type {
  CatalogItem,
  CatalogItemInput,
  CreateQuoteInput,
  GlobalDiscountInput,
  QuoteDetail,
  QuoteLine,
  QuoteLineInput,
  QuoteSettings,
  QuoteStatus,
  QuoteSummary,
  QuotesServiceContract,
  QuoteTotalsView,
  QuoteVersionView,
  SellerSnapshot,
  SendQuoteInput,
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

const DEFAULT_SETTINGS: QuoteSettings = { validityDays: 30, quotePrefix: "D", invoicePrefix: "F", creditNotePrefix: "A" };
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
  };
}

const PREFIX_PATTERN = /^[A-Z0-9]{1,8}$/;

export async function updateQuoteSettings(organizationId: string, settings: QuoteSettings): Promise<QuoteSettings> {
  requireInteger(settings.validityDays, 1, 365, "validité");
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

function toVersionView(version: QuoteVersionRow, lines: QuoteLineRow[], profile: OrganizationProfile): QuoteVersionView {
  const ownLines = lines.filter((line) => line.versionId === version.id);
  const sent = version.sentAt !== null;
  // Brouillon : régime courant de l'organisation ; envoyée : copie figée.
  const vatRegime = (sent ? version.vatRegime : profile.vatRegime) as QuoteVersionView["vatRegime"];
  const vatApplicable = vatRegime !== "franchise";
  return {
    id: version.id,
    version: version.version,
    lines: ownLines.map(toLine),
    globalDiscount: toGlobalDiscount(version),
    totals: sent && version.totalsSnapshot ? (version.totalsSnapshot as QuoteTotalsView) : totalsFor(ownLines, version, vatApplicable),
    vatApplicable,
    vatRegime: vatRegime ?? null,
    legalMention: version.legalMention,
    seller: (version.sellerSnapshot as SellerSnapshot | null) ?? null,
    validUntil: version.validUntil,
    sentAt: version.sentAt?.toISOString() ?? null,
  };
}

function toDetail(aggregate: QuoteAggregate, profile: OrganizationProfile): QuoteDetail {
  const versions = aggregate.versions.map((version) => toVersionView(version, aggregate.lines, profile));
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

function unwrap(result: WriteResult | { status: "draft_exists" }): string {
  if (result.status === "not_found") throw new QuoteNotFoundError();
  if (result.status === "locked") throw new QuoteVersionLockedError();
  if (result.status === "draft_exists") throw new QuoteVersionLockedError();
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

  const result = await freezeCurrentVersion(input.organizationId, input.quoteId, (version, lines) => {
    // Vérifié ici, après « devis vide » : un devis vide est signalé d'abord.
    if (!vatRegime) throw new QuoteVatRegimeRequiredError();
    return {
      sentAt: now,
      validUntil: validUntil(parisDate(now), settings.validityDays),
      vatRegime,
      legalMention: legalMention === "" ? null : legalMention,
      sellerSnapshot: seller,
      totalsSnapshot: totalsFor(lines, version, vatRegime !== "franchise"),
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
};
void _contractCheck;
