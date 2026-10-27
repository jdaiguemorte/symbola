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
  // DEV-03 : horizon des encaissements à venir au tableau de bord.
  upcomingHorizonDays: number;
  // DEV-04 : délai de paiement d'une facture de solde, mentions de facturation.
  invoicePaymentTermDays: number;
  invoiceMentions: string | null;
};

// DEV-03 — modes de paiement (liste paramétrable par organisation).
export type PaymentMethod = { id: string; label: string; archived: boolean };

// Un acompte : montant fixe OU pourcentage du total TTC, et une date.
export type ScheduleItemInput = {
  label: string;
  dueDate: string;
  amountCents?: number | null | undefined;
  percentageBasisPoints?: number | null | undefined;
};

export type ScheduleItemView = {
  id: string;
  label: string;
  dueDate: string;
  fixedAmountCents: number | null;
  percentageBasisPoints: number | null;
  // Montant effectif, recalculé sur le total de la version.
  amountCents: number;
  paidOn: string | null;
  paymentMethodId: string | null;
  paymentMethodLabel: string | null;
  overdue: boolean;
  position: number;
};

export type PaymentScheduleView = {
  items: ScheduleItemView[];
  scheduledCents: number;
  // Solde calculé, jamais stocké.
  balanceCents: number;
  exceedsTotal: boolean;
};

export type MarkScheduleItemPaidInput = {
  organizationId: string;
  scheduleItemId: string;
  paidOn: string;
  paymentMethodId: string;
  now?: Date | undefined;
};

export type UnpaidPayment = {
  scheduleItemId: string;
  quoteId: string;
  quoteNumber: string;
  eventId: string;
  label: string;
  dueDate: string;
  amountCents: number;
  overdue: boolean;
};

// DEV-03 — encaissements à venir : échéances non payées des devis envoyés
// ou signés (jamais d'essai), triées par date, total par mois.
export type UnpaidPaymentsView = {
  overdue: UnpaidPayment[];
  upcoming: UnpaidPayment[];
  overdueTotalCents: number;
  months: { month: string; totalCents: number }[];
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
  schedule: PaymentScheduleView;
};

// DEV-04 : un client professionnel exige Factur-X (lot dédié).
export type ClientKind = "individual" | "professional";

export type InvoiceTotalsView = {
  totalHtCents: number;
  vatByRate: { rateBasisPoints: number; baseCents: number; vatCents: number }[];
  totalVatCents: number;
  totalTtcCents: number;
};

export type InvoiceBuyer = { name: string; billingAddress: string };

export type CreditNoteView = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  number: string;
  isDemo: boolean;
  issuedOn: string;
  amountCents: number;
  reason: string;
  legalMention: string | null;
  seller: SellerSnapshot;
  buyers: InvoiceBuyer[];
  totals: InvoiceTotalsView;
};

// DEV-04 — facture émise, copie figée de tout ce qui y figure.
export type InvoiceView = {
  id: string;
  quoteId: string;
  quoteNumber: string;
  kind: "deposit" | "balance";
  // Échéance facturée (acompte), null pour le solde.
  scheduleItemId: string | null;
  number: string;
  isDemo: boolean;
  issuedOn: string;
  serviceDate: string | null;
  paymentDueOn: string;
  amountCents: number;
  vatRegime: "franchise" | "assujetti";
  vatApplicable: boolean;
  legalMention: string | null;
  mentions: string | null;
  seller: SellerSnapshot;
  buyers: InvoiceBuyer[];
  // Lignes du devis (solde) ou libellé de l'acompte.
  lines: { label: string; description: string | null; unit: string; quantityMilli: number; unitPriceCents: number; vatRateBasisPoints: number; discountBasisPoints: number; netCents: number }[];
  depositLabel: string | null;
  quoteTotals: QuoteTotalsView;
  // Acomptes déjà facturés, déduits d'une facture de solde.
  deductions: { number: string; amountCents: number }[];
  totals: InvoiceTotalsView;
  creditNotes: CreditNoteView[];
  creditedCents: number;
};

// AIDE-02 — devis fictif sur l'événement d'essai guidé (ADR 0008).
export type StartQuotesTrialInput = {
  organizationId: string;
  eventId: string;
  createdByUserId: string;
  locale: "fr" | "en";
  now?: Date | undefined;
};

export type IssueDepositInvoiceInput = { organizationId: string; scheduleItemId: string; now?: Date | undefined };
export type IssueBalanceInvoiceInput = { organizationId: string; quoteId: string; now?: Date | undefined };
export type IssueCreditNoteInput = {
  organizationId: string;
  invoiceId: string;
  amountCents: number;
  reason: string;
  now?: Date | undefined;
};

// DEV-04 — données d'e-reporting d'une période (clients particuliers) :
// factures et avoirs émis, encaissements reçus ; jamais de donnée d'essai.
export type EReportingView = {
  from: string;
  to: string;
  invoices: { number: string; issuedOn: string; kind: "deposit" | "balance"; totalHtCents: number; totalVatCents: number; totalTtcCents: number }[];
  creditNotes: { number: string; invoiceNumber: string; issuedOn: string; totalHtCents: number; totalVatCents: number; totalTtcCents: number }[];
  payments: { paidOn: string; amountCents: number; paymentMethod: string | null; quoteNumber: string; label: string }[];
  totals: { invoicedTtcCents: number; creditedTtcCents: number; netHtCents: number; netVatCents: number; netTtcCents: number; collectedCents: number };
};

export type QuoteSummary = {
  id: string;
  eventId: string;
  number: string;
  status: QuoteStatus;
  currentVersion: number;
  isDemo: boolean;
  clientKind: ClientKind;
  totalTtcCents: number;
};

// DEV-02 — signataires saisis sur le devis (ADR 0021).
export type SignerInput = {
  eventClientId?: string | null | undefined;
  name: string;
  email: string;
  billingAddress: string;
};

export type SignerView = {
  id: string;
  eventClientId: string | null;
  name: string;
  email: string;
  billingAddress: string;
  status: "pending" | "signed" | "declined";
  signedAt: string | null;
  signingUrl: string;
};

export type SignatureView = {
  id: string;
  provider: string;
  status: "pending" | "completed" | "declined";
  signers: SignerView[];
  createdAt: string;
  completedAt: string | null;
  hasSignedDocument: boolean;
};

export type SendForSignatureInput = {
  organizationId: string;
  quoteId: string;
  signers: SignerInput[];
  // PDF de la version envoyée, avec une balise de signature par signataire.
  documentPdf: Uint8Array;
  locale: "fr" | "en";
};

// Réponse du webhook : 401 si l'appel n'est pas authentifié (journalisé,
// sans effet), 200 sinon — y compris pour un appel rejoué (idempotent).
export type SignatureWebhookResult = { httpStatus: 200 | 401; outcome: string };

// DEV-02 — ce que le marié voit dans son espace : le devis à signer et son
// propre lien, jamais celui d'un autre signataire.
export type ClientQuoteToSign = {
  quoteId: string;
  number: string;
  version: number;
  totalTtcCents: number;
  status: "pending" | "completed" | "declined";
  ownSigningUrl: string | null;
  ownStatus: "pending" | "signed" | "declined" | null;
};

export type QuoteDetail = QuoteSummary & {
  versions: QuoteVersionView[];
  current: QuoteVersionView;
  // ONB-02 : devis envoyé, non signé, dont le régime de TVA figé n'est plus
  // celui de l'organisation — l'app propose une nouvelle version.
  regimeChangedSinceSent: boolean;
  // DEV-02 : demande de signature de la version courante.
  signature: SignatureView | null;
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
  listPaymentMethods(organizationId: string, options?: { includeArchived?: boolean }): Promise<PaymentMethod[]>;
  addPaymentMethods(organizationId: string, labels: string[]): Promise<PaymentMethod[]>;
  archivePaymentMethod(organizationId: string, paymentMethodId: string): Promise<void>;
  addScheduleItem(organizationId: string, quoteId: string, item: ScheduleItemInput): Promise<QuoteDetail>;
  updateScheduleItem(organizationId: string, scheduleItemId: string, item: ScheduleItemInput): Promise<QuoteDetail>;
  removeScheduleItem(organizationId: string, scheduleItemId: string): Promise<QuoteDetail>;
  markScheduleItemPaid(input: MarkScheduleItemPaidInput): Promise<QuoteDetail>;
  markScheduleItemUnpaid(organizationId: string, scheduleItemId: string): Promise<QuoteDetail>;
  listUnpaidPayments(organizationId: string, options?: { now?: Date; horizonDays?: number }): Promise<UnpaidPaymentsView>;
  isSignatureAvailable(isDemo: boolean): boolean;
  sendQuoteForSignature(input: SendForSignatureInput): Promise<QuoteDetail>;
  handleSignatureWebhook(input: { headers: Headers; rawBody: string }): Promise<SignatureWebhookResult>;
  getSignatureDocumentUrl(organizationId: string, quoteId: string, kind: "signed" | "certificate"): Promise<string>;
  listClientQuotesToSign(organizationId: string, eventId: string, clientEmail: string): Promise<ClientQuoteToSign[]>;
  setQuoteClientKind(organizationId: string, quoteId: string, clientKind: ClientKind): Promise<QuoteDetail>;
  issueDepositInvoice(input: IssueDepositInvoiceInput): Promise<InvoiceView>;
  issueBalanceInvoice(input: IssueBalanceInvoiceInput): Promise<InvoiceView>;
  issueCreditNote(input: IssueCreditNoteInput): Promise<CreditNoteView>;
  listQuoteInvoices(organizationId: string, quoteId: string): Promise<InvoiceView[]>;
  getInvoice(organizationId: string, invoiceId: string): Promise<InvoiceView>;
  getCreditNote(organizationId: string, creditNoteId: string): Promise<CreditNoteView>;
  getEReporting(organizationId: string, period: { from: string; to: string }): Promise<EReportingView>;
  startQuotesTrial(input: StartQuotesTrialInput): Promise<QuoteDetail>;
}
