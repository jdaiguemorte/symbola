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

export interface BudgetServiceContract {
  listAllocationModels(organizationId: string): Promise<AllocationModel[]>;
  createAllocationModel(input: CreateAllocationModelInput): Promise<AllocationModel>;
  removeAllocationModel(organizationId: string, modelId: string): Promise<void>;
  getEventBudget(organizationId: string, eventId: string): Promise<EventBudgetView | null>;
  simulateEventBudget(input: SimulateEventBudgetInput): Promise<EventBudgetView>;
  adjustEventBudgetItem(input: AdjustEventBudgetItemInput): Promise<EventBudgetView>;
}
