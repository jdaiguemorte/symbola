// Contrat interne du module quotes (Lot 4, Devis et Facturation — DEV-01),
// pensé comme le futur contrat HTTP /v1/quotes si le module est extrait en
// app autonome (ADR 0011). Montants en centimes entiers EUR, taux et
// remises en points de base, quantités en millièmes : jamais de float.

export type CatalogItemInput = {
  label: string;
  description?: string | null | undefined;
  unit: string;
  unitPriceCents: number;
  vatRateBasisPoints: number;
  category?: string | null | undefined;
};

export type CatalogItem = Required<{ [K in keyof CatalogItemInput]: Exclude<CatalogItemInput[K], undefined> }> & {
  id: string;
  archived: boolean;
};

export type QuoteSettings = {
  validityDays: number;
  quotePrefix: string;
  invoicePrefix: string;
  creditNotePrefix: string;
};

export type QuoteStatus = "draft" | "sent" | "signed" | "declined" | "expired";

export type GlobalDiscountInput =
  | { kind: "none" }
  | { kind: "percent"; basisPoints: number }
  | { kind: "amount"; cents: number };

// Ligne depuis le catalogue (copie de l'article, ajustable) ou ligne libre.
export type QuoteLineInput = {
  catalogItemId?: string | null | undefined;
  label?: string | undefined;
  description?: string | null | undefined;
  unit?: string | undefined;
  quantityMilli: number;
  unitPriceCents?: number | undefined;
  vatRateBasisPoints?: number | undefined;
  discountBasisPoints?: number | undefined;
};

export type QuoteLine = {
  id: string;
  catalogItemId: string | null;
  label: string;
  description: string | null;
  unit: string;
  quantityMilli: number;
  unitPriceCents: number;
  vatRateBasisPoints: number;
  discountBasisPoints: number;
  position: number;
  netCents: number;
};

export type QuoteTotalsView = {
  subtotalCents: number;
  globalDiscountCents: number;
  totalHtCents: number;
  vatByRate: { rateBasisPoints: number; baseCents: number; vatCents: number }[];
  totalVatCents: number;
  totalTtcCents: number;
};

// En-tête vendeur figé à l'envoi (PDF : logo, coordonnées, SIREN).
export type SellerSnapshot = {
  organizationName: string;
  address: string | null;
  siren: string | null;
  logoKey: string | null;
};

export type QuoteVersionView = {
  id: string;
  version: number;
  lines: QuoteLine[];
  globalDiscount: GlobalDiscountInput;
  // Brouillon : calculés à la volée ; version envoyée : copie figée.
  totals: QuoteTotalsView;
  vatApplicable: boolean;
  vatRegime: "franchise" | "assujetti" | null;
  legalMention: string | null;
  seller: SellerSnapshot | null;
  validUntil: string | null;
  sentAt: string | null;
};

export type QuoteSummary = {
  id: string;
  eventId: string;
  number: string;
  status: QuoteStatus;
  currentVersion: number;
  isDemo: boolean;
  totalTtcCents: number;
};

export type QuoteDetail = QuoteSummary & {
  versions: QuoteVersionView[];
  current: QuoteVersionView;
  // ONB-02 : devis envoyé, non signé, dont le régime de TVA figé n'est plus
  // celui de l'organisation — l'app propose une nouvelle version.
  regimeChangedSinceSent: boolean;
};

export type CreateQuoteInput = {
  organizationId: string;
  eventId: string;
  createdByUserId: string;
  now?: Date | undefined;
};

export type SendQuoteInput = {
  organizationId: string;
  quoteId: string;
  now?: Date | undefined;
};

export interface QuotesServiceContract {
  listCatalogItems(organizationId: string, options?: { includeArchived?: boolean }): Promise<CatalogItem[]>;
  createCatalogItem(organizationId: string, item: CatalogItemInput): Promise<CatalogItem>;
  updateCatalogItem(organizationId: string, itemId: string, item: CatalogItemInput): Promise<CatalogItem>;
  archiveCatalogItem(organizationId: string, itemId: string): Promise<void>;
  getQuoteSettings(organizationId: string): Promise<QuoteSettings>;
  updateQuoteSettings(organizationId: string, settings: QuoteSettings): Promise<QuoteSettings>;
  createQuote(input: CreateQuoteInput): Promise<QuoteDetail>;
  listEventQuotes(organizationId: string, eventId: string): Promise<QuoteSummary[]>;
  getQuote(organizationId: string, quoteId: string): Promise<QuoteDetail>;
  addQuoteLine(organizationId: string, quoteId: string, line: QuoteLineInput): Promise<QuoteDetail>;
  updateQuoteLine(organizationId: string, lineId: string, line: QuoteLineInput): Promise<QuoteDetail>;
  removeQuoteLine(organizationId: string, lineId: string): Promise<QuoteDetail>;
  setQuoteGlobalDiscount(organizationId: string, quoteId: string, discount: GlobalDiscountInput): Promise<QuoteDetail>;
  sendQuote(input: SendQuoteInput): Promise<QuoteDetail>;
  reviseQuote(organizationId: string, quoteId: string): Promise<QuoteDetail>;
  removeEventQuotesData(organizationId: string, eventIds: string[]): Promise<void>;
}
