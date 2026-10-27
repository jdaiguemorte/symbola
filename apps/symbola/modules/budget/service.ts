// Porte d'entrée publique du module budget — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/budget si ce module est extrait en app autonome.
import { createStorageClient, deletePrivateObject, getSignedDownloadUrl, uploadFile } from "@symbola/files";
import {
  deleteEventBudgetRows,
  findBudgetLineAttachment,
  findBudgetLineAttachments,
  insertBudgetLineAttachment,
  type BudgetLineAttachmentRow,
  deleteAllocationModel,
  findAllocationModels,
  findBudgetLineByEventVendorSlotId,
  findBudgetLineHistory,
  findBudgetLines,
  findEventBudget,
  insertAllocationModel,
  setBudgetLineAmount,
  updateEventBudgetItemAmount,
  upsertEventBudget,
  type AllocationModelItemRow,
  type AllocationModelRow,
  type BudgetLineRow,
  type EventBudgetItemRow,
  type EventBudgetRow,
} from "./repository";
import {
  allocateFromModel,
  computeVariance,
  costPerGuestCents,
  isModelTotalValid,
  remainingToAllocateCents,
  sumAmountCents,
} from "./allocation";
import { QUOTE_LINK_TTL_SECONDS, QUOTE_MAX_SIZE_BYTES, quoteUploadError } from "./attachments";
import {
  getEvent,
  hasActiveClientAccess,
  listDefaultVendorSlots,
  listEventVendorSlots,
  EventNotFoundError,
  type EventVendorSlot,
} from "@/modules/events/service";
import type {
  AdjustEventBudgetItemInput,
  AllocationModel,
  AttachBudgetLineQuoteInput,
  BudgetLine,
  BudgetLineAttachment,
  BudgetLineHistoryEntry,
  BudgetLinesView,
  BudgetServiceContract,
  ConfirmEventBudgetInput,
  CreateAllocationModelInput,
  EventBudgetView,
  SimulateEventBudgetInput,
  UpdateBudgetLineInput,
  VendorSlotBookedPayload,
} from "@symbola/contracts";

export type {
  AdjustEventBudgetItemInput,
  AllocationModel,
  AllocationModelItem,
  AllocationModelItemInput,
  AttachBudgetLineQuoteInput,
  BudgetLine,
  BudgetLineAttachment,
  BudgetLineHistoryEntry,
  BudgetLinesView,
  BudgetServiceContract,
  ConfirmEventBudgetInput,
  CreateAllocationModelInput,
  EventBudgetItem,
  EventBudgetView,
  SimulateEventBudgetInput,
  UpdateBudgetLineInput,
} from "@symbola/contracts";
export { EventNotFoundError };
export {
  QUOTE_MAX_SIZE_BYTES,
  QuoteFileInfectedError,
  QuoteFileTooLargeError,
  QuoteFileUnsupportedTypeError,
} from "./attachments";

// BUD-03 : un devis se joint à une ligne existante du budget de cet événement.
export class BudgetLineNotFoundError extends Error {
  constructor() {
    super("ligne de budget introuvable pour ce poste");
    this.name = "BudgetLineNotFoundError";
  }
}

// BUD-04 : accès du marié absent, retiré, ou demande hors de son
// événement — même réponse dans tous les cas.
export class ClientBudgetAccessDeniedError extends Error {
  constructor() {
    super("accès refusé");
    this.name = "ClientBudgetAccessDeniedError";
  }
}

export class BudgetLineAttachmentNotFoundError extends Error {
  constructor() {
    super("devis introuvable");
    this.name = "BudgetLineAttachmentNotFoundError";
  }
}

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

export class EventVendorSlotNotFoundError extends Error {
  constructor(eventVendorSlotId: string) {
    super(`poste de l'événement introuvable : ${eventVendorSlotId}`);
    this.name = "EventVendorSlotNotFoundError";
  }
}

// BUD-01→BUD-02 : la simulation (postes par défaut de l'organisation) ne
// peut devenir le budget réel (postes de l'événement, voir
// docs/lots/lot-3-budget.md) que si chaque poste simulé se retrouve, par
// label, parmi les postes de l'événement.
export class BudgetSimulationMismatchError extends Error {
  constructor(labels: string[]) {
    super(`postes de la simulation sans correspondance sur l'événement : ${labels.join(", ")}`);
    this.name = "BudgetSimulationMismatchError";
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

function toBudgetLineAttachment(row: BudgetLineAttachmentRow): BudgetLineAttachment {
  return { id: row.id, mime: row.mime, sizeBytes: row.sizeBytes, createdAt: row.createdAt.toISOString() };
}

function toBudgetLine(line: BudgetLineRow, label: string, attachments: BudgetLineAttachmentRow[]): BudgetLine {
  const { varianceCents, variancePercent } = computeVariance(line.plannedAmountCents, line.actualAmountCents);
  return {
    eventVendorSlotId: line.eventVendorSlotId,
    label,
    plannedAmountCents: line.plannedAmountCents,
    actualAmountCents: line.actualAmountCents,
    varianceCents,
    variancePercent,
    attachments: attachments.filter((attachment) => attachment.lineId === line.id).map(toBudgetLineAttachment),
  };
}

async function toBudgetLinesView(
  organizationId: string,
  eventId: string,
  lines: BudgetLineRow[],
): Promise<BudgetLinesView> {
  const [vendorSlots, attachments]: [EventVendorSlot[], BudgetLineAttachmentRow[]] = await Promise.all([
    listEventVendorSlots(organizationId, eventId),
    findBudgetLineAttachments(
      organizationId,
      lines.map((line) => line.id),
    ),
  ]);
  const labelOf = new Map(vendorSlots.map((slot) => [slot.id, slot.label]));
  const mapped = lines.map((line) =>
    toBudgetLine(line, labelOf.get(line.eventVendorSlotId) ?? line.eventVendorSlotId, attachments),
  );
  return {
    eventId,
    lines: mapped,
    totalPlannedCents: mapped.reduce((sum, line) => sum + line.plannedAmountCents, 0),
    totalActualCents: mapped.reduce((sum, line) => sum + (line.actualAmountCents ?? 0), 0),
    totalVarianceCents: mapped.reduce((sum, line) => sum + (line.varianceCents ?? 0), 0),
  };
}

export async function listBudgetLines(organizationId: string, eventId: string): Promise<BudgetLinesView> {
  const lines = await findBudgetLines(organizationId, eventId);
  return toBudgetLinesView(organizationId, eventId, lines);
}

// BUD-01→BUD-02 : accepte la proposition « en faire le budget prévu »
// (bandeau sur /events/[id] quand l'événement est confirmé). Rapproche
// chaque poste de la simulation (clé sur default_vendor_slot_id) avec le
// poste correspondant de l'événement (clé sur event_vendor_slot_id), par
// label — voir docs/lots/lot-3-budget.md.
export async function confirmEventBudget(input: ConfirmEventBudgetInput): Promise<BudgetLinesView> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();

  const simulation = await findEventBudget(input.organizationId, input.eventId);
  if (!simulation) throw new EventBudgetNotFoundError();

  const defaultSlots = await listDefaultVendorSlots(input.organizationId);
  const defaultLabelOf = new Map(defaultSlots.map((slot) => [slot.id, slot.label]));

  const eventSlots: EventVendorSlot[] = await listEventVendorSlots(input.organizationId, input.eventId);
  const eventSlotIdByLabel = new Map(eventSlots.map((slot) => [slot.label, slot.id]));

  const unmatchedLabels: string[] = [];
  const matches: { eventVendorSlotId: string; amountCents: number }[] = [];
  for (const item of simulation.items) {
    const label = defaultLabelOf.get(item.defaultVendorSlotId) ?? item.defaultVendorSlotId;
    const eventVendorSlotId = eventSlotIdByLabel.get(label);
    if (!eventVendorSlotId) {
      unmatchedLabels.push(label);
      continue;
    }
    matches.push({ eventVendorSlotId, amountCents: item.amountCents });
  }
  if (unmatchedLabels.length > 0) throw new BudgetSimulationMismatchError(unmatchedLabels);

  for (const match of matches) {
    await setBudgetLineAmount({
      organizationId: input.organizationId,
      eventId: input.eventId,
      eventVendorSlotId: match.eventVendorSlotId,
      field: "planned",
      amountCents: match.amountCents,
      changedByUserId: input.confirmedByUserId,
    });
  }

  return listBudgetLines(input.organizationId, input.eventId);
}

// BUD-02 : modification à la main de « prévu » ou « réel » sur un poste —
// crée la ligne si elle n'existe pas encore (un événement peut recevoir
// un budget réel sans être jamais passé par la simulation).
export async function updateBudgetLine(input: UpdateBudgetLineInput): Promise<BudgetLinesView> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();

  const eventSlots: EventVendorSlot[] = await listEventVendorSlots(input.organizationId, input.eventId);
  if (!eventSlots.some((slot) => slot.id === input.eventVendorSlotId)) {
    throw new EventVendorSlotNotFoundError(input.eventVendorSlotId);
  }

  await setBudgetLineAmount({
    organizationId: input.organizationId,
    eventId: input.eventId,
    eventVendorSlotId: input.eventVendorSlotId,
    field: input.field,
    amountCents: input.amountCents,
    changedByUserId: input.changedByUserId,
  });

  return listBudgetLines(input.organizationId, input.eventId);
}

export async function listBudgetLineHistory(
  organizationId: string,
  eventVendorSlotId: string,
): Promise<BudgetLineHistoryEntry[]> {
  const line = await findBudgetLineByEventVendorSlotId(organizationId, eventVendorSlotId);
  if (!line) return [];
  const rows = await findBudgetLineHistory(organizationId, line.id);
  return rows.map((row) => ({
    field: row.field,
    oldValueCents: row.oldValueCents,
    newValueCents: row.newValueCents,
    changedByUserId: row.changedByUserId,
    changedAt: row.changedAt.toISOString(),
  }));
}

// Lot 3 (BUD-02) : gestionnaire de events.vendor_slot.booked — pas encore
// câblé à un worker continu dans l'app qui tourne (écart pré-existant,
// voir docs/lots/lot-3-budget.md). Appelé directement par les tests
// d'intégration ; prêt à être enregistré auprès de
// packages/db/src/events/worker.ts le jour où ce worker sera invoqué en
// continu. Ignore silencieusement si aucune ligne de budget n'existe
// encore pour ce poste (suivi budgétaire pas commencé pour cet
// événement) — ce n'est pas une erreur, juste rien à mettre à jour.
export async function applyVendorSlotBookedToBudget(
  organizationId: string,
  payload: VendorSlotBookedPayload,
): Promise<void> {
  if (payload.amountCents === null) return;
  const existing = await findBudgetLineByEventVendorSlotId(organizationId, payload.vendorSlotId);
  if (!existing) return;

  await setBudgetLineAmount({
    organizationId,
    eventId: payload.eventId,
    eventVendorSlotId: payload.vendorSlotId,
    field: "actual",
    amountCents: payload.amountCents,
    changedByUserId: payload.bookedByUserId,
  });
}

// BUD-03 — devis prestataire joint : mêmes règles que l'envoi de fichier
// du socle (type vérifié par le contenu, antivirus, stockage privé), via
// @symbola/files. Refus clair, sans rien enregistrer, à chaque étape.
export async function attachBudgetLineQuote(input: AttachBudgetLineQuoteInput): Promise<BudgetLineAttachment> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  const line = await findBudgetLineByEventVendorSlotId(input.organizationId, input.eventVendorSlotId);
  if (!line || line.eventId !== input.eventId) throw new BudgetLineNotFoundError();

  const upload = await uploadFile({
    organizationId: input.organizationId,
    buffer: Buffer.from(input.content),
    maxSizeBytes: QUOTE_MAX_SIZE_BYTES,
  });
  if (upload.status === "rejected") throw quoteUploadError(upload);

  const row = await insertBudgetLineAttachment({
    organizationId: input.organizationId,
    lineId: line.id,
    fileKey: upload.key,
    mime: upload.mime,
    sizeBytes: upload.size,
    uploadedByUserId: input.uploadedByUserId,
  });
  return toBudgetLineAttachment(row);
}

// Lien signé à durée limitée, demandé au moment de l'ouverture — jamais
// stocké ni affiché d'avance.
export async function getBudgetLineAttachmentUrl(organizationId: string, attachmentId: string): Promise<string> {
  const attachment = await findBudgetLineAttachment(organizationId, attachmentId);
  if (!attachment) throw new BudgetLineAttachmentNotFoundError();
  return getSignedDownloadUrl(createStorageClient(), attachment.fileKey, QUOTE_LINK_TTL_SECONDS);
}

// BUD-04 — le budget vu par le marié, en lecture seule : l'accès à
// l'événement est vérifié par le module events avant toute lecture. Seules
// les colonnes publiques (poste, prévu, réel, écart, totaux) : les devis
// joints restent des documents de travail de la planner.
export async function getClientBudgetView(
  organizationId: string,
  userId: string,
  eventId: string,
): Promise<BudgetLinesView> {
  if (!(await hasActiveClientAccess(organizationId, userId, eventId))) throw new ClientBudgetAccessDeniedError();
  const view = await listBudgetLines(organizationId, eventId);
  return { ...view, lines: view.lines.map((line) => ({ ...line, attachments: [] })) };
}

// AIDE-02 — appelé à la fin d'un essai guidé (et pour un essai expiré),
// avant la suppression de l'événement fictif : aucune donnée budget ni
// aucun devis stocké ne doit lui survivre.
export async function removeEventBudgetData(organizationId: string, eventIds: string[]): Promise<void> {
  const fileKeys = await deleteEventBudgetRows(organizationId, eventIds);
  if (fileKeys.length === 0) return;
  const storage = createStorageClient();
  for (const key of fileKeys) await deletePrivateObject(storage, key);
}

const _contractCheck: BudgetServiceContract = {
  listAllocationModels,
  createAllocationModel,
  removeAllocationModel,
  getEventBudget,
  simulateEventBudget,
  adjustEventBudgetItem,
  listBudgetLines,
  confirmEventBudget,
  updateBudgetLine,
  listBudgetLineHistory,
  attachBudgetLineQuote,
  getBudgetLineAttachmentUrl,
  getClientBudgetView,
  removeEventBudgetData,
};
void _contractCheck;
