// Interface du service.ts de budget (SOC-06) — pensée comme le futur
// contrat HTTP /v1/budget si ce module est extrait en app autonome (ADR
// 0011). apps/symbola vérifie que le vrai module satisfait ce type (test
// de contrat, apps/symbola/modules/budget/service.contract.test.ts).
//
// PRD-BUD-01 uniquement : modèles de répartition, simulation pour un
// prospect. Les montants sont toujours des centimes entiers EUR, les
// pourcentages des points de base entiers (0 à 10000 = 0,00 % à 100,00 %)
// — jamais de float (CLAUDE.md §5).
import type { FileDownload } from "../file-download";
import type { LinkBudgetScope } from "../events/service-contract";

export type AllocationModelItemInput = {
  defaultVendorSlotId: string;
  percentageBasisPoints: number;
};

export type AllocationModelItem = AllocationModelItemInput & { id: string };

export type AllocationModel = {
  id: string;
  name: string;
  items: AllocationModelItem[];
};

export type CreateAllocationModelInput = {
  organizationId: string;
  name: string;
  items: AllocationModelItemInput[];
};

export type EventBudgetItem = {
  defaultVendorSlotId: string;
  amountCents: number;
};

export type EventBudgetView = {
  eventId: string;
  totalAmountCents: number;
  guestCount: number;
  allocationModelId: string | null;
  items: EventBudgetItem[];
  // Dérivés, jamais stockés : somme des items, reste à répartir, coût par
  // invité (0 si guestCount est 0).
  allocatedCents: number;
  remainingCents: number;
  costPerGuestCents: number;
};

export type SimulateEventBudgetInput = {
  organizationId: string;
  eventId: string;
  totalAmountCents: number;
  guestCount: number;
  allocationModelId: string;
};

export type AdjustEventBudgetItemInput = {
  organizationId: string;
  eventId: string;
  defaultVendorSlotId: string;
  amountCents: number;
};

// Lot 28a (BUD-01, décision D2, ADR 0054) — cinq montants par ligne de budget.
// Le reste à payer (engagé moins payé) et l'écart à l'estimé (engagé moins
// estimé) se calculent, jamais stockés ; null tant que l'engagé n'est pas
// connu. Lot 28b (décision Q33) : le poste de l'événement est la catégorie ;
// il porte plusieurs lignes, chacune avec son libellé et son prestataire.
export const BUDGET_AMOUNT_FIELDS = ["estimated", "quoted", "committed", "paid"] as const;
export type BudgetAmountField = (typeof BUDGET_AMOUNT_FIELDS)[number];

export type BudgetLine = {
  id: string;
  eventVendorSlotId: string;
  // Libellé de la ligne ; vide, celui de la catégorie.
  label: string;
  // Prestataire rattaché à la catégorie (module events), et son nom.
  vendorCandidateId: string | null;
  vendorName: string | null;
  position: number;
  estimatedAmountCents: number | null;
  quotedAmountCents: number | null;
  committedAmountCents: number | null;
  paidAmountCents: number | null;
  remainingAmountCents: number | null;
  varianceCents: number | null;
  variancePercent: number | null;
  // Lot 28b (D13) : le payé vient des échéances payées dès qu'il y en a.
  paidFromPayments: boolean;
  // PRD-BUD-03, lot 28b (BUD-04) : documents joints, par nature.
  attachments: BudgetLineAttachment[];
  // Lot 28b (BUD-03) : échéances des paiements au prestataire.
  payments: VendorPayment[];
  // Lot 28c (BUD-09, D5) : taux de TVA de la ligne (celui de départ s'il n'est
  // pas saisi) et ses montants HT, calculés depuis le TTC (ADR 0059).
  vatRateBasisPoints: number;
  ht: BudgetLineHt;
};

// Lot 28c (BUD-09) — montants HT d'une ligne ; null comme le TTC.
export type BudgetLineHt = {
  estimatedCents: number | null;
  quotedCents: number | null;
  committedCents: number | null;
  paidCents: number | null;
  remainingCents: number | null;
  varianceCents: number | null;
};

// Lot 28c (BUD-09) — totaux HT d'une catégorie ou du budget : les TTC sont
// additionnés par taux, puis convertis une fois par taux (ADR 0059).
export type BudgetHtTotals = {
  estimatedCents: number;
  quotedCents: number;
  committedCents: number;
  paidCents: number;
  remainingCents: number;
  varianceCents: number;
};

// Lot 28c (BUD-09, D5) — type de client : le type d'acheteur du devis de
// l'événement ; particulier sans devis. Particulier : TTC seul ; professionnel :
// HT et TTC.
export type BudgetClientKind = "individual" | "professional";

// Lot 28b (BUD-01, Q33) — une catégorie (poste de l'événement) et ses lignes.
export type BudgetCategory = {
  eventVendorSlotId: string;
  label: string;
  lines: BudgetLine[];
  estimatedCents: number;
  quotedCents: number;
  committedCents: number;
  paidCents: number;
  remainingCents: number;
  varianceCents: number;
  ht: BudgetHtTotals;
};

// Lot 28b (BUD-04) : nature d'un document joint.
export const BUDGET_DOCUMENT_KINDS = ["quote", "contract", "invoice"] as const;
export type BudgetDocumentKind = (typeof BUDGET_DOCUMENT_KINDS)[number];

// PRD-BUD-03 — document joint. Jamais d'URL dans la vue : le fichier s'ouvre
// par une route de l'app, après contrôle des droits (ADR 0027).
export type BudgetLineAttachment = {
  id: string;
  kind: BudgetDocumentKind;
  mime: string;
  sizeBytes: number;
  createdAt: string;
};

export type AttachBudgetLineQuoteInput = {
  organizationId: string;
  eventId: string;
  // La ligne visée ; à défaut, la première ligne de la catégorie.
  lineId?: string;
  eventVendorSlotId?: string;
  kind?: BudgetDocumentKind;
  content: Uint8Array;
  uploadedByUserId: string;
};

// Lot 28b (BUD-03, décisions D7, D12 et D13) — échéance d'un paiement à un
// prestataire : montant fixe, ou pourcentage de l'engagé du prestataire (de la
// ligne sans prestataire). amountCents est le montant calculé.
export type VendorPaymentStatus = "due" | "overdue" | "paid";
export type VendorPayment = {
  id: string;
  lineId: string;
  label: string;
  amountCents: number;
  fixedAmountCents: number | null;
  percentageBasisPoints: number | null;
  dueOn: string;
  paidOn: string | null;
  status: VendorPaymentStatus;
};

export type VendorPaymentInput = {
  organizationId: string;
  eventId: string;
  lineId: string;
  label: string;
  fixedAmountCents?: number | null;
  percentageBasisPoints?: number | null;
  dueOn: string;
  changedByUserId: string;
};

// Bloc « Échéances prestataires » de l'accueil (D7) : 7 prochains jours et retards.
export type UpcomingVendorPayment = {
  id: string;
  eventId: string;
  eventName: string;
  lineId: string;
  lineLabel: string;
  vendorName: string | null;
  label: string;
  amountCents: number;
  dueOn: string;
  overdue: boolean;
};

export type AddBudgetLineInput = {
  organizationId: string;
  eventId: string;
  eventVendorSlotId: string;
  label: string;
  vendorCandidateId?: string | null;
};

export type UpdateBudgetLineDetailsInput = {
  organizationId: string;
  eventId: string;
  lineId: string;
  label?: string;
  vendorCandidateId?: string | null;
  // Lot 28c (BUD-09) : taux de TVA, en points de base (0 à 10000).
  vatRateBasisPoints?: number;
};

export type BudgetLinesView = {
  eventId: string;
  categories: BudgetCategory[];
  // Toutes les lignes, dans l'ordre des catégories.
  lines: BudgetLine[];
  totalEstimatedCents: number;
  totalQuotedCents: number;
  totalCommittedCents: number;
  totalPaidCents: number;
  totalRemainingCents: number;
  totalVarianceCents: number;
  // Lot 28c (BUD-09, D5).
  clientKind: BudgetClientKind;
  totalHt: BudgetHtTotals;
  // Lot 28a (BUD-02) : null sans enveloppe (ni budget souhaité, ni simulation).
  envelope: BudgetEnvelope | null;
};

// Lot 26a (POR-01, POR-10) — budget vu par un lien personnel : catégories et
// totaux, sans lignes ; en « catégories choisies », ni enveloppe ni total
// général (les totaux sont ceux des seules catégories partagées).
export type LinkBudgetView = BudgetLinesView & { scope: LinkBudgetScope };

// Lot 28a (BUD-02, décision D4) — enveloppe du client : son budget souhaité, ou
// à défaut le total de la simulation ; seuil d'alerte en pourcentage, celui de
// l'événement s'il en a un, sinon celui de l'organisation.
export type BudgetEnvelope = {
  amountCents: number;
  source: "wanted" | "simulation";
  thresholdPercent: number;
  thresholdCents: number;
  committedPercent: number;
  exceeded: boolean;
};

export type BudgetAlertSettings = {
  organizationPercent: number;
  // Seuil propre à l'événement ; null = celui de l'organisation.
  eventPercent: number | null;
};

// Lot 28a (BUD-02) — « l'alerte précède l'engagement » : l'effet d'un
// engagement sur l'enveloppe, calculé avant de le faire.
export type EngagementPreview = {
  envelope: BudgetEnvelope | null;
  committedAfterCents: number;
  exceedsThreshold: boolean;
  overThresholdCents: number;
};

export type ConfirmEventBudgetInput = {
  organizationId: string;
  eventId: string;
  confirmedByUserId: string;
};

export type UpdateBudgetLineInput = {
  organizationId: string;
  eventId: string;
  // La ligne visée ; à défaut, la première ligne de la catégorie (créée au besoin).
  lineId?: string;
  eventVendorSlotId?: string;
  field: BudgetAmountField;
  amountCents: number;
  changedByUserId: string;
};

export type BudgetLineHistoryEntry = {
  field: BudgetAmountField;
  oldValueCents: number | null;
  newValueCents: number;
  changedByUserId: string;
  changedAt: string;
};

export interface BudgetServiceContract {
  listAllocationModels(organizationId: string): Promise<AllocationModel[]>;
  createAllocationModel(input: CreateAllocationModelInput): Promise<AllocationModel>;
  removeAllocationModel(organizationId: string, modelId: string): Promise<void>;
  getEventBudget(organizationId: string, eventId: string): Promise<EventBudgetView | null>;
  simulateEventBudget(input: SimulateEventBudgetInput): Promise<EventBudgetView>;
  adjustEventBudgetItem(input: AdjustEventBudgetItemInput): Promise<EventBudgetView>;
  listBudgetLines(organizationId: string, eventId: string): Promise<BudgetLinesView>;
  confirmEventBudget(input: ConfirmEventBudgetInput): Promise<BudgetLinesView>;
  updateBudgetLine(input: UpdateBudgetLineInput): Promise<BudgetLinesView>;
  // Historique des lignes d'une catégorie.
  listBudgetLineHistory(organizationId: string, eventVendorSlotId: string): Promise<BudgetLineHistoryEntry[]>;
  addBudgetLine(input: AddBudgetLineInput): Promise<BudgetLinesView>;
  updateBudgetLineDetails(input: UpdateBudgetLineDetailsInput): Promise<BudgetLinesView>;
  removeBudgetLine(organizationId: string, eventId: string, lineId: string): Promise<BudgetLinesView>;
  addVendorPayment(input: VendorPaymentInput): Promise<BudgetLinesView>;
  updateVendorPayment(input: VendorPaymentInput & { paymentId: string }): Promise<BudgetLinesView>;
  setVendorPaymentPaid(input: { organizationId: string; eventId: string; paymentId: string; paidOn: string | null; changedByUserId: string }): Promise<BudgetLinesView>;
  removeVendorPayment(input: { organizationId: string; eventId: string; paymentId: string; changedByUserId: string }): Promise<BudgetLinesView>;
  listUpcomingVendorPayments(organizationId: string, today: string): Promise<UpcomingVendorPayment[]>;
  attachBudgetLineQuote(input: AttachBudgetLineQuoteInput): Promise<BudgetLineAttachment>;
  // ADR 0027 — servi par l'app (jamais de lien direct vers le stockage).
  getBudgetLineAttachmentFile(organizationId: string, attachmentId: string): Promise<FileDownload>;
  // PRD-BUD-04, lot 26a (POR-01, POR-10) : lecture seule pour un lien personnel
  // dont la rubrique « Budget » est ouverte ; en « catégories choisies », ses
  // seules catégories, totaux limités à elles.
  getLinkBudgetView(organizationId: string, linkId: string): Promise<LinkBudgetView>;
  // AIDE-02 : purge des données budget d'événements d'essai.
  removeEventBudgetData(organizationId: string, eventIds: string[]): Promise<void>;
}
