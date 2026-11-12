// Porte d'entrée publique du module budget — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/budget si ce module est extrait en app autonome.
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
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
  deleteEventAlertThreshold,
  findAlertThresholds,
  findEventBudget,
  insertAllocationModel,
  setBudgetLineAmount,
  upsertAlertThreshold,
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
  envelopeThresholdCents,
  remainingToPayCents,
  shareOfEnvelopePercent,
  isModelTotalValid,
  remainingToAllocateCents,
  sumAmountCents,
} from "./allocation";
import { QUOTE_MAX_SIZE_BYTES, quoteUploadError } from "./attachments";
import {
  getEvent,
  hasActiveClientAccess,
  listDefaultVendorSlots,
  listEventVendorSlots,
  EventNotFoundError,
  type EventVendorSlot,
} from "@/modules/events/service";
import { starterBudgetAlertThreshold } from "@symbola/starter-templates";
import type {
  AdjustEventBudgetItemInput,
  AllocationModel,
  AttachBudgetLineQuoteInput,
  BudgetAlertSettings,
  BudgetEnvelope,
  EngagementPreview,
  BudgetLine,
  BudgetLineAttachment,
  BudgetLineHistoryEntry,
  BudgetLinesView,
  BudgetServiceContract,
  ConfirmEventBudgetInput,
  CreateAllocationModelInput,
  EventBudgetView,
  FileDownload,
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

// PRD-BUD-03 : un devis se joint à une ligne existante du budget de cet événement.
export class BudgetLineNotFoundError extends Error {
  constructor() {
    super("ligne de budget introuvable pour ce poste");
    this.name = "BudgetLineNotFoundError";
  }
}

// PRD-BUD-04 : accès du marié absent, retiré, ou demande hors de son
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

// PRD-BUD-01→PRD-BUD-02 : la simulation (postes par défaut de l'organisation) ne
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
  const { varianceCents, variancePercent } = computeVariance(line.estimatedAmountCents, line.committedAmountCents);
  return {
    eventVendorSlotId: line.eventVendorSlotId,
    label,
    estimatedAmountCents: line.estimatedAmountCents,
    quotedAmountCents: line.quotedAmountCents,
    committedAmountCents: line.committedAmountCents,
    paidAmountCents: line.paidAmountCents,
    remainingAmountCents: remainingToPayCents(line.committedAmountCents, line.paidAmountCents),
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
  // Lignes dans l'ordre des postes de l'événement (celui de sa fiche) : la
  // requête n'en garantit aucun.
  const slotOrder = new Map(vendorSlots.map((slot, index) => [slot.id, index]));
  const mapped = [...lines]
    .sort((a, b) => (slotOrder.get(a.eventVendorSlotId) ?? Infinity) - (slotOrder.get(b.eventVendorSlotId) ?? Infinity))
    .map((line) => toBudgetLine(line, labelOf.get(line.eventVendorSlotId) ?? line.eventVendorSlotId, attachments));
  const total = (pick: (line: BudgetLine) => number | null) => mapped.reduce((sum, line) => sum + (pick(line) ?? 0), 0);
  const totalCommittedCents = total((line) => line.committedAmountCents);
  return {
    eventId,
    lines: mapped,
    totalEstimatedCents: total((line) => line.estimatedAmountCents),
    totalQuotedCents: total((line) => line.quotedAmountCents),
    totalCommittedCents,
    totalPaidCents: total((line) => line.paidAmountCents),
    totalRemainingCents: total((line) => line.remainingAmountCents),
    totalVarianceCents: total((line) => line.varianceCents),
    envelope: await budgetEnvelope(organizationId, eventId, totalCommittedCents),
  };
}

// Lot 28a (BUD-02, décision D4) — seuil d'alerte : celui de l'événement, sinon
// celui de l'organisation, sinon la valeur de départ des modèles.
export async function getBudgetAlertSettings(organizationId: string, eventId: string | null = null): Promise<BudgetAlertSettings> {
  const stored = await findAlertThresholds(organizationId, eventId);
  return { organizationPercent: stored.organization ?? starterBudgetAlertThreshold(), eventPercent: stored.event };
}

export class AlertThresholdInvalidError extends Error {
  constructor() {
    super("le seuil d'alerte doit être un pourcentage entier entre 1 et 500");
    this.name = "AlertThresholdInvalidError";
  }
}

function assertPercent(percent: number): void {
  if (!Number.isInteger(percent) || percent < 1 || percent > 500) throw new AlertThresholdInvalidError();
}

export async function setOrganizationAlertThreshold(organizationId: string, percent: number): Promise<void> {
  assertPercent(percent);
  await upsertAlertThreshold(organizationId, null, percent);
}

// null : l'événement reprend le seuil de l'organisation.
export async function setEventAlertThreshold(organizationId: string, eventId: string, percent: number | null): Promise<void> {
  if (percent === null) return deleteEventAlertThreshold(organizationId, eventId);
  assertPercent(percent);
  const event = await getEvent(organizationId, eventId);
  if (!event) throw new EventNotFoundError();
  await upsertAlertThreshold(organizationId, eventId, percent);
}

// Enveloppe du client : son budget souhaité, sinon le total de la simulation.
async function budgetEnvelope(organizationId: string, eventId: string, committedCents: number): Promise<BudgetEnvelope | null> {
  const [event, simulation, settings] = await Promise.all([
    getEvent(organizationId, eventId),
    findEventBudget(organizationId, eventId),
    getBudgetAlertSettings(organizationId, eventId),
  ]);
  const wanted = event?.wantedBudgetCents ?? null;
  const amountCents = wanted ?? simulation?.budget.totalAmountCents ?? null;
  if (amountCents === null || amountCents <= 0) return null;
  const thresholdPercent = settings.eventPercent ?? settings.organizationPercent;
  const thresholdCents = envelopeThresholdCents(amountCents, thresholdPercent);
  return {
    amountCents,
    source: wanted !== null ? "wanted" : "simulation",
    thresholdPercent,
    thresholdCents,
    committedPercent: shareOfEnvelopePercent(committedCents, amountCents),
    exceeded: committedCents > thresholdCents,
  };
}

// Lot 28a (BUD-02) — « l'alerte précède l'engagement » : l'engagé total si la
// ligne du poste était engagée pour ce montant, comparé au seuil.
export async function previewEngagement(input: { organizationId: string; eventId: string; eventVendorSlotId: string; amountCents: number }): Promise<EngagementPreview> {
  const lines = await findBudgetLines(input.organizationId, input.eventId);
  const others = lines.filter((line) => line.eventVendorSlotId !== input.eventVendorSlotId).reduce((sum, line) => sum + (line.committedAmountCents ?? 0), 0);
  const committedAfterCents = others + input.amountCents;
  const envelope = await budgetEnvelope(input.organizationId, input.eventId, committedAfterCents);
  const overThresholdCents = envelope ? Math.max(0, committedAfterCents - envelope.thresholdCents) : 0;
  return { envelope, committedAfterCents, exceedsThreshold: overThresholdCents > 0, overThresholdCents };
}

export async function listBudgetLines(organizationId: string, eventId: string): Promise<BudgetLinesView> {
  const lines = await findBudgetLines(organizationId, eventId);
  return toBudgetLinesView(organizationId, eventId, lines);
}

// PRD-BUD-01→PRD-BUD-02 : accepte la proposition « en faire le budget prévu »
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
      field: "estimated",
      amountCents: match.amountCents,
      changedByUserId: input.confirmedByUserId,
    });
  }

  return listBudgetLines(input.organizationId, input.eventId);
}

// PRD-BUD-02 : modification à la main de « prévu » ou « réel » sur un poste —
// crée la ligne si elle n'existe pas encore (un événement peut recevoir
// un budget réel sans être jamais passé par la simulation).
export async function updateBudgetLine(input: UpdateBudgetLineInput): Promise<BudgetLinesView> {
  // Montants en centimes entiers, positifs ou nuls (CLAUDE.md § 5), quelle que soit l'entrée.
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new RangeError("le montant doit être un nombre entier positif de centimes");
  }
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

// Lot 3 (PRD-BUD-02) : gestionnaire de events.vendor_slot.booked, appelé par le
// worker continu des événements internes (lib/event-worker.ts).
// Sûr au rejeu : si le montant réel de la ligne a été modifié après
// l'événement (à la main, ou par un événement plus récent), il n'est pas
// écrasé. Indispensable au premier démarrage du worker, qui traite aussi les
// événements publiés avant lui.
export async function applyVendorSlotBookedToBudget(
  organizationId: string,
  payload: VendorSlotBookedPayload,
  occurredAt?: Date,
): Promise<void> {
  if (payload.amountCents === null) return;
  // Lot 12 (L12-EVT-17) : le budget existe dès la création de l'événement ; une
  // réservation crée la ligne (réel connu, prévu encore vide) si besoin.
  const existing = await findBudgetLineByEventVendorSlotId(organizationId, payload.vendorSlotId);
  if (existing && occurredAt) {
    const history = await findBudgetLineHistory(organizationId, existing.id);
    if (history.some((row) => row.field === "committed" && row.changedAt.getTime() > occurredAt.getTime())) return;
  }

  // Lot 28a (PRE-02, BUD-01) : « Retenu » engage la ligne au montant du devis ;
  // le devisé le reprend s'il n'a pas encore été saisi.
  await setBudgetLineAmount({
    organizationId,
    eventId: payload.eventId,
    eventVendorSlotId: payload.vendorSlotId,
    field: "committed",
    amountCents: payload.amountCents,
    changedByUserId: payload.bookedByUserId,
  });
  if (existing?.quotedAmountCents == null) {
    await setBudgetLineAmount({
      organizationId,
      eventId: payload.eventId,
      eventVendorSlotId: payload.vendorSlotId,
      field: "quoted",
      amountCents: payload.amountCents,
      changedByUserId: payload.bookedByUserId,
    });
  }
}

// PRD-BUD-03 — devis prestataire joint : mêmes règles que l'envoi de fichier
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
// Devis joint lu dans le stockage privé et servi par l'app (ADR 0027).
export async function getBudgetLineAttachmentFile(organizationId: string, attachmentId: string): Promise<FileDownload> {
  const attachment = await findBudgetLineAttachment(organizationId, attachmentId);
  if (!attachment) throw new BudgetLineAttachmentNotFoundError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), attachment.fileKey);
    const extension = attachment.fileKey.split(".").pop() ?? "bin";
    return { data, contentType: attachment.mime, fileName: `devis-prestataire-${attachment.id}.${extension}` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new BudgetLineAttachmentNotFoundError();
    throw error;
  }
}

// PRD-BUD-04 — le budget vu par le marié, en lecture seule : l'accès à
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

// IMP-05 — fonctions d'import (lot 5, ADR 0022).
export {
  findModifiedImportedBudgetElements,
  importBudgetLineRows,
  undoImportedBudgetElements,
} from "./import";

// Lot 6 — contrat privacy/v1 du module (ADR 0023).
export { budgetPrivacy } from "./privacy";

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
  getBudgetLineAttachmentFile,
  getClientBudgetView,
  removeEventBudgetData,
};
void _contractCheck;
