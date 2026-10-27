// Porte d'entrée publique du module budget — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/budget si ce module est extrait en app autonome.
import {
  deleteAllocationModel,
  findAllocationModels,
  findEventBudget,
  insertAllocationModel,
  updateEventBudgetItemAmount,
  upsertEventBudget,
  type AllocationModelItemRow,
  type AllocationModelRow,
  type EventBudgetItemRow,
  type EventBudgetRow,
} from "./repository";
import { allocateFromModel, costPerGuestCents, isModelTotalValid, remainingToAllocateCents, sumAmountCents } from "./allocation";
import { getEvent, listDefaultVendorSlots, EventNotFoundError } from "@/modules/events/service";
import type {
  AdjustEventBudgetItemInput,
  AllocationModel,
  BudgetServiceContract,
  CreateAllocationModelInput,
  EventBudgetView,
  SimulateEventBudgetInput,
} from "@symbola/contracts";

export type { AllocationModel, AllocationModelItem, AllocationModelItemInput, BudgetServiceContract, CreateAllocationModelInput, EventBudgetItem, EventBudgetView, SimulateEventBudgetInput, AdjustEventBudgetItemInput } from "@symbola/contracts";
export { EventNotFoundError };

export class AllocationModelTotalInvalidError extends Error {
  constructor() {
    super("le total des pourcentages du modèle doit faire exactement 100 %");
    this.name = "AllocationModelTotalInvalidError";
  }
}

export class DefaultVendorSlotNotFoundError extends Error {
  constructor(defaultVendorSlotId: string) {
    super(`poste prestataire introuvable : ${defaultVendorSlotId}`);
    this.name = "DefaultVendorSlotNotFoundError";
  }
}

export class AllocationModelNotFoundError extends Error {
  constructor() {
    super("modèle de répartition introuvable");
    this.name = "AllocationModelNotFoundError";
  }
}

// Distinct d'EventNotFoundError : l'événement existe bien, mais n'a pas
// encore de simulation (aucun appel à simulateEventBudget).
export class EventBudgetNotFoundError extends Error {
  constructor() {
    super("aucune simulation de budget pour cet événement");
    this.name = "EventBudgetNotFoundError";
  }
}

async function assertDefaultVendorSlotsExist(organizationId: string, defaultVendorSlotIds: string[]): Promise<void> {
  const slots = await listDefaultVendorSlots(organizationId);
  const knownIds = new Set(slots.map((slot) => slot.id));
  for (const id of defaultVendorSlotIds) {
    if (!knownIds.has(id)) throw new DefaultVendorSlotNotFoundError(id);
  }
}

function toAllocationModel(row: AllocationModelRow, items: AllocationModelItemRow[]): AllocationModel {
  return {
    id: row.id,
    name: row.name,
    items: items.map((item) => ({
      id: item.id,
      defaultVendorSlotId: item.defaultVendorSlotId,
      percentageBasisPoints: item.percentageBasisPoints,
    })),
  };
}

function toEventBudgetView(budget: EventBudgetRow, items: EventBudgetItemRow[]): EventBudgetView {
  const mappedItems = items.map((item) => ({
    defaultVendorSlotId: item.defaultVendorSlotId,
    amountCents: item.amountCents,
  }));
  return {
    eventId: budget.eventId,
    totalAmountCents: budget.totalAmountCents,
    guestCount: budget.guestCount,
    allocationModelId: budget.allocationModelId,
    items: mappedItems,
    allocatedCents: sumAmountCents(mappedItems),
    remainingCents: remainingToAllocateCents(budget.totalAmountCents, mappedItems),
    costPerGuestCents: costPerGuestCents(budget.totalAmountCents, budget.guestCount),
  };
}

export async function listAllocationModels(organizationId: string): Promise<AllocationModel[]> {
  const rows = await findAllocationModels(organizationId);
  return rows.map(({ model, items }) => toAllocationModel(model, items));
}

export async function createAllocationModel(input: CreateAllocationModelInput): Promise<AllocationModel> {
  if (!isModelTotalValid(input.items)) throw new AllocationModelTotalInvalidError();
  await assertDefaultVendorSlotsExist(
    input.organizationId,
    input.items.map((item) => item.defaultVendorSlotId),
  );
  const { model, items } = await insertAllocationModel(input.organizationId, input.name, input.items);
  return toAllocationModel(model, items);
}

export async function removeAllocationModel(organizationId: string, modelId: string): Promise<void> {
  await deleteAllocationModel(organizationId, modelId);
}

export async function getEventBudget(organizationId: string, eventId: string): Promise<EventBudgetView | null> {
  const result = await findEventBudget(organizationId, eventId);
  if (!result) return null;
  return toEventBudgetView(result.budget, result.items);
}

export async function simulateEventBudget(input: SimulateEventBudgetInput): Promise<EventBudgetView> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();

  const models = await findAllocationModels(input.organizationId);
  const model = models.find(({ model }) => model.id === input.allocationModelId);
  if (!model) throw new AllocationModelNotFoundError();

  const items = allocateFromModel(
    input.totalAmountCents,
    model.items.map((item) => ({
      defaultVendorSlotId: item.defaultVendorSlotId,
      percentageBasisPoints: item.percentageBasisPoints,
    })),
  );

  const { budget, items: savedItems } = await upsertEventBudget({
    organizationId: input.organizationId,
    eventId: input.eventId,
    totalAmountCents: input.totalAmountCents,
    guestCount: input.guestCount,
    allocationModelId: input.allocationModelId,
    items,
  });

  return toEventBudgetView(budget, savedItems);
}

export async function adjustEventBudgetItem(input: AdjustEventBudgetItemInput): Promise<EventBudgetView> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();

  const existing = await findEventBudget(input.organizationId, input.eventId);
  if (!existing) throw new EventBudgetNotFoundError();

  await assertDefaultVendorSlotsExist(input.organizationId, [input.defaultVendorSlotId]);

  await updateEventBudgetItemAmount({
    organizationId: input.organizationId,
    eventBudgetId: existing.budget.id,
    defaultVendorSlotId: input.defaultVendorSlotId,
    amountCents: input.amountCents,
  });

  const refreshed = await findEventBudget(input.organizationId, input.eventId);
  if (!refreshed) throw new EventBudgetNotFoundError();
  return toEventBudgetView(refreshed.budget, refreshed.items);
}

const _contractCheck: BudgetServiceContract = {
  listAllocationModels,
  createAllocationModel,
  removeAllocationModel,
  getEventBudget,
  simulateEventBudget,
  adjustEventBudgetItem,
};
void _contractCheck;
