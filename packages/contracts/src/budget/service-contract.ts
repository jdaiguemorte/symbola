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

// Lot 28a (BUD-01, décision D2, ADR 0054) — cinq montants par ligne de budget,
// une ligne par poste de l'événement (events.event_vendor_slots). Le reste à
// payer (engagé moins payé) et l'écart à l'estimé (engagé moins estimé) se
// calculent, jamais stockés ; null tant que l'engagé n'est pas connu.
export const BUDGET_AMOUNT_FIELDS = ["estimated", "quoted", "committed", "paid"] as const;
export type BudgetAmountField = (typeof BUDGET_AMOUNT_FIELDS)[number];

export type BudgetLine = {
  eventVendorSlotId: string;
  label: string;
  estimatedAmountCents: number | null;
  quotedAmountCents: number | null;
  committedAmountCents: number | null;
  paidAmountCents: number | null;
  remainingAmountCents: number | null;
  varianceCents: number | null;
  variancePercent: number | null;
  // PRD-BUD-03 : devis prestataires joints à la ligne.
  attachments: BudgetLineAttachment[];
};

// PRD-BUD-03 — devis prestataire joint. Jamais d'URL dans la vue : le fichier
// s'ouvre par un lien signé temporaire demandé au moment de l'ouverture.
export type BudgetLineAttachment = {
  id: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
};

export type AttachBudgetLineQuoteInput = {
  organizationId: string;
  eventId: string;
  eventVendorSlotId: string;
  content: Uint8Array;
  uploadedByUserId: string;
};

export type BudgetLinesView = {
  eventId: string;
  lines: BudgetLine[];
  totalEstimatedCents: number;
  totalQuotedCents: number;
  totalCommittedCents: number;
  totalPaidCents: number;
  totalRemainingCents: number;
  totalVarianceCents: number;
  // Lot 28a (BUD-02) : null sans enveloppe (ni budget souhaité, ni simulation).
  envelope: BudgetEnvelope | null;
};

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
  eventVendorSlotId: string;
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
  listBudgetLineHistory(organizationId: string, eventVendorSlotId: string): Promise<BudgetLineHistoryEntry[]>;
  attachBudgetLineQuote(input: AttachBudgetLineQuoteInput): Promise<BudgetLineAttachment>;
  // ADR 0027 — servi par l'app (jamais de lien direct vers le stockage).
  getBudgetLineAttachmentFile(organizationId: string, attachmentId: string): Promise<FileDownload>;
  // PRD-BUD-04 : lecture seule pour un compte marié ayant accès à l'événement.
  getClientBudgetView(organizationId: string, userId: string, eventId: string): Promise<BudgetLinesView>;
  // AIDE-02 : purge des données budget d'événements d'essai.
  removeEventBudgetData(organizationId: string, eventIds: string[]): Promise<void>;
}
