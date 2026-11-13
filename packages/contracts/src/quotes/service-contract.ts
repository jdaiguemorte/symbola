// Contrat interne du module quotes (Lot 4, Devis et Facturation — DEV-01),
// pensé comme le futur contrat HTTP /v1/quotes si le module est extrait en
// app autonome (ADR 0011). Montants en centimes entiers EUR, taux et
// remises en points de base, quantités en millièmes : jamais de float.
import type { MonthlyCount } from "../usage";
import type { QuotesSearchResults } from "../search";
import type { FileDownload } from "../file-download";

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
  // Lot 5 (IMP-04) : champs libres d'un import.
  importedFields?: Record<string, string>;
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
  // Lot 31a (JUR-08, décision D5) : acompte ou arrhes proposé pour chaque nouveau devis.
  advanceKindDefault?: AdvanceKind | null | undefined;
};

// Lot 31a (JUR-08, décision D5) : sommes versées d'avance, acomptes ou arrhes.
export type AdvanceKind = "deposit" | "earnest";

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
  // Lot 23b (D2) : historique des encaissements, saisies et annulations.
  payments: PaymentEntryView[];
};

// Lot 23b (D2, ADR 0061) : une écriture d'encaissement, en ajout seul.
export type PaymentEntryView = {
  id: string;
  kind: "received" | "reversal";
  amountCents: number;
  paidOn: string | null;
  paymentMethodLabel: string | null;
  reason: string | null;
  recordedAt: string;
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
  // Lot 31a (FAC-01, décision D2) : section de la ligne, ligne en option.
  sectionId?: string | null | undefined;
  isOption?: boolean | undefined;
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
  // Lot 31a (FAC-01, décision D2) : une option reste hors du total tant qu'elle n'est pas choisie.
  sectionId: string | null;
  isOption: boolean;
  optionChosen: boolean;
};

// Lot 31a (FAC-01) : section titrée d'une version, avec le sous-total de ses lignes au total.
export type QuoteSection = { id: string; title: string; position: number; subtotalCents: number };

// Lot 31a (FAC-01, décision D2) : choix des options, daté et nominatif.
export type OptionsChoice = { chosenAt: string; chosenBy: string; byKind: "client" | "planner" };

export type QuoteTotalsView = {
  subtotalCents: number;
  globalDiscountCents: number;
  totalHtCents: number;
  vatByRate: { rateBasisPoints: number; baseCents: number; vatCents: number }[];
  totalVatCents: number;
  totalTtcCents: number;
};

// Lot 17 (DEV-09 à DEV-11, ADR 0046) — apparence et textes des documents.
export type DocumentFont = "modern" | "classic";

export type DocumentSettings = {
  // #RRGGBB ; null : gris ardoise de départ.
  color: string | null;
  font: DocumentFont;
  iban: string | null;
  bic: string | null;
  quoteIntro: string | null;
  // Conditions particulières du devis.
  quoteTerms: string | null;
  invoiceIntro: string | null;
  // Conditions de paiement de la facture (même colonne que
  // QuoteSettings.invoiceMentions).
  invoiceTerms: string | null;
  footer: string | null;
};

// Copie figée dans l'instantané vendeur : seulement les textes du document
// concerné (devis : introduction et conditions ; facture : introduction,
// ses conditions de paiement étant figées à part, InvoiceView.mentions).
export type DocumentSnapshot = {
  color: string | null;
  font: DocumentFont;
  iban: string | null;
  bic: string | null;
  intro: string | null;
  terms: string | null;
  footer: string | null;
};

// Formes juridiques (valeurs réglementaires, hub.legal_form).
export type LegalFormCode = "ei" | "eirl" | "eurl" | "sarl" | "sas" | "sasu" | "sa" | "auto_entrepreneur" | "autre";

// En-tête vendeur figé à l'envoi (PDF : logo, coordonnées, SIREN).
export type SellerSnapshot = {
  organizationName: string;
  address: string | null;
  siren: string | null;
  logoKey: string | null;
  // Lot 17 (DEV-07, DEV-12) : absents des copies antérieures au lot 17,
  // qui s'impriment avec l'apparence neutre.
  legalForm?: LegalFormCode | null;
  siret?: string | null;
  vatNumber?: string | null;
  registration?: string | null;
  shareCapitalCents?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  document?: DocumentSnapshot;
  // Lot 31a (JUR-09) : absents des copies antérieures au lot 31a.
  insurer?: string | null;
  insurancePolicy?: string | null;
  insuranceCoverage?: string | null;
  mediatorName?: string | null;
  mediatorUrl?: string | null;
  generalTerms?: string | null;
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
  // Lot 31a (FAC-01, JUR-08, HUB-21).
  sections: QuoteSection[];
  advanceKind: AdvanceKind | null;
  optionsChoice: OptionsChoice | null;
  template: { id: string | null; version: number } | null;
};

// DEV-04 : un client professionnel exige Factur-X (lot dédié).
export type ClientKind = "individual" | "professional" | "non_professional";

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
  // Lot 31a (JUR-08) : acompte ou arrhes, repris du devis (null avant le lot 31a).
  advanceKind: AdvanceKind | null;
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

// Lot 23b (DOC-08, ADR 0061) : renderOriginal rend le PDF de la pièce émise,
// déposé tel quel dans la transaction de l'émission (sauf pièce d'essai).
export type RenderInvoiceOriginal = (invoice: InvoiceView) => Promise<Uint8Array>;
export type RenderCreditNoteOriginal = (creditNote: CreditNoteView, vatApplicable: boolean) => Promise<Uint8Array>;
export type IssueDepositInvoiceInput = {
  organizationId: string;
  scheduleItemId: string;
  renderOriginal: RenderInvoiceOriginal;
  now?: Date | undefined;
  // Lot 31b (réponse 1 de l'avocat) : contrat hors établissement, aucun paiement avant ce jour.
  paymentNotBefore?: string | null | undefined;
};
export type IssueBalanceInvoiceInput = {
  organizationId: string;
  quoteId: string;
  renderOriginal: RenderInvoiceOriginal;
  now?: Date | undefined;
};
export type IssueCreditNoteInput = {
  organizationId: string;
  invoiceId: string;
  amountCents: number;
  reason: string;
  renderOriginal: RenderCreditNoteOriginal;
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

// Lot 13 (L13-HUB-15) — devis envoyé sans réponse, pour le bloc « À traiter ».
export type QuoteAwaitingAnswer = { quoteId: string; number: string; eventId: string; sentAt: Date; daysSince: number };

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
  // Lot 31b (DOC-03, D9) : le devis seul, ou le devis suivi de son contrat.
  kind: SignatureRequestKind;
  contractId: string | null;
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
  // Lot 31b (DOC-03, D9) : contrat signé avec le devis, dans le même PDF (devis puis contrat).
  contractId?: string | null | undefined;
};

// Lot 31b (DOC-03, D9) — contrat généré après la signature du devis : signé seul, par les
// signataires du devis.
export type SendContractForSignatureInput = {
  organizationId: string;
  quoteId: string;
  contractId: string;
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
  // Lot 31a (JUR-08, D5) : acompte ou arrhes, rappelé au client.
  advanceKind: AdvanceKind | null;
  // Lot 31b (DOC-03, D9) : le devis seul, le devis suivi de son contrat, ou le contrat seul.
  kind: SignatureRequestKind;
  // Lot 31b (JUR-07 ; D11, D13) : le contrat signé avec le devis (ou seul), lisible avant la
  // signature, et les actes de ce signataire : commande à distance, exécution anticipée.
  contract: ClientContract | null;
};

export type SignatureRequestKind = "quote" | "quote_contract" | "contract";

export type ClientContract = {
  contractId: string;
  title: string;
  version: number;
  withdrawalApplies: boolean;
  // À distance : le lien de signature ne s'affiche qu'après la commande.
  orderRequired: boolean;
  orderedAt: string | null;
  // Texte de la clause d'exécution anticipée, si la rétractation s'applique et que le contrat la porte.
  earlyExecutionText: string | null;
  earlyExecutionRequestedAt: string | null;
  // Actes possibles tant que ce signataire n'a pas signé.
  open: boolean;
};

// Lot 31a (FAC-01, décision D2) — options d'un devis envoyé, à choisir par le client sur son
// portail avant la signature (prix TTC estimé de chaque option, total une fois choisi).
export type ClientQuoteOptions = {
  quoteId: string;
  number: string;
  version: number;
  totalTtcCents: number;
  vatApplicable: boolean;
  options: { lineId: string; label: string; description: string | null; section: string | null; amountCents: number; chosen: boolean }[];
  choice: OptionsChoice | null;
  // Le choix se fige dès que la signature commence.
  locked: boolean;
  // JUR-08 (D5) : acompte ou arrhes, rappelé au client.
  advanceKind: AdvanceKind | null;
};

// Lot 31a (FAC-01, HUB-21, décision D3) — modèle de devis par type d'événement.
export type QuoteTemplateSummary = {
  id: string;
  name: string;
  eventTypeId: string | null;
  version: number;
  sectionCount: number;
  lineCount: number;
  optionCount: number;
  scheduleCount: number;
  advanceKind: AdvanceKind | null;
};

// Lot 31a (FAC-07, JUR-01, décision D4) — mentions requises manquantes, nommées.
export type MissingMention =
  | "organizationName"
  | "address"
  | "siren"
  | "registration"
  | "shareCapital"
  | "vatNumber"
  | "insurance"
  | "mediator"
  | "generalTerms"
  | "paymentTerms"
  | "advanceKind";

// --- Lot 31b (FAC-04, FAC-05, DOC-02, DOC-03, JUR-07, JUR-08, HUB-21 ; décisions D6, D7, D9, D11
// à D17, révisées après les réponses de l'avocat du 13/11/2026) ---

export type ContractClauseRole =
  | "precontractual_information"
  | "withdrawal_period"
  | "withdrawal_form"
  | "early_execution"
  | "termination"
  | "no_withdrawal"
  | "advance_deposit"
  | "advance_earnest";
export type ConclusionChannel = "on_premises" | "distance" | "off_premises" | "fair";

export type ContractTemplateClauseInput = { title: string; body: string; optional: boolean; role: ContractClauseRole | null };
export type ContractTemplateClause = ContractTemplateClauseInput & { id: string; position: number };

export type ContractTemplateHeaderInput = { name: string; title: string; eventTypeId: string | null; legalReviewedOn: string | null };

export type ContractTemplateView = ContractTemplateHeaderInput & {
  id: string;
  version: number;
  clauses: ContractTemplateClause[];
};

// Ce qui empêche de générer un contrat, nommé (FAC-04, DOC-02 ; D12, D21).
export type ContractProblem =
  | { kind: "variable_missing"; variable: string }
  | { kind: "variable_unknown"; variable: string }
  | { kind: "clause_unwritten"; clause: string }
  | { kind: "role_missing"; role: ContractClauseRole }
  | { kind: "advance_missing"; advanceKind: AdvanceKind }
  | { kind: "advance_mismatch"; advanceKind: AdvanceKind | null }
  | { kind: "channel_blocked" }
  | { kind: "payment_too_soon"; firstAllowed: string }
  | { kind: "warning_not_accepted" }
  | { kind: "quote_not_sent" };

export type ContractRegimeView = {
  withdrawalApplies: boolean;
  orderRequired: boolean;
  noPaymentDays: number | null;
  requiredRoles: ContractClauseRole[];
};

export type ContractCheckInput = {
  organizationId: string;
  quoteId: string;
  templateId: string;
  optionalClauseIds: string[];
  channel: ConclusionChannel;
  smallBusinessConfirmed: boolean;
  userId: string;
  locale: "fr" | "en";
  now?: Date | undefined;
};

// Aperçu d'une génération : clauses résolues, régime, ce qui l'empêche, conseil de signature.
export type ContractCheck = {
  templateVersion: number;
  templateReviewedOn: string | null;
  title: string;
  clauses: { title: string; body: string; role: ContractClauseRole | null }[];
  regime: ContractRegimeView;
  problems: ContractProblem[];
  warningAccepted: boolean;
  // Réponse 5 de l'avocat (D15) : niveau recommandé et niveau disponible.
  signature: { recommended: "simple" | "advanced"; available: "simple" | "advanced" | "qualified" };
};

export type GenerateContractInput = ContractCheckInput & { acceptWarning: boolean };

export type ContractActView = { signerId: string; signerName: string; kind: "order" | "early_execution"; actedAt: string };

export type ContractView = {
  id: string;
  quoteId: string;
  quoteVersion: number;
  version: number;
  templateId: string | null;
  templateVersion: number;
  templateReviewedOn: string | null;
  title: string;
  clauses: { title: string; body: string; role: ContractClauseRole | null }[];
  conclusionChannel: ConclusionChannel;
  clientCategory: ClientKind;
  smallBusinessConfirmed: boolean;
  regime: ContractRegimeView;
  signatureLevel: string;
  recommendedSignatureLevel: "simple" | "advanced";
  generatedAt: string;
  // Généré pour une autre version du devis, ou avant le dernier choix des options : à refaire.
  outdated: boolean;
  signature: { kind: SignatureRequestKind; status: "pending" | "completed" | "declined"; hasSignedDocument: boolean } | null;
  acts: ContractActView[];
  hasEvidence: boolean;
};

// Facture d'acompte émise d'elle-même (FAC-05, D6) : en attente de la fin du délai, bloquée par
// une mention manquante (champs nommés), ou émise.
export type ScheduledDepositView = {
  quoteId: string;
  quoteNumber: string;
  eventId: string;
  scheduleItemLabel: string;
  status: "waiting" | "blocked" | "issued";
  issueOn: string;
  // Hors établissement : aucun paiement demandé avant ce jour.
  paymentNotBefore: string | null;
  missingFields: string[];
  invoiceId: string | null;
};

export type IssueScheduledDepositsInput = {
  organizationId: string;
  quoteId?: string | undefined;
  now?: Date | undefined;
  renderOriginal: (invoice: InvoiceView, locale: "fr" | "en") => Promise<Uint8Array>;
};

// Dossier de preuve de Symbola (réponses 1 et 5 de l'avocat) : faits figés, relus et vérifiés.
export type ContractEvidenceDocument = {
  version: 1;
  writtenAt: string;
  quote: { number: string; version: number };
  contract: {
    id: string;
    version: number;
    title: string;
    templateVersion: number;
    templateReviewedOn: string | null;
    generatedAt: string;
    conclusionChannel: ConclusionChannel;
    clientCategory: ClientKind;
    smallBusinessConfirmed: boolean;
    withdrawalApplies: boolean;
    signatureLevel: string;
  };
  request: { kind: SignatureRequestKind; provider: string; externalId: string; createdAt: string; completedAt: string };
  signers: { id: string; name: string; email: string; status: string; signedAt: string | null }[];
  acts: { signerId: string; signerName: string; kind: "order" | "early_execution"; actedAt: string; presentedText: string }[];
  documents: { signedDocumentSha256: string; auditCertificateSha256: string };
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
  listQuotes(organizationId: string): Promise<QuoteSummary[]>;
  listQuotesAwaitingAnswer(organizationId: string, days: number, now?: Date): Promise<QuoteAwaitingAnswer[]>;
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
  // Lot 21 (DEV-13) : un mode désactivé se réactive.
  restorePaymentMethod(organizationId: string, paymentMethodId: string): Promise<void>;
  addScheduleItem(organizationId: string, quoteId: string, item: ScheduleItemInput): Promise<QuoteDetail>;
  updateScheduleItem(organizationId: string, scheduleItemId: string, item: ScheduleItemInput): Promise<QuoteDetail>;
  removeScheduleItem(organizationId: string, scheduleItemId: string): Promise<QuoteDetail>;
  markScheduleItemPaid(input: MarkScheduleItemPaidInput): Promise<QuoteDetail>;
  // Lot 23b (D2) : annulation par écriture inverse, motif obligatoire.
  markScheduleItemUnpaid(organizationId: string, scheduleItemId: string, reason: string): Promise<QuoteDetail>;
  listUnpaidPayments(organizationId: string, options?: { now?: Date; horizonDays?: number }): Promise<UnpaidPaymentsView>;
  isSignatureAvailable(isDemo: boolean): boolean;
  sendQuoteForSignature(input: SendForSignatureInput): Promise<QuoteDetail>;
  handleSignatureWebhook(input: { headers: Headers; rawBody: string }): Promise<SignatureWebhookResult>;
  // ADR 0026 — relit chez le fournisseur les demandes en attente (webhook perdu).
  reconcilePendingSignatures(organizationId: string): Promise<{ checked: number; completed: number }>;
  // ADR 0027 — servi par l'app (jamais de lien direct vers le stockage).
  // Lot 9 (ADR 0029) — statistiques d'usage pour l'Admin, essais exclus.
  countQuotesAndInvoicesByMonth(
    organizationIds: string[],
    since: Date,
  ): Promise<Record<string, { quotes: MonthlyCount[]; invoices: MonthlyCount[] }>>;
  // Lot 10 (AIDE-08) — recherche globale, essais exclus.
  searchQuotes(organizationId: string, words: string[], eventIds: string[], limit: number): Promise<QuotesSearchResults>;
  getSignatureDocument(organizationId: string, quoteId: string, kind: "signed" | "certificate"): Promise<FileDownload>;
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
  // Lot 31a (FAC-01, FAC-07, JUR-01, JUR-08, HUB-21 ; décisions D2 à D5).
  addQuoteSection(organizationId: string, quoteId: string, title: string): Promise<QuoteDetail>;
  renameQuoteSection(organizationId: string, sectionId: string, title: string): Promise<QuoteDetail>;
  removeQuoteSection(organizationId: string, sectionId: string): Promise<QuoteDetail>;
  setQuoteAdvanceKind(organizationId: string, quoteId: string, kind: AdvanceKind | null): Promise<QuoteDetail>;
  chooseQuoteOptions(input: {
    organizationId: string;
    quoteId: string;
    eventId?: string;
    chosenLineIds: string[];
    chosenBy: string;
    byKind: "client" | "planner";
    now?: Date;
  }): Promise<QuoteDetail>;
  listClientQuoteOptions(organizationId: string, eventId: string): Promise<ClientQuoteOptions[]>;
  quoteMissingMentions(organizationId: string, quoteId: string): Promise<MissingMention[]>;
  listQuoteTemplates(organizationId: string): Promise<QuoteTemplateSummary[]>;
  saveQuoteAsTemplate(input: { organizationId: string; quoteId: string; name: string; eventTypeId: string | null }): Promise<QuoteTemplateSummary>;
  replaceQuoteTemplateFromQuote(input: { organizationId: string; templateId: string; quoteId: string }): Promise<QuoteTemplateSummary>;
  duplicateQuoteTemplate(input: { organizationId: string; templateId: string; name: string }): Promise<QuoteTemplateSummary>;
  renameQuoteTemplate(input: { organizationId: string; templateId: string; name: string; eventTypeId: string | null }): Promise<void>;
  removeQuoteTemplate(organizationId: string, templateId: string): Promise<void>;
  createQuoteFromTemplate(input: CreateQuoteInput & { templateId: string }): Promise<QuoteDetail>;
  addStarterQuoteTemplates(organizationId: string, locale: "fr" | "en"): Promise<QuoteTemplateSummary[]>;
  // Lot 31b (FAC-04, FAC-05, DOC-02, DOC-03, JUR-07, JUR-08, HUB-21 ; décisions D6 à D17).
  listContractTemplates(organizationId: string): Promise<ContractTemplateView[]>;
  createContractTemplate(input: ContractTemplateHeaderInput & { organizationId: string }): Promise<ContractTemplateView>;
  updateContractTemplate(input: ContractTemplateHeaderInput & { organizationId: string; templateId: string }): Promise<ContractTemplateView>;
  duplicateContractTemplate(input: { organizationId: string; templateId: string; name: string }): Promise<ContractTemplateView>;
  removeContractTemplate(organizationId: string, templateId: string): Promise<void>;
  addContractClause(organizationId: string, templateId: string, clause: ContractTemplateClauseInput): Promise<ContractTemplateView>;
  updateContractClause(organizationId: string, clauseId: string, clause: ContractTemplateClauseInput): Promise<ContractTemplateView>;
  removeContractClause(organizationId: string, clauseId: string): Promise<ContractTemplateView>;
  moveContractClause(organizationId: string, clauseId: string, direction: "up" | "down"): Promise<ContractTemplateView>;
  addStarterContractTemplates(organizationId: string, locale: "fr" | "en"): Promise<ContractTemplateView[]>;
  checkContract(input: ContractCheckInput): Promise<ContractCheck>;
  generateContract(input: GenerateContractInput): Promise<ContractView>;
  listQuoteContracts(organizationId: string, quoteId: string): Promise<ContractView[]>;
  sendContractForSignature(input: SendContractForSignatureInput): Promise<ContractView>;
  // orderText : libellé du bouton de commande, tel qu'affiché au client (gardé au dossier de preuve).
  recordSignerAct(input: {
    organizationId: string;
    eventId: string;
    clientEmail: string;
    contractId: string;
    kind: "order" | "early_execution";
    orderText?: string;
    now?: Date;
  }): Promise<void>;
  getContractEvidence(organizationId: string, quoteId: string, contractId: string): Promise<ContractEvidenceDocument & { sha256: string }>;
  issueScheduledDepositInvoices(input: IssueScheduledDepositsInput): Promise<{ issued: number; blocked: number }>;
  listOpenScheduledDeposits(organizationId: string): Promise<ScheduledDepositView[]>;
  getQuoteScheduledDeposit(organizationId: string, quoteId: string): Promise<ScheduledDepositView | null>;
}
