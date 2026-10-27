// Interface du service.ts de budget (SOC-06) — pensée comme le futur
// contrat HTTP /v1/budget si ce module est extrait en app autonome (ADR
// 0011). apps/symbola vérifie que le vrai module satisfait ce type (test
// de contrat, apps/symbola/modules/budget/service.contract.test.ts).
//
// BUD-01 uniquement : modèles de répartition, simulation pour un
// prospect. Les montants sont toujours des centimes entiers EUR, les
// pourcentages des points de base entiers (0 à 10000 = 0,00 % à 100,00 %)
// — jamais de float (CLAUDE.md §5).

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

// BUD-02 — budget réel (prévu/réel/écart), une ligne par poste de
// l'événement (events.event_vendor_slots, pas default_vendor_slots : voir
// docs/lots/lot-3-budget.md). Écart et pourcentage dérivés, jamais
// stockés ; null tant qu'aucun montant réel n'est renseigné.
export type BudgetLine = {
  eventVendorSlotId: string;
  label: string;
  plannedAmountCents: number;
  actualAmountCents: number | null;
  varianceCents: number | null;
  variancePercent: number | null;
  // BUD-03 : devis prestataires joints à la ligne.
  attachments: BudgetLineAttachment[];
};

// BUD-03 — devis prestataire joint. Jamais d'URL dans la vue : le fichier
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
  totalPlannedCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
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
  field: "planned" | "actual";
  amountCents: number;
  changedByUserId: string;
};

export type BudgetLineHistoryEntry = {
  field: "planned" | "actual";
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
  getBudgetLineAttachmentUrl(organizationId: string, attachmentId: string): Promise<string>;
}
