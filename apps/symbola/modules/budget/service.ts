// Porte d'entrée publique du module budget — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/budget si ce module est extrait en app autonome.
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import {
  deleteBudgetLine,
  purgeBudgetLines,
  restoreBudgetLineRow,
  restoreEventBudgetRows,
  trashEventBudgetRows,
  deleteEventBudgetRows,
  deleteVendorPaymentRow,
  findBudgetLine,
  findBudgetLineAttachment,
  findBudgetLineAttachments,
  findBudgetLinesOfSlot,
  releaseCommittedAmount,
  findDueVendorPayments,
  findFirstBudgetLineOfSlot,
  findVendorPayment,
  findVendorPayments,
  insertBudgetLine,
  insertBudgetLineAttachment,
  insertVendorPayment,
  updateBudgetLineRow,
  updateVendorPaymentRow,
  cancelVendorPaymentDeclarationRow,
  declareVendorPaymentRow,
  findPendingDeclarationRows,
  recordDeclarationConfirmedRow,
  refuseVendorPaymentDeclarationRow,
  type BudgetLineAttachmentRow,
  type VendorPaymentRow,
  deleteAllocationModel,
  findAllocationModels,
  findBudgetLineHistory,
  findBudgetLines,
  deleteEventAlertThreshold,
  findAlertThresholds,
  findEventBudget,
  insertAllocationModel,
  setBudgetLineAmount,
  saveBudgetLineRows,
  updateEventBudgetItemAmounts,
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
import { addDaysTo, paymentAmountCents, paymentBaseCents, paymentStatus } from "./payments";
import { attachHandoverReceiptRow, findHandoverRows, handoverPaymentOfEvent, handoverValues, recordHandoverRow, setHandoverRow } from "./handovers";
import {
  getEvent,
  getEventNamesByIds,
  getVendorCandidate,
  getLinkAccess,
  listEventLinks,
  listDefaultVendorSlots,
  listEventVendorSlots,
  listVendorCandidates,
  EventNotFoundError,
  type EventVendorSlot,
} from "@/modules/events/service";
import { listEventInstalments, listEventQuotes } from "@/modules/quotes/service";
import { parisToday } from "@symbola/i18n";
import { withActor } from "@symbola/db/actor";
import { starterBudgetAlertThreshold, starterBudgetVatRateBasisPoints } from "@symbola/starter-templates";
import { budgetClientKind, htFromTtcCents, htTotalByRate } from "./vat";
import { lineReferenceAmount, splitAmongPayers, validateShares } from "./payers";
import { buildCashCalendar, type CashEntry } from "./cash-calendar";
import {
  deleteEventPayerRow,
  ensureCouplePayer,
  findEventPayers,
  findInstalmentPayers,
  findPayerShares,
  insertEventPayer,
  replaceLinePayerShares,
  setInstalmentPayerRow,
  setVendorPaymentPayerRow,
  updateEventPayerRow,
  type EventPayerRow,
} from "./payers-repository";
import { EVENT_PAYER_KINDS, type CashCalendarMonth, type EventPayer, type EventPayerKind, type PayerShareInput, type PayerShareView } from "@symbola/contracts";
import type {
  AddBudgetLineInput,
  AdjustEventBudgetItemInput,
  AdjustEventBudgetItemsInput,
  SaveBudgetLinesInput,
  DayHandover,
  VendorPaymentHandoverInput,
  AllocationModel,
  AttachBudgetLineQuoteInput,
  BudgetAlertSettings,
  BudgetCategory,
  BudgetHtTotals,
  BudgetEnvelope,
  EngagementPreview,
  BudgetLine,
  BudgetLineAttachment,
  BudgetLineHistoryEntry,
  BudgetLinesView,
  LinkBudgetView,
  LinkVendorPayment,
  PendingPaymentDeclaration,
  BudgetServiceContract,
  ConfirmEventBudgetInput,
  CreateAllocationModelInput,
  EventBudgetView,
  FileDownload,
  SimulateEventBudgetInput,
  UpcomingVendorPayment,
  UpdateBudgetLineDetailsInput,
  UpdateBudgetLineInput,
  VendorCandidate,
  VendorPayment,
  VendorPaymentInput,
  VendorSlotBookedPayload,
  VendorRetentionReleasedPayload,
} from "@symbola/contracts";
import { BUDGET_DOCUMENT_KINDS } from "@symbola/contracts";

export type {
  AdjustEventBudgetItemInput,
  AdjustEventBudgetItemsInput,
  SaveBudgetLinesInput,
  DayHandover,
  VendorPaymentHandoverInput,
  AllocationModel,
  AllocationModelItem,
  AllocationModelItemInput,
  AttachBudgetLineQuoteInput,
  BudgetLine,
  BudgetLineAttachment,
  BudgetLineHistoryEntry,
  BudgetLinesView,
  LinkBudgetView,
  LinkVendorPayment,
  PendingPaymentDeclaration,
  BudgetServiceContract,
  ConfirmEventBudgetInput,
  CreateAllocationModelInput,
  EventBudgetItem,
  EventBudgetView,
  SimulateEventBudgetInput,
  UpdateBudgetLineInput,
  BudgetCategory,
  BudgetDocumentKind,
  UpcomingVendorPayment,
  VendorPayment,
  VendorPaymentStatus,
} from "@symbola/contracts";
export { BUDGET_DOCUMENT_KINDS } from "@symbola/contracts";
// Lot 37b (DOC-12, ADR 0071) : la part du module au relevé de stockage.
export { measureBudgetStorage } from "./storage-usage";
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

// Lot 28b (D13) : le payé d'une ligne qui a des échéances ne se saisit plus.
export class BudgetLinePaidFromPaymentsError extends Error {
  constructor() {
    super("le payé de cette ligne vient de ses échéances");
    this.name = "BudgetLinePaidFromPaymentsError";
  }
}

// Lot 28b (BUD-01) : le prestataire d'une ligne est l'un des prestataires
// rattachés à sa catégorie ; le libellé d'une nouvelle ligne est obligatoire.
export class BudgetLineDetailsInvalidError extends Error {
  constructor(readonly reason: "label" | "vendor" | "vat") {
    super(reason === "label" ? "libellé de ligne obligatoire" : reason === "vendor" ? "prestataire hors de la catégorie" : "taux de TVA hors de 0 à 100 %");
    this.name = "BudgetLineDetailsInvalidError";
  }
}

// Lot 28b (BUD-03) : échéance invalide (libellé, montant ou pourcentage, date).
export class VendorPaymentInvalidError extends Error {
  constructor(readonly reason: "label" | "amount" | "date") {
    super(`échéance invalide : ${reason}`);
    this.name = "VendorPaymentInvalidError";
  }
}

// Lot 27a (D6) : une déclaration impossible (échéance payée, déjà déclarée, date
// ou moyen invalide, rien à annuler ou à traiter, motif de refus manquant).
export class VendorPaymentDeclarationError extends Error {
  constructor(readonly reason: "paid" | "declared" | "date" | "method" | "not_declared" | "reason") {
    super(`déclaration de règlement impossible : ${reason}`);
    this.name = "VendorPaymentDeclarationError";
  }
}

export class VendorPaymentNotFoundError extends Error {
  constructor() {
    super("échéance introuvable");
    this.name = "VendorPaymentNotFoundError";
  }
}

// PRD-BUD-04, lot 26a : lien absent, retiré, expiré ou sans la rubrique
// « Budget » — même réponse dans tous les cas.
export class LinkBudgetAccessDeniedError extends Error {
  constructor() {
    super("accès refusé");
    this.name = "LinkBudgetAccessDeniedError";
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

// Lot 62c (UX-13, décision D1) — la répartition s'enregistre d'un coup : tous les postes modifiés
// dans une seule transaction. Un poste inconnu ou un montant invalide refuse tout l'envoi.
export async function adjustEventBudgetItems(input: AdjustEventBudgetItemsInput): Promise<EventBudgetView> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  const existing = await findEventBudget(input.organizationId, input.eventId);
  if (!existing) throw new EventBudgetNotFoundError();
  const slotIds = input.items.map((item) => item.defaultVendorSlotId);
  if (new Set(slotIds).size !== slotIds.length) throw new RangeError("un poste est cité deux fois");
  if (input.items.some((item) => !Number.isInteger(item.amountCents) || item.amountCents < 0)) throw new RangeError("le montant doit être un nombre entier positif de centimes");
  await assertDefaultVendorSlotsExist(input.organizationId, slotIds);
  if (input.items.length > 0) await updateEventBudgetItemAmounts({ organizationId: input.organizationId, eventBudgetId: existing.budget.id, items: input.items });
  const refreshed = await findEventBudget(input.organizationId, input.eventId);
  if (!refreshed) throw new EventBudgetNotFoundError();
  return toEventBudgetView(refreshed.budget, refreshed.items);
}

function toBudgetLineAttachment(row: BudgetLineAttachmentRow): BudgetLineAttachment {
  return { id: row.id, kind: row.kind, mime: row.mime, sizeBytes: row.sizeBytes, createdAt: row.createdAt.toISOString() };
}

function toVendorPayment(row: VendorPaymentRow, line: BudgetLineRow, lines: BudgetLineRow[], today: string): VendorPayment {
  return {
    id: row.id,
    lineId: row.lineId,
    label: row.label,
    amountCents: paymentAmountCents(row, paymentBaseCents(line, lines)),
    fixedAmountCents: row.fixedAmountCents,
    percentageBasisPoints: row.percentageBasisPoints,
    dueOn: row.dueOn,
    paidOn: row.paidOn,
    status: paymentStatus(row, today),
    declaration:
      row.declaredAt && row.declaredPaidOn && row.declaredMethod && row.declaredByLinkId
        ? { paidOn: row.declaredPaidOn, method: row.declaredMethod, linkId: row.declaredByLinkId, declaredAt: row.declaredAt.toISOString() }
        : null,
    refusalReason: row.refusalReason,
    handover: row.handoverOnDay
      ? { method: row.handoverMethod, by: row.handoverBy, handedOverAt: row.handedOverAt?.toISOString() ?? null, handedOverBy: row.handedOverBy, receiptPhotoId: row.handoverReceiptPhotoId }
      : null,
    payerId: row.payerId,
  };
}

type LineContext = {
  lines: BudgetLineRow[];
  attachments: BudgetLineAttachmentRow[];
  payments: VendorPaymentRow[];
  vendorNameOf: Map<string, string>;
  slotLabelOf: Map<string, string>;
  today: string;
  defaultVatRateBasisPoints: number;
};

function toBudgetLine(line: BudgetLineRow, context: LineContext): BudgetLine {
  const { varianceCents, variancePercent } = computeVariance(line.estimatedAmountCents, line.committedAmountCents);
  const payments = context.payments.filter((payment) => payment.lineId === line.id);
  const remainingAmountCents = remainingToPayCents(line.committedAmountCents, line.paidAmountCents);
  const vatRateBasisPoints = line.vatRateBasisPoints ?? context.defaultVatRateBasisPoints;
  const ht = (ttc: number | null) => (ttc === null ? null : htFromTtcCents(ttc, vatRateBasisPoints));
  return {
    id: line.id,
    eventVendorSlotId: line.eventVendorSlotId,
    label: line.label || (context.slotLabelOf.get(line.eventVendorSlotId) ?? ""),
    vendorCandidateId: line.vendorCandidateId,
    vendorName: line.vendorCandidateId ? (context.vendorNameOf.get(line.vendorCandidateId) ?? null) : null,
    position: line.position,
    estimatedAmountCents: line.estimatedAmountCents,
    quotedAmountCents: line.quotedAmountCents,
    committedAmountCents: line.committedAmountCents,
    paidAmountCents: line.paidAmountCents,
    remainingAmountCents,
    varianceCents,
    variancePercent,
    paidFromPayments: payments.length > 0,
    attachments: context.attachments.filter((attachment) => attachment.lineId === line.id).map(toBudgetLineAttachment),
    payments: payments.map((payment) => toVendorPayment(payment, line, context.lines, context.today)),
    vatRateBasisPoints,
    ht: {
      estimatedCents: ht(line.estimatedAmountCents),
      quotedCents: ht(line.quotedAmountCents),
      committedCents: ht(line.committedAmountCents),
      paidCents: ht(line.paidAmountCents),
      remainingCents: ht(remainingAmountCents),
      varianceCents: ht(varianceCents),
    },
  };
}

function sumOf(lines: BudgetLine[], pick: (line: BudgetLine) => number | null): number {
  return lines.reduce((sum, line) => sum + (pick(line) ?? 0), 0);
}

// Lot 28c (BUD-09, ADR 0059) : totaux HT, les TTC additionnés par taux.
function htTotalsOf(lines: BudgetLine[]): BudgetHtTotals {
  const total = (pick: (line: BudgetLine) => number | null) => htTotalByRate(lines, (line) => line.vatRateBasisPoints, pick);
  return {
    estimatedCents: total((line) => line.estimatedAmountCents),
    quotedCents: total((line) => line.quotedAmountCents),
    committedCents: total((line) => line.committedAmountCents),
    paidCents: total((line) => line.paidAmountCents),
    remainingCents: total((line) => line.remainingAmountCents),
    varianceCents: total((line) => line.varianceCents),
  };
}

// Lot 28b (BUD-01, Q33) : les catégories (postes) dans l'ordre de la fiche,
// chacune avec ses lignes et ses totaux ; une catégorie sans ligne n'y figure pas.
async function toBudgetLinesView(
  organizationId: string,
  eventId: string,
  lines: BudgetLineRow[],
): Promise<BudgetLinesView> {
  const lineIds = lines.map((line) => line.id);
  const [vendorSlots, attachments, payments, candidates, quotes] = await Promise.all([
    listEventVendorSlots(organizationId, eventId),
    findBudgetLineAttachments(organizationId, lineIds),
    findVendorPayments(organizationId, lineIds),
    lines.some((line) => line.vendorCandidateId !== null) ? listVendorCandidates(organizationId, eventId) : Promise.resolve([] as VendorCandidate[]),
    // D5 : sans module Devis, ou sans devis, le client est un particulier.
    listEventQuotes(organizationId, eventId),
  ]);
  const context: LineContext = {
    lines,
    attachments,
    payments,
    vendorNameOf: new Map(candidates.map((candidate) => [candidate.id, candidate.vendorName])),
    slotLabelOf: new Map(vendorSlots.map((slot) => [slot.id, slot.label])),
    today: parisToday(),
    defaultVatRateBasisPoints: starterBudgetVatRateBasisPoints(),
  };
  const slotOrder = new Map(vendorSlots.map((slot, index) => [slot.id, index]));
  const sorted = [...lines].sort(
    (a, b) => (slotOrder.get(a.eventVendorSlotId) ?? Infinity) - (slotOrder.get(b.eventVendorSlotId) ?? Infinity) || a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const mapped = sorted.map((line) => toBudgetLine(line, context));
  const categories: BudgetCategory[] = [];
  for (const line of mapped) {
    let category = categories.at(-1);
    if (!category || category.eventVendorSlotId !== line.eventVendorSlotId) {
      category = {
        eventVendorSlotId: line.eventVendorSlotId,
        label: context.slotLabelOf.get(line.eventVendorSlotId) ?? line.label,
        lines: [],
        estimatedCents: 0,
        quotedCents: 0,
        committedCents: 0,
        paidCents: 0,
        remainingCents: 0,
        varianceCents: 0,
        ht: { estimatedCents: 0, quotedCents: 0, committedCents: 0, paidCents: 0, remainingCents: 0, varianceCents: 0 },
      };
      categories.push(category);
    }
    category.lines.push(line);
  }
  for (const category of categories) {
    category.estimatedCents = sumOf(category.lines, (line) => line.estimatedAmountCents);
    category.quotedCents = sumOf(category.lines, (line) => line.quotedAmountCents);
    category.committedCents = sumOf(category.lines, (line) => line.committedAmountCents);
    category.paidCents = sumOf(category.lines, (line) => line.paidAmountCents);
    category.remainingCents = sumOf(category.lines, (line) => line.remainingAmountCents);
    category.varianceCents = sumOf(category.lines, (line) => line.varianceCents);
    category.ht = htTotalsOf(category.lines);
  }
  const totalCommittedCents = sumOf(mapped, (line) => line.committedAmountCents);
  return {
    eventId,
    categories,
    lines: mapped,
    totalEstimatedCents: sumOf(mapped, (line) => line.estimatedAmountCents),
    totalQuotedCents: sumOf(mapped, (line) => line.quotedAmountCents),
    totalCommittedCents,
    totalPaidCents: sumOf(mapped, (line) => line.paidAmountCents),
    totalRemainingCents: sumOf(mapped, (line) => line.remainingAmountCents),
    totalVarianceCents: sumOf(mapped, (line) => line.varianceCents),
    clientKind: budgetClientKind(quotes),
    totalHt: htTotalsOf(mapped),
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
export async function previewEngagement(input: { organizationId: string; eventId: string; eventVendorSlotId: string; amountCents: number; candidateId?: string }): Promise<EngagementPreview> {
  const lines = await findBudgetLines(input.organizationId, input.eventId);
  // Lot 28b (D11) : les lignes déjà liées au prestataire sont remplacées par ce
  // que la retenue y engagera (plusieurs lignes : leur devisé).
  const linked = input.candidateId ? lines.filter((line) => line.eventVendorSlotId === input.eventVendorSlotId && line.vendorCandidateId === input.candidateId) : [];
  const projected = linked.length > 1 ? linked.reduce((sum, line) => sum + (line.quotedAmountCents ?? line.committedAmountCents ?? 0), 0) : input.amountCents;
  const others = lines.filter((line) => !linked.includes(line)).reduce((sum, line) => sum + (line.committedAmountCents ?? 0), 0);
  const committedAfterCents = others + projected;
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
  const slotLabelOf = new Map(eventSlots.map((slot) => [slot.id, slot.label]));

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

  // Lot 28b (Q33) : l'estimé de chaque catégorie va sur sa première ligne.
  for (const match of matches) {
    await setBudgetLineAmount({
      organizationId: input.organizationId,
      eventId: input.eventId,
      eventVendorSlotId: match.eventVendorSlotId,
      slotLabel: slotLabelOf.get(match.eventVendorSlotId) ?? "",
      field: "estimated",
      amountCents: match.amountCents,
      changedByUserId: input.confirmedByUserId,
    });
  }

  return listBudgetLines(input.organizationId, input.eventId);
}

// PRD-BUD-02, lot 28b : modification à la main d'un montant d'une ligne. Sans
// ligne désignée, la première ligne de la catégorie, créée si elle n'existe pas
// encore (un événement peut recevoir un budget sans passer par la simulation).
export async function updateBudgetLine(input: UpdateBudgetLineInput): Promise<BudgetLinesView> {
  // Montants en centimes entiers, positifs ou nuls (CLAUDE.md § 5), quelle que soit l'entrée.
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new RangeError("le montant doit être un nombre entier positif de centimes");
  }
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();

  let slotLabel = "";
  if (input.lineId) {
    const line = await findBudgetLine(input.organizationId, input.lineId);
    if (!line || line.eventId !== input.eventId) throw new BudgetLineNotFoundError();
    if (input.field === "paid" && (await findVendorPayments(input.organizationId, [line.id])).length > 0) throw new BudgetLinePaidFromPaymentsError();
  } else {
    const eventSlots: EventVendorSlot[] = await listEventVendorSlots(input.organizationId, input.eventId);
    const slot = eventSlots.find((entry) => entry.id === input.eventVendorSlotId);
    if (!slot) throw new EventVendorSlotNotFoundError(input.eventVendorSlotId ?? "");
    slotLabel = slot.label;
    const first = await findFirstBudgetLineOfSlot(input.organizationId, slot.id);
    if (input.field === "paid" && first && (await findVendorPayments(input.organizationId, [first.id])).length > 0) throw new BudgetLinePaidFromPaymentsError();
  }

  const written = await setBudgetLineAmount({
    organizationId: input.organizationId,
    eventId: input.eventId,
    ...(input.lineId ? { lineId: input.lineId } : { eventVendorSlotId: input.eventVendorSlotId!, slotLabel }),
    field: input.field,
    amountCents: input.amountCents,
    changedByUserId: input.changedByUserId,
  });
  if (!written) throw new BudgetLineNotFoundError();
  return listBudgetLines(input.organizationId, input.eventId);
}

// Historique des lignes d'une catégorie (lot 28b : une catégorie a plusieurs lignes).
export async function listBudgetLineHistory(
  organizationId: string,
  eventVendorSlotId: string,
): Promise<BudgetLineHistoryEntry[]> {
  const lines = await findBudgetLinesOfSlot(organizationId, eventVendorSlotId);
  const rows = await findBudgetLineHistory(organizationId, lines.map((line) => line.id));
  return rows.map((row) => ({
    field: row.field,
    oldValueCents: row.oldValueCents,
    newValueCents: row.newValueCents,
    changedByUserId: row.changedByUserId,
    changedAt: row.changedAt.toISOString(),
  }));
}

// Lot 28b (BUD-01, Q33) — lignes d'une catégorie : ajout, libellé et
// prestataire, suppression. Le prestataire est l'un de ceux rattachés à la
// catégorie (module events).
async function assertCandidateOfSlot(organizationId: string, eventId: string, eventVendorSlotId: string, candidateId: string | null | undefined): Promise<void> {
  if (!candidateId) return;
  const candidate = await getVendorCandidate(organizationId, candidateId);
  if (!candidate || candidate.eventId !== eventId || candidate.vendorSlotId !== eventVendorSlotId) throw new BudgetLineDetailsInvalidError("vendor");
}

export async function addBudgetLine(input: AddBudgetLineInput): Promise<BudgetLinesView> {
  const label = input.label.trim().slice(0, 200);
  if (!label) throw new BudgetLineDetailsInvalidError("label");
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  const slots = await listEventVendorSlots(input.organizationId, input.eventId);
  if (!slots.some((slot) => slot.id === input.eventVendorSlotId)) throw new EventVendorSlotNotFoundError(input.eventVendorSlotId);
  await assertCandidateOfSlot(input.organizationId, input.eventId, input.eventVendorSlotId, input.vendorCandidateId);
  await insertBudgetLine({ organizationId: input.organizationId, eventId: input.eventId, eventVendorSlotId: input.eventVendorSlotId, label, vendorCandidateId: input.vendorCandidateId ?? null });
  return listBudgetLines(input.organizationId, input.eventId);
}

export async function updateBudgetLineDetails(input: UpdateBudgetLineDetailsInput): Promise<BudgetLinesView> {
  const line = await findBudgetLine(input.organizationId, input.lineId);
  if (!line || line.eventId !== input.eventId) throw new BudgetLineNotFoundError();
  const label = input.label === undefined ? undefined : input.label.trim().slice(0, 200);
  if (label === "") throw new BudgetLineDetailsInvalidError("label");
  const rate = input.vatRateBasisPoints;
  if (rate !== undefined && !(Number.isInteger(rate) && rate >= 0 && rate <= 10000)) throw new BudgetLineDetailsInvalidError("vat");
  await assertCandidateOfSlot(input.organizationId, input.eventId, line.eventVendorSlotId, input.vendorCandidateId);
  await updateBudgetLineRow({
    organizationId: input.organizationId,
    lineId: line.id,
    ...(label !== undefined ? { label } : {}),
    ...(input.vendorCandidateId !== undefined ? { vendorCandidateId: input.vendorCandidateId } : {}),
    ...(rate !== undefined ? { vatRateBasisPoints: rate } : {}),
  });
  return listBudgetLines(input.organizationId, input.eventId);
}

// Lot 62c (UX-13, décision D1) — le budget s'enregistre d'un coup : libellé, prestataire, taux de
// TVA et montants de plusieurs lignes, dans une seule transaction (tout ou rien). Une ligne refusée
// dit laquelle, pour que l'écran l'ouvre.
export class BudgetBatchLineError extends Error {
  constructor(
    readonly lineId: string,
    readonly reason: unknown,
  ) {
    super("ligne du budget refusée");
    this.name = "BudgetBatchLineError";
  }
}

export const BUDGET_BATCH_MAX_LINES = 500;

export async function saveBudgetLines(input: SaveBudgetLinesInput): Promise<BudgetLinesView> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  const lineIds = input.lines.map((line) => line.lineId);
  if (input.lines.length > BUDGET_BATCH_MAX_LINES) throw new RangeError("trop de lignes en un envoi");
  if (new Set(lineIds).size !== lineIds.length) throw new BudgetLineNotFoundError();
  const current = new Map((await findBudgetLines(input.organizationId, input.eventId)).map((line) => [line.id, line]));
  const entries = [];
  for (const line of input.lines) {
    const row = current.get(line.lineId);
    if (!row) throw new BudgetLineNotFoundError();
    try {
      const label = line.label === undefined ? undefined : line.label.trim().slice(0, 200);
      if (label === "") throw new BudgetLineDetailsInvalidError("label");
      const rate = line.vatRateBasisPoints;
      if (rate !== undefined && !(Number.isInteger(rate) && rate >= 0 && rate <= 10000)) throw new BudgetLineDetailsInvalidError("vat");
      const amounts = line.amounts ?? [];
      if (amounts.some((amount) => !Number.isInteger(amount.amountCents) || amount.amountCents < 0)) throw new RangeError("le montant doit être un nombre entier positif de centimes");
      await assertCandidateOfSlot(input.organizationId, input.eventId, row.eventVendorSlotId, line.vendorCandidateId);
      entries.push({
        lineId: line.lineId,
        ...(label !== undefined ? { label } : {}),
        ...(line.vendorCandidateId !== undefined ? { vendorCandidateId: line.vendorCandidateId } : {}),
        ...(rate !== undefined ? { vatRateBasisPoints: rate } : {}),
        amounts,
      });
    } catch (error) {
      throw new BudgetBatchLineError(line.lineId, error);
    }
  }
  const result = await saveBudgetLineRows({ organizationId: input.organizationId, eventId: input.eventId, changedByUserId: input.changedByUserId, lines: entries });
  if (result.status === "line_not_found") throw new BudgetLineNotFoundError();
  if (result.status === "paid_from_payments") throw new BudgetBatchLineError(result.lineId, new BudgetLinePaidFromPaymentsError());
  return listBudgetLines(input.organizationId, input.eventId);
}

export async function removeBudgetLine(organizationId: string, eventId: string, lineId: string): Promise<BudgetLinesView> {
  const line = await findBudgetLine(organizationId, lineId);
  if (!line || line.eventId !== eventId) throw new BudgetLineNotFoundError();
  // Lot 39a (UX-07 ; ADR 0073) : marquée, « Annuler » la rend ; la purge efface lignes et fichiers.
  await deleteBudgetLine(organizationId, lineId);
  return listBudgetLines(organizationId, eventId);
}

// —— Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) — corbeille du module ———————————————————————————

export async function restoreBudgetLine(organizationId: string, lineId: string): Promise<string | null> {
  return restoreBudgetLineRow(organizationId, lineId);
}

export async function trashEventBudget(organizationId: string, eventId: string, at: Date): Promise<number> {
  return trashEventBudgetRows(organizationId, eventId, at);
}

export async function restoreEventBudget(organizationId: string, eventId: string, at: Date): Promise<number> {
  return restoreEventBudgetRows(organizationId, eventId, at);
}

// Lignes retirées avant la date donnée (« Annuler » passé) : lignes et fichiers.
export async function purgeBudgetElements(organizationId: string, before: Date): Promise<number> {
  const { count, fileKeys } = await purgeBudgetLines(organizationId, before);
  const storage = fileKeys.length > 0 ? createStorageClient() : null;
  for (const key of fileKeys) await deletePrivateObject(storage!, key).catch(() => undefined);
  return count;
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
  const slotLines = await findBudgetLinesOfSlot(organizationId, payload.vendorSlotId);
  const engage = async (lineId: string, field: "quoted" | "committed", amountCents: number) =>
    setBudgetLineAmount({ organizationId, eventId: payload.eventId, lineId, field, amountCents, changedByUserId: payload.bookedByUserId });

  // Événement de version 1 (avant le lot 28b) : la première ligne de la catégorie.
  if (!payload.candidateId) {
    if (payload.amountCents === null) return;
    const first = slotLines[0];
    if (first && occurredAt && (await committedChangedSince(organizationId, [first.id], occurredAt))) return;
    const line = first ?? (await insertBudgetLine({ organizationId, eventId: payload.eventId, eventVendorSlotId: payload.vendorSlotId, label: payload.label, vendorCandidateId: null }));
    await engage(line.id, "committed", payload.amountCents);
    if (line.quotedAmountCents === null) await engage(line.id, "quoted", payload.amountCents);
    return;
  }

  // Lot 28b (PRE-02, D11) : les lignes du prestataire. Sûr au rejeu : un engagé
  // modifié depuis l'événement (à la main, ou par un plus récent) n'est pas écrasé.
  let linked = slotLines.filter((line) => line.vendorCandidateId === payload.candidateId);
  if (linked.length > 0 && occurredAt && (await committedChangedSince(organizationId, linked.map((line) => line.id), occurredAt))) return;
  if (linked.length === 0) {
    // Une ligne libre de la catégorie (sans prestataire ni engagé, celle de la
    // simulation par exemple) devient la sienne ; sinon une ligne à son nom.
    const free = slotLines.find((line) => line.vendorCandidateId === null && line.committedAmountCents === null);
    if (free) {
      await updateBudgetLineRow({ organizationId, lineId: free.id, vendorCandidateId: payload.candidateId });
      linked = [{ ...free, vendorCandidateId: payload.candidateId }];
    } else {
      if (payload.amountCents === null) return;
      const candidate = await getVendorCandidate(organizationId, payload.candidateId);
      linked = [
        await insertBudgetLine({
          organizationId,
          eventId: payload.eventId,
          eventVendorSlotId: payload.vendorSlotId,
          label: candidate?.vendorName ?? payload.label,
          vendorCandidateId: payload.candidateId,
        }),
      ];
    }
  }
  if (linked.length === 1) {
    // Une seule ligne : le devis du prestataire en est le devisé, et l'engagé.
    const [line] = linked as [BudgetLineRow];
    const amount = payload.amountCents ?? line.quotedAmountCents;
    if (amount === null) return;
    if (line.quotedAmountCents !== amount) await engage(line.id, "quoted", amount);
    if (line.committedAmountCents !== amount) await engage(line.id, "committed", amount);
    return;
  }
  // Plusieurs lignes : chacune engage son devisé (le détail du devis).
  for (const line of linked) {
    if (line.quotedAmountCents !== null && line.committedAmountCents !== line.quotedAmountCents) await engage(line.id, "committed", line.quotedAmountCents);
  }
}

// Lot 47 (PAR-05, D6 ; ADR 0085) : gestionnaire de events.vendor_retention.released (un prestataire
// n'est plus retenu, par le choix de la planner). L'engagé des lignes de ce prestataire est libéré,
// seulement s'il vaut encore ce que la retenue avait engagé : son devis (une seule ligne), ou le
// devisé de chaque ligne (plusieurs lignes). Un engagé modifié depuis, à la main ou par un autre
// événement, n'est pas touché ; un rejeu ne trouve plus rien à libérer. Sous RLS, dans
// l'organisation de l'événement.
export async function applyVendorRetentionReleasedToBudget(organizationId: string, payload: VendorRetentionReleasedPayload): Promise<number> {
  const linked = (await findBudgetLinesOfSlot(organizationId, payload.vendorSlotId)).filter((line) => line.vendorCandidateId === payload.candidateId && line.eventId === payload.eventId);
  let released = 0;
  for (const line of linked) {
    const expected = linked.length === 1 ? (payload.amountCents ?? line.quotedAmountCents) : line.quotedAmountCents;
    if (expected === null) continue;
    if (await releaseCommittedAmount({ organizationId, lineId: line.id, expectedCents: expected, changedByUserId: payload.releasedByUserId })) released += 1;
  }
  return released;
}

async function committedChangedSince(organizationId: string, lineIds: string[], occurredAt: Date): Promise<boolean> {
  const history = await findBudgetLineHistory(organizationId, lineIds);
  return history.some((row) => row.field === "committed" && row.changedAt.getTime() > occurredAt.getTime());
}

// PRD-BUD-03 — devis prestataire joint : mêmes règles que l'envoi de fichier
// du socle (type vérifié par le contenu, antivirus, stockage privé), via
// @symbola/files. Refus clair, sans rien enregistrer, à chaque étape.
export async function attachBudgetLineQuote(input: AttachBudgetLineQuoteInput): Promise<BudgetLineAttachment> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  const line = input.lineId
    ? await findBudgetLine(input.organizationId, input.lineId)
    : input.eventVendorSlotId
      ? await findFirstBudgetLineOfSlot(input.organizationId, input.eventVendorSlotId)
      : null;
  if (!line || line.eventId !== input.eventId) throw new BudgetLineNotFoundError();
  const kind = input.kind ?? "quote";
  if (!BUDGET_DOCUMENT_KINDS.includes(kind)) throw new BudgetLineNotFoundError();

  const upload = await uploadFile({
    organizationId: input.organizationId,
    buffer: Buffer.from(input.content),
    maxSizeBytes: QUOTE_MAX_SIZE_BYTES,
  });
  if (upload.status === "rejected") throw quoteUploadError(upload);

  const row = await insertBudgetLineAttachment({
    organizationId: input.organizationId,
    lineId: line.id,
    kind,
    fileKey: upload.key,
    mime: upload.mime,
    sizeBytes: upload.size,
    uploadedByUserId: input.uploadedByUserId,
  });
  return toBudgetLineAttachment(row);
}

// Préfixe technique du nom de fichier téléchargé, par nature de document.
const DOCUMENT_FILE_PREFIX = { quote: "devis", contract: "contrat", invoice: "facture" } as const;

// Lien signé à durée limitée, demandé au moment de l'ouverture — jamais
// stocké ni affiché d'avance.
// Devis joint lu dans le stockage privé et servi par l'app (ADR 0027).
export async function getBudgetLineAttachmentFile(organizationId: string, attachmentId: string): Promise<FileDownload> {
  const attachment = await findBudgetLineAttachment(organizationId, attachmentId);
  if (!attachment) throw new BudgetLineAttachmentNotFoundError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), attachment.fileKey);
    const extension = attachment.fileKey.split(".").pop() ?? "bin";
    return { data, contentType: attachment.mime, fileName: `${DOCUMENT_FILE_PREFIX[attachment.kind]}-prestataire-${attachment.id}.${extension}` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new BudgetLineAttachmentNotFoundError();
    throw error;
  }
}

// PRD-BUD-04 — le budget vu par le marié, en lecture seule : l'accès à
// l'événement est vérifié par le module events avant toute lecture. Seules
// les colonnes publiques (poste, prévu, réel, écart, totaux) : les devis
// joints restent des documents de travail de la planner.
// PRD-BUD-04, lot 26a (POR-01, POR-10) : budget en lecture seule pour un lien
// personnel dont la rubrique « Budget » est ouverte ; l'accès est relu par le
// module events. Les catégories et leurs totaux seulement (le détail au
// portail : lot 27). En « catégories choisies » : ces catégories seules, leurs
// propres totaux (ADR 0059 : HT par taux), ni enveloppe ni total général.
export async function getLinkBudgetView(organizationId: string, linkId: string): Promise<LinkBudgetView> {
  const access = await getLinkAccess(organizationId, linkId);
  // Lot 26b (SC-S3) : le budget n'est jamais ouvert au lien d'un prestataire.
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("budget")) throw new LinkBudgetAccessDeniedError();
  const view = await listBudgetLines(organizationId, access.eventId);
  const withoutLines = (categories: BudgetCategory[]) => categories.map((category) => ({ ...category, lines: [] }));
  const today = parisToday();
  // Lot 43 (BUD-06, D8) : un payeur à qui le client ne montre que sa part ne reçoit ni catégorie, ni
  // total, ni la part d'un autre : seulement ses échéances (sa part se lit par getLinkPayerShare).
  const payer = (await findEventPayers(organizationId, access.eventId)).find((candidate) => candidate.linkId === linkId) ?? null;
  if (payer && payer.ownShareOnly && payer.kind !== "couple") {
    const own = view.categories.map((category) => ({ ...category, lines: category.lines.map((line) => ({ ...line, payments: line.payments.filter((payment) => payment.payerId === payer.id) })) }));
    return { ...emptyTotals(view), payments: linkPayments(own, linkId, today), scope: "share" };
  }
  if (access.rights.budgetScope === "all") {
    return { ...view, lines: [], categories: withoutLines(view.categories), scope: "all", payments: linkPayments(view.categories, linkId, today) };
  }
  const shared = new Set(access.rights.sharedSlotIds);
  const categories = view.categories.filter((category) => shared.has(category.eventVendorSlotId));
  const lines = categories.flatMap((category) => category.lines);
  return {
    payments: linkPayments(categories, linkId, today),
    eventId: view.eventId,
    categories: withoutLines(categories),
    lines: [],
    totalEstimatedCents: sumOf(lines, (line) => line.estimatedAmountCents),
    totalQuotedCents: sumOf(lines, (line) => line.quotedAmountCents),
    totalCommittedCents: sumOf(lines, (line) => line.committedAmountCents),
    totalPaidCents: sumOf(lines, (line) => line.paidAmountCents),
    totalRemainingCents: sumOf(lines, (line) => line.remainingAmountCents),
    totalVarianceCents: sumOf(lines, (line) => line.varianceCents),
    clientKind: view.clientKind,
    totalHt: htTotalsOf(lines),
    envelope: null,
    scope: "selected",
  };
}

// Lot 27a (POR-05) — échéances vues par un lien : celles de ses catégories, non
// payées, et payées depuis moins de trois mois ; par date.
const PAID_VISIBLE_DAYS = 90;

function linkPayments(categories: BudgetCategory[], linkId: string, today: string): LinkVendorPayment[] {
  const since = addDaysTo(today, -PAID_VISIBLE_DAYS);
  return categories
    .flatMap((category) =>
      category.lines.flatMap((line) =>
        line.payments
          .filter((payment) => payment.paidOn === null || payment.paidOn >= since)
          .map((payment): LinkVendorPayment => ({
            id: payment.id,
            slotLabel: category.label,
            vendorName: line.vendorName,
            label: payment.label,
            amountCents: payment.amountCents,
            dueOn: payment.dueOn,
            paidOn: payment.paidOn,
            status: payment.status === "paid" ? "paid" : payment.declaration ? "declared" : payment.status,
            declaredPaidOn: payment.declaration?.paidOn ?? null,
            declaredMethod: payment.declaration?.method ?? null,
            declaredByThisLink: payment.status !== "paid" && payment.declaration?.linkId === linkId,
            refusalReason: payment.status === "paid" || payment.declaration ? null : payment.refusalReason,
            handedOverAt: payment.handover?.handedOverAt ?? null,
          })),
      ),
    )
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

// Lot 28b (BUD-03, D7, D12, D13) — échéances des paiements aux prestataires.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validPayment(input: Pick<VendorPaymentInput, "label" | "fixedAmountCents" | "percentageBasisPoints" | "dueOn">) {
  const label = input.label.trim().slice(0, 200);
  if (!label) throw new VendorPaymentInvalidError("label");
  if (!DATE_PATTERN.test(input.dueOn) || Number.isNaN(Date.parse(`${input.dueOn}T00:00:00Z`))) throw new VendorPaymentInvalidError("date");
  const fixed = input.fixedAmountCents ?? null;
  const percentage = input.percentageBasisPoints ?? null;
  const fixedValid = fixed !== null && Number.isInteger(fixed) && fixed > 0 && percentage === null;
  const percentageValid = percentage !== null && Number.isInteger(percentage) && percentage >= 1 && percentage <= 10000 && fixed === null;
  if (!fixedValid && !percentageValid) throw new VendorPaymentInvalidError("amount");
  return { label, fixedAmountCents: fixed, percentageBasisPoints: percentage, dueOn: input.dueOn };
}

async function ownPayment(organizationId: string, eventId: string, paymentId: string): Promise<VendorPaymentRow> {
  const payment = await findVendorPayment(organizationId, paymentId);
  if (!payment || payment.eventId !== eventId) throw new VendorPaymentNotFoundError();
  return payment;
}

export async function addVendorPayment(input: VendorPaymentInput): Promise<BudgetLinesView> {
  const values = validPayment(input);
  const row = await insertVendorPayment({ organizationId: input.organizationId, eventId: input.eventId, lineId: input.lineId, ...values, changedByUserId: input.changedByUserId });
  if (!row) throw new BudgetLineNotFoundError();
  return listBudgetLines(input.organizationId, input.eventId);
}

export async function updateVendorPayment(input: VendorPaymentInput & { paymentId: string }): Promise<BudgetLinesView> {
  await ownPayment(input.organizationId, input.eventId, input.paymentId);
  const values = validPayment(input);
  const row = await updateVendorPaymentRow({ organizationId: input.organizationId, eventId: input.eventId, paymentId: input.paymentId, ...values, changedByUserId: input.changedByUserId });
  if (!row) throw new VendorPaymentNotFoundError();
  return listBudgetLines(input.organizationId, input.eventId);
}

// Payée : son montant est figé (un pourcentage devient le montant calculé ce
// jour-là) ; le payé de la ligne suit (D13). Annuler le paiement garde ce montant.
export async function setVendorPaymentPaid(input: { organizationId: string; eventId: string; paymentId: string; paidOn: string | null; changedByUserId: string }): Promise<BudgetLinesView> {
  const payment = await ownPayment(input.organizationId, input.eventId, input.paymentId);
  if (input.paidOn !== null && !DATE_PATTERN.test(input.paidOn)) throw new VendorPaymentInvalidError("date");
  let fixedAmountCents = payment.fixedAmountCents;
  if (input.paidOn !== null && fixedAmountCents === null) {
    const lines = await findBudgetLines(input.organizationId, input.eventId);
    const line = lines.find((entry) => entry.id === payment.lineId);
    if (!line) throw new BudgetLineNotFoundError();
    fixedAmountCents = paymentAmountCents(payment, paymentBaseCents(line, lines));
    if (fixedAmountCents <= 0) throw new VendorPaymentInvalidError("amount");
  }
  await updateVendorPaymentRow({
    organizationId: input.organizationId,
    eventId: input.eventId,
    paymentId: payment.id,
    label: payment.label,
    fixedAmountCents,
    percentageBasisPoints: fixedAmountCents === null ? payment.percentageBasisPoints : null,
    dueOn: payment.dueOn,
    paidOn: input.paidOn,
    changedByUserId: input.changedByUserId,
  });
  return listBudgetLines(input.organizationId, input.eventId);
}

export async function removeVendorPayment(input: { organizationId: string; eventId: string; paymentId: string; changedByUserId: string }): Promise<BudgetLinesView> {
  await ownPayment(input.organizationId, input.eventId, input.paymentId);
  if (!(await deleteVendorPaymentRow(input))) throw new VendorPaymentNotFoundError();
  return listBudgetLines(input.organizationId, input.eventId);
}

// Lot 27a (SC-06 étape 5, décision D6) — règlement déclaré par un client. Le
// lien doit ouvrir le budget et, en « catégories choisies », la catégorie de
// l'échéance ; sinon, même refus qu'une échéance inexistante.
const DECLARED_METHOD_MAX = 80;
const REFUSAL_REASON_MAX = 300;

async function linkPaymentAccess(organizationId: string, linkId: string, paymentId: string): Promise<{ eventId: string; payment: VendorPaymentRow }> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("budget")) throw new LinkBudgetAccessDeniedError();
  const payment = await findVendorPayment(organizationId, paymentId);
  if (!payment || payment.eventId !== access.eventId) throw new LinkBudgetAccessDeniedError();
  if (access.rights.budgetScope === "selected") {
    const line = (await findBudgetLines(organizationId, access.eventId)).find((entry) => entry.id === payment.lineId);
    if (!line || !access.rights.sharedSlotIds.includes(line.eventVendorSlotId)) throw new LinkBudgetAccessDeniedError();
  }
  return { eventId: access.eventId, payment };
}

export async function declareLinkVendorPayment(input: { organizationId: string; linkId: string; paymentId: string; paidOn: string; method: string; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  const { eventId, payment } = await linkPaymentAccess(input.organizationId, input.linkId, input.paymentId);
  if (payment.paidOn) throw new VendorPaymentDeclarationError("paid");
  if (payment.declaredAt) throw new VendorPaymentDeclarationError("declared");
  if (!DATE_PATTERN.test(input.paidOn) || Number.isNaN(Date.parse(`${input.paidOn}T00:00:00Z`)) || input.paidOn > parisToday(now)) throw new VendorPaymentDeclarationError("date");
  const method = input.method.trim();
  if (!method || method.length > DECLARED_METHOD_MAX) throw new VendorPaymentDeclarationError("method");
  const row = await withActor({ kind: "link", id: input.linkId }, () =>
    declareVendorPaymentRow({ organizationId: input.organizationId, eventId, paymentId: payment.id, paidOn: input.paidOn, method, linkId: input.linkId, now }),
  );
  if (!row) throw new VendorPaymentDeclarationError("declared");
}

// Seul le lien qui a déclaré l'annule, tant que la planner n'a pas confirmé.
export async function cancelLinkVendorPaymentDeclaration(input: { organizationId: string; linkId: string; paymentId: string; now?: Date }): Promise<void> {
  const { eventId, payment } = await linkPaymentAccess(input.organizationId, input.linkId, input.paymentId);
  const cancelled = await withActor({ kind: "link", id: input.linkId }, () =>
    cancelVendorPaymentDeclarationRow({ organizationId: input.organizationId, eventId, paymentId: payment.id, linkId: input.linkId, now: input.now ?? new Date() }),
  );
  if (!cancelled) throw new VendorPaymentDeclarationError("not_declared");
}

// Confirmer : l'échéance est payée à la date déclarée (son montant se fige, le
// payé de la ligne suit, D13) ; la déclaration reste lisible.
export async function confirmVendorPaymentDeclaration(input: { organizationId: string; eventId: string; paymentId: string; changedByUserId: string }): Promise<BudgetLinesView> {
  const payment = await ownPayment(input.organizationId, input.eventId, input.paymentId);
  if (!payment.declaredAt || !payment.declaredPaidOn || payment.paidOn) throw new VendorPaymentDeclarationError("not_declared");
  const view = await setVendorPaymentPaid({ organizationId: input.organizationId, eventId: input.eventId, paymentId: payment.id, paidOn: payment.declaredPaidOn, changedByUserId: input.changedByUserId });
  await recordDeclarationConfirmedRow({ organizationId: input.organizationId, eventId: input.eventId, paymentId: payment.id });
  return view;
}

export async function refuseVendorPaymentDeclaration(input: { organizationId: string; eventId: string; paymentId: string; reason: string; now?: Date }): Promise<BudgetLinesView> {
  await ownPayment(input.organizationId, input.eventId, input.paymentId);
  const reason = input.reason.trim().slice(0, REFUSAL_REASON_MAX);
  if (!reason) throw new VendorPaymentDeclarationError("reason");
  const refused = await refuseVendorPaymentDeclarationRow({ organizationId: input.organizationId, eventId: input.eventId, paymentId: input.paymentId, reason, now: input.now ?? new Date() });
  if (!refused) throw new VendorPaymentDeclarationError("not_declared");
  return listBudgetLines(input.organizationId, input.eventId);
}

// « Aujourd'hui » : déclarations en attente de confirmation, les plus anciennes d'abord.
export async function listPendingPaymentDeclarations(organizationId: string): Promise<PendingPaymentDeclaration[]> {
  const { payments, lines } = await findPendingDeclarationRows(organizationId);
  const eventIds = [...new Set(payments.map((payment) => payment.eventId))];
  const candidates = (await Promise.all(eventIds.map((eventId) => listVendorCandidates(organizationId, eventId)))).flat();
  const vendorNameOf = new Map(candidates.map((candidate) => [candidate.id, candidate.vendorName]));
  return payments.flatMap((payment) => {
    const line = lines.find((entry) => entry.id === payment.lineId);
    if (!line || !payment.declaredAt || !payment.declaredPaidOn || !payment.declaredMethod || !payment.declaredByLinkId) return [];
    const eventLines = lines.filter((entry) => entry.eventId === payment.eventId);
    return [
      {
        paymentId: payment.id,
        eventId: payment.eventId,
        label: payment.label,
        lineLabel: line.label,
        vendorName: line.vendorCandidateId ? (vendorNameOf.get(line.vendorCandidateId) ?? null) : null,
        amountCents: paymentAmountCents(payment, paymentBaseCents(line, eventLines)),
        declaredPaidOn: payment.declaredPaidOn,
        declaredMethod: payment.declaredMethod,
        declaredByLinkId: payment.declaredByLinkId,
        declaredAt: payment.declaredAt.toISOString(),
      },
    ];
  });
}

// D7 : échéances non payées des 7 prochains jours et en retard, toutes les
// lignes de l'organisation (hors essais : leurs données ne publient rien).
export async function listUpcomingVendorPayments(organizationId: string, today: string): Promise<UpcomingVendorPayment[]> {
  return describeVendorPayments(organizationId, today, await findDueVendorPayments(organizationId, addDaysTo(today, 7)));
}

// Lot 63d (HUB-08, BUD-03, BUD-11 ; maquette M3) — les échéances des prestataires non réglées entre deux
// dates (« AAAA-MM-JJ », bornes comprises) : le calendrier du mois d'« Aujourd'hui » les montre à leur date.
export async function listVendorPaymentsDueBetween(organizationId: string, today: string, from: string, until: string): Promise<UpcomingVendorPayment[]> {
  if (from > until) return [];
  return describeVendorPayments(organizationId, today, await findDueVendorPayments(organizationId, until, from));
}

async function describeVendorPayments(organizationId: string, today: string, { payments, lines }: Awaited<ReturnType<typeof findDueVendorPayments>>): Promise<UpcomingVendorPayment[]> {
  if (payments.length === 0) return [];
  const eventIds = [...new Set(payments.map((payment) => payment.eventId))];
  const [names, slotsByEvent, candidatesByEvent] = await Promise.all([
    getEventNamesByIds(organizationId, eventIds),
    Promise.all(eventIds.map((eventId) => listEventVendorSlots(organizationId, eventId))),
    Promise.all(eventIds.map((eventId) => listVendorCandidates(organizationId, eventId))),
  ]);
  const slotLabelOf = new Map(slotsByEvent.flat().map((slot) => [slot.id, slot.label]));
  const vendorNameOf = new Map(candidatesByEvent.flat().map((candidate) => [candidate.id, candidate.vendorName]));
  const upcoming: UpcomingVendorPayment[] = [];
  for (const payment of payments) {
    const line = lines.find((entry) => entry.id === payment.lineId);
    if (!line || !(payment.eventId in names)) continue;
    upcoming.push({
      id: payment.id,
      eventId: payment.eventId,
      eventName: names[payment.eventId] ?? "",
      lineId: line.id,
      lineLabel: line.label || (slotLabelOf.get(line.eventVendorSlotId) ?? ""),
      vendorName: line.vendorCandidateId ? (vendorNameOf.get(line.vendorCandidateId) ?? null) : null,
      label: payment.label,
      amountCents: paymentAmountCents(payment, paymentBaseCents(line, lines)),
      dueOn: payment.dueOn,
      overdue: payment.dueOn < today,
    });
  }
  return upcoming;
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
  adjustEventBudgetItems,
  listBudgetLines,
  confirmEventBudget,
  updateBudgetLine,
  listBudgetLineHistory,
  attachBudgetLineQuote,
  getBudgetLineAttachmentFile,
  getLinkBudgetView,
  removeEventBudgetData,
  addBudgetLine,
  updateBudgetLineDetails,
  saveBudgetLines,
  removeBudgetLine,
  addVendorPayment,
  updateVendorPayment,
  setVendorPaymentPaid,
  removeVendorPayment,
  listUpcomingVendorPayments,
  listVendorPaymentsDueBetween,
};
void _contractCheck;

// Lot 35a (HUB-13, DAT-13, ADR 0068) : entités du module dans l'export complet de l'organisation.
export { BUDGET_EXPORT_EXCLUSIONS, describeBudgetExport, exportBudgetData, eraseBudgetData, importBudgetData, registerBudgetImportIds } from "./export";

// Lot 51 (JRJ-09 ; D8, ADR 0091) — paiements à remettre le jour J.
export { VendorPaymentHandoverInvalidError } from "./handovers";

// Marquer une échéance « à remettre le jour J » (moyen, personne qui remet), ou retirer la marque.
export async function setVendorPaymentHandover(input: VendorPaymentHandoverInput): Promise<BudgetLinesView> {
  await ownPayment(input.organizationId, input.eventId, input.paymentId);
  const values = handoverValues({ method: input.method, by: input.by });
  const row = await setHandoverRow({ organizationId: input.organizationId, eventId: input.eventId, paymentId: input.paymentId, onDay: input.onDay, ...values });
  if (!row) throw new VendorPaymentNotFoundError();
  return listBudgetLines(input.organizationId, input.eventId);
}

// Les remises du jour J d'un évènement : prestataire, montant, moyen, à qui ; remises ou non.
export async function listDayHandovers(organizationId: string, eventId: string): Promise<DayHandover[]> {
  const rows = await findHandoverRows(organizationId, eventId);
  if (rows.length === 0) return [];
  const [view, candidates] = await Promise.all([listBudgetLines(organizationId, eventId), listVendorCandidates(organizationId, eventId)]);
  // Une ligne sans prestataire rattaché : le prestataire retenu de sa catégorie (module events).
  const retainedOf = (slotId: string) => candidates.filter((candidate) => candidate.outcome === "selected" && candidate.vendorSlotId === slotId).map((candidate) => candidate.vendorName).join(", ") || null;
  const handovers: DayHandover[] = [];
  for (const category of view.categories) {
    for (const line of category.lines) {
      for (const payment of line.payments) {
        const row = rows.find((entry) => entry.id === payment.id);
        if (!row) continue;
        // Lot 48a (PRE-10) : la fiche du prestataire de la ligne, sinon celles des retenus de la catégorie.
        const vendorIds = candidates
          .filter((candidate) => (line.vendorCandidateId ? candidate.id === line.vendorCandidateId : candidate.outcome === "selected" && candidate.vendorSlotId === line.eventVendorSlotId))
          .flatMap((candidate) => (candidate.vendorId ? [candidate.vendorId] : []));
        handovers.push({
          paymentId: payment.id,
          eventId,
          vendorIds,
          vendorName: line.vendorName ?? retainedOf(line.eventVendorSlotId),
          slotLabel: category.label,
          label: payment.label,
          amountCents: payment.amountCents,
          method: row.handoverMethod,
          by: row.handoverBy,
          handedOverAt: row.handedOverAt?.toISOString() ?? null,
          handedOverBy: row.handedOverBy,
          receiptPhotoId: row.handoverReceiptPhotoId,
        });
      }
    }
  }
  return handovers.sort((a, b) => a.slotLabel.localeCompare(b.slotLabel) || a.label.localeCompare(b.label));
}

// JRJ-09 : chaque remise se pointe ; elle règle l'échéance, au jour de la remise dans le fuseau de
// l'évènement. Une seule fois : un second pointage (ou l'action rejouée) est ignoré.
export async function recordDayHandover(input: { organizationId: string; eventId: string; paymentId: string; userId: string; actionId: string; handedOverAt: Date; timeZone: string }): Promise<"applied" | "duplicate" | "not_found"> {
  const recorded = await recordHandoverRow(input);
  if (recorded.status !== "applied") return recorded.status;
  const paidOn = new Intl.DateTimeFormat("en-CA", { timeZone: input.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(input.handedOverAt);
  const payment = await findVendorPayment(input.organizationId, input.paymentId);
  if (payment && !payment.paidOn) await setVendorPaymentPaid({ organizationId: input.organizationId, eventId: input.eventId, paymentId: input.paymentId, paidOn, changedByUserId: input.userId });
  return "applied";
}

export async function attachDayHandoverReceipt(input: { organizationId: string; eventId: string; paymentId: string; photoId: string }): Promise<boolean> {
  return attachHandoverReceiptRow(input);
}

export async function isDayHandoverPayment(organizationId: string, eventId: string, paymentId: string): Promise<boolean> {
  return handoverPaymentOfEvent(organizationId, eventId, paymentId);
}

// =====================================================================================================
// Lot 43 (BUD-06, BUD-11 ; D8, D9 ; ADR 0089) — payeurs de l'évènement (les mariés, une famille, une
// entreprise), leur part sur chaque ligne (pourcentage ou montant ; le reste aux mariés), le payeur
// désigné de chaque échéance, ce que chaque payeur voit (sa part seule, par défaut, ou tout le budget :
// le client le décide) et le calendrier des sorties d'argent, mois par mois. Contrôles côté serveur.
// =====================================================================================================

export class EventPayerNotFoundError extends Error {
  constructor() {
    super("payeur introuvable");
    this.name = "EventPayerNotFoundError";
  }
}

export class EventPayerInvalidError extends Error {
  constructor(readonly reason: "name" | "kind" | "link" | "couple" | "shares_invalid" | "shares_duplicate" | "shares_over_100" | "line" | "payment" | "instalment") {
    super("payeur ou part invalide");
    this.name = "EventPayerInvalidError";
  }
}

function emptyTotals(view: BudgetLinesView): BudgetLinesView {
  return { eventId: view.eventId, categories: [], lines: [], totalEstimatedCents: 0, totalQuotedCents: 0, totalCommittedCents: 0, totalPaidCents: 0, totalRemainingCents: 0, totalVarianceCents: 0, clientKind: view.clientKind, totalHt: htTotalsOf([]), envelope: null };
}

function toEventPayer(row: EventPayerRow): EventPayer {
  return { id: row.id, eventId: row.eventId, name: row.name, kind: row.kind, linkId: row.linkId, ownShareOnly: row.ownShareOnly };
}

const PAYER_KINDS = new Set<string>(EVENT_PAYER_KINDS);

// Les payeurs de l'évènement ; les mariés existent toujours (créés à la première lecture).
export async function listEventPayers(organizationId: string, eventId: string): Promise<EventPayer[]> {
  const event = await getEvent(organizationId, eventId);
  if (!event) throw new EventNotFoundError();
  const names = event.clients.map((client) => client.firstName.trim()).filter(Boolean).join(" & ") || "—";
  await ensureCouplePayer(organizationId, eventId, names.slice(0, 120));
  return (await findEventPayers(organizationId, eventId)).map(toEventPayer);
}

async function ownPayer(organizationId: string, eventId: string, payerId: string): Promise<EventPayer> {
  const payer = (await listEventPayers(organizationId, eventId)).find((candidate) => candidate.id === payerId);
  if (!payer) throw new EventPayerNotFoundError();
  return payer;
}

// Un lien rattaché à un payeur : un lien « client » de cet évènement, encore valable.
async function validPayerLink(organizationId: string, eventId: string, linkId: string | null): Promise<string | null> {
  if (linkId === null) return null;
  const link = (await listEventLinks(organizationId, eventId)).find((candidate) => candidate.id === linkId);
  if (!link || link.audience !== "client" || link.status === "revoked") throw new EventPayerInvalidError("link");
  return link.id;
}

function payerName(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < 1 || clean.length > 120) throw new EventPayerInvalidError("name");
  return clean;
}

export async function addEventPayer(organizationId: string, input: { eventId: string; name: string; kind: EventPayerKind; linkId: string | null }): Promise<EventPayer> {
  await listEventPayers(organizationId, input.eventId);
  if (!PAYER_KINDS.has(input.kind) || input.kind === "couple") throw new EventPayerInvalidError("kind");
  const linkId = await validPayerLink(organizationId, input.eventId, input.linkId);
  try {
    return toEventPayer(await insertEventPayer(organizationId, { eventId: input.eventId, name: payerName(input.name), kind: input.kind, linkId }));
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    if (cause?.code === "23505") throw new EventPayerInvalidError("link");
    throw error;
  }
}

export async function updateEventPayer(organizationId: string, input: { eventId: string; payerId: string; name: string; kind: EventPayerKind; linkId: string | null }): Promise<EventPayer> {
  const payer = await ownPayer(organizationId, input.eventId, input.payerId);
  if (!PAYER_KINDS.has(input.kind) || (payer.kind === "couple") !== (input.kind === "couple")) throw new EventPayerInvalidError("kind");
  const linkId = await validPayerLink(organizationId, input.eventId, input.linkId);
  return toEventPayer((await updateEventPayerRow(organizationId, payer.id, { name: payerName(input.name), kind: input.kind, linkId }))!);
}

export async function removeEventPayer(organizationId: string, eventId: string, payerId: string): Promise<void> {
  const payer = await ownPayer(organizationId, eventId, payerId);
  if (payer.kind === "couple") throw new EventPayerInvalidError("couple");
  await deleteEventPayerRow(organizationId, payer.id);
}

// La planner règle pour le client ce que voit un payeur.
export async function setPayerVisibility(organizationId: string, input: { eventId: string; payerId: string; ownShareOnly: boolean }): Promise<EventPayer> {
  const payer = await ownPayer(organizationId, input.eventId, input.payerId);
  if (payer.kind === "couple") throw new EventPayerInvalidError("couple");
  return toEventPayer((await updateEventPayerRow(organizationId, payer.id, { ownShareOnly: input.ownShareOnly }))!);
}

// Le lien d'un des mariés (rattaché à un client de l'évènement, rubrique « Budget ») ; sinon refusé.
async function coupleLinkAccess(organizationId: string, linkId: string) {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("budget")) throw new LinkBudgetAccessDeniedError();
  const link = (await listEventLinks(organizationId, access.eventId)).find((candidate) => candidate.id === linkId);
  if (!link?.eventClientId) throw new LinkBudgetAccessDeniedError();
  return access;
}

export async function listLinkPayers(organizationId: string, linkId: string): Promise<EventPayer[]> {
  const access = await coupleLinkAccess(organizationId, linkId);
  return listEventPayers(organizationId, access.eventId);
}

// BUD-06 : « si le client le décide » — un des mariés, depuis son portail, choisit ce que voit chaque payeur.
export async function setLinkPayerVisibility(organizationId: string, input: { linkId: string; payerId: string; ownShareOnly: boolean }): Promise<EventPayer> {
  const access = await coupleLinkAccess(organizationId, input.linkId);
  return withActor({ kind: "link", id: input.linkId }, () => setPayerVisibility(organizationId, { eventId: access.eventId, payerId: input.payerId, ownShareOnly: input.ownShareOnly }));
}

export async function setLinePayerShares(organizationId: string, input: { eventId: string; lineId: string; shares: PayerShareInput[] }): Promise<void> {
  const payers = await listEventPayers(organizationId, input.eventId);
  const couple = payers.find((payer) => payer.kind === "couple")!;
  // Ce qui revient aux mariés n'a pas besoin d'être écrit : le reste leur revient.
  const shares = input.shares.filter((share) => share.payerId !== couple.id);
  const problem = validateShares(shares);
  if (problem) throw new EventPayerInvalidError(problem === "invalid" ? "shares_invalid" : problem === "duplicate" ? "shares_duplicate" : "shares_over_100");
  if (shares.some((share) => !payers.some((payer) => payer.id === share.payerId))) throw new EventPayerNotFoundError();
  if (!(await replaceLinePayerShares(organizationId, { eventId: input.eventId, lineId: input.lineId, shares }))) throw new EventPayerInvalidError("line");
}

export async function setVendorPaymentPayer(organizationId: string, input: { eventId: string; paymentId: string; payerId: string | null }): Promise<void> {
  const payers = await listEventPayers(organizationId, input.eventId);
  const payer = input.payerId === null ? null : (payers.find((candidate) => candidate.id === input.payerId) ?? null);
  if (input.payerId !== null && !payer) throw new EventPayerNotFoundError();
  if (!(await setVendorPaymentPayerRow(organizationId, { eventId: input.eventId, paymentId: input.paymentId, payerId: payer && payer.kind !== "couple" ? payer.id : null }))) throw new EventPayerInvalidError("payment");
}

export async function setInstalmentPayer(organizationId: string, input: { eventId: string; scheduleItemId: string; payerId: string | null }): Promise<void> {
  const payers = await listEventPayers(organizationId, input.eventId);
  const payer = input.payerId === null ? null : (payers.find((candidate) => candidate.id === input.payerId) ?? null);
  if (input.payerId !== null && !payer) throw new EventPayerNotFoundError();
  if (!(await listEventInstalments(organizationId, input.eventId)).some((instalment) => instalment.scheduleItemId === input.scheduleItemId)) throw new EventPayerInvalidError("instalment");
  await setInstalmentPayerRow(organizationId, { eventId: input.eventId, scheduleItemId: input.scheduleItemId, payerId: payer && payer.kind !== "couple" ? payer.id : null });
}

// Le lien du payeur désigné d'une échéance de la planner : lui seul la déclare (null : personne).
export async function getInstalmentPayerLinkId(organizationId: string, eventId: string, scheduleItemId: string): Promise<string | null> {
  const designated = (await findInstalmentPayers(organizationId, eventId)).find((row) => row.scheduleItemId === scheduleItemId);
  if (!designated) return null;
  return (await findEventPayers(organizationId, eventId)).find((payer) => payer.id === designated.payerId)?.linkId ?? null;
}

export type PayerSharesView = {
  payers: EventPayer[];
  lines: { lineId: string; slotLabel: string; label: string; referenceCents: number; shares: PayerShareInput[]; split: { payerId: string; amountCents: number }[] }[];
  byPayer: PayerShareView[];
  instalmentPayers: { scheduleItemId: string; payerId: string }[];
};

// Côté planner : chaque ligne, sa part par payeur au centime, et le total de chacun.
export async function getPayerShares(organizationId: string, eventId: string): Promise<PayerSharesView> {
  const payers = await listEventPayers(organizationId, eventId);
  const couple = payers.find((payer) => payer.kind === "couple")!;
  const view = await listBudgetLines(organizationId, eventId);
  const rows = await findPayerShares(organizationId, view.lines.map((line) => line.id));
  const lines = view.categories.flatMap((category) =>
    category.lines.map((line) => {
      const shares = rows.filter((row) => row.lineId === line.id).map((row) => ({ payerId: row.payerId, percentageBasisPoints: row.percentageBasisPoints, amountCents: row.amountCents }));
      const referenceCents = lineReferenceAmount(line);
      const split = [...splitAmongPayers(referenceCents, shares, couple.id).entries()].map(([payerId, amountCents]) => ({ payerId, amountCents }));
      return { lineId: line.id, slotLabel: category.label, label: line.label, referenceCents, shares, split };
    }),
  );
  const byPayer = payers.map((payer) => {
    const own = lines.map((line) => ({ lineId: line.lineId, slotLabel: line.slotLabel, label: line.label, amountCents: line.split.find((entry) => entry.payerId === payer.id)?.amountCents ?? 0 })).filter((line) => line.amountCents > 0);
    return { payerId: payer.id, lines: own, totalCents: own.reduce((sum, line) => sum + line.amountCents, 0) };
  });
  const instalmentPayers = (await findInstalmentPayers(organizationId, eventId)).map((row) => ({ scheduleItemId: row.scheduleItemId, payerId: row.payerId }));
  return { payers, lines, byPayer, instalmentPayers };
}

// La part d'un payeur, vue par son propre lien (quel que soit son réglage) ; null sans payeur.
export async function getLinkPayerShare(organizationId: string, linkId: string): Promise<{ payer: EventPayer; share: PayerShareView } | null> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("budget")) throw new LinkBudgetAccessDeniedError();
  const payer = (await listEventPayers(organizationId, access.eventId)).find((candidate) => candidate.linkId === linkId);
  if (!payer || payer.kind === "couple") return null;
  const shares = await getPayerShares(organizationId, access.eventId);
  return { payer, share: shares.byPayer.find((entry) => entry.payerId === payer.id)! };
}

// BUD-11 (D9) — calendrier des sorties d'argent : échéances de la planner et des prestataires, mois par
// mois, avec leur payeur et leur statut. payerId : seulement les siennes.
export async function getCashCalendar(organizationId: string, eventId: string, filter: { payerId: string | null; slotIds?: Set<string> | null; withInstalments?: boolean } = { payerId: null }): Promise<CashCalendarMonth[]> {
  const payers = await listEventPayers(organizationId, eventId);
  const couple = payers.find((payer) => payer.kind === "couple")!;
  const nameOf = new Map(payers.map((payer) => [payer.id, payer.name]));
  const view = await listBudgetLines(organizationId, eventId);
  const entries: CashEntry[] = [];
  for (const category of view.categories) {
    if (filter.slotIds && !filter.slotIds.has(category.eventVendorSlotId)) continue;
    for (const line of category.lines) {
      for (const payment of line.payments) {
        entries.push({ id: payment.id, source: "vendor", label: payment.label, counterpart: line.vendorName ?? line.label ?? category.label, amountCents: payment.amountCents, dueOn: payment.dueOn, payerId: payment.payerId ?? couple.id, status: payment.status === "paid" ? "paid" : payment.declaration ? "declared" : "upcoming" });
      }
    }
  }
  const settleIds = new Set<string>();
  if (filter.withInstalments !== false) {
    const designated = new Map((await findInstalmentPayers(organizationId, eventId)).map((row) => [row.scheduleItemId, row.payerId]));
    for (const instalment of await listEventInstalments(organizationId, eventId)) {
      settleIds.add(instalment.scheduleItemId);
      entries.push({ id: instalment.scheduleItemId, source: "planner", label: `${instalment.label} · ${instalment.quoteNumber}`, counterpart: instalment.organizationName, amountCents: instalment.amountCents, dueOn: instalment.dueDate, payerId: designated.get(instalment.scheduleItemId) ?? couple.id, status: instalment.status });
    }
  }
  return buildCashCalendar(entries, { payerId: filter.payerId }).map((month) => ({
    ...month,
    entries: month.entries.map((entry) => ({ ...entry, payerName: nameOf.get(entry.payerId) ?? "", settleScheduleItemId: entry.source === "planner" && settleIds.has(entry.id) && entry.status !== "paid" ? entry.id : null })),
  }));
}

// Le calendrier vu par un lien : un payeur « part seule » ne voit que ses échéances ; en « catégories
// choisies », les seules échéances de ses catégories ; celles de la planner, avec la rubrique « Devis ».
export async function getLinkCashCalendar(organizationId: string, linkId: string): Promise<CashCalendarMonth[]> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || access.audience !== "client" || !access.rights.rubrics.includes("budget")) throw new LinkBudgetAccessDeniedError();
  const payer = (await listEventPayers(organizationId, access.eventId)).find((candidate) => candidate.linkId === linkId) ?? null;
  const withInstalments = access.rights.rubrics.includes("quotes");
  if (payer && payer.kind !== "couple" && payer.ownShareOnly) return getCashCalendar(organizationId, access.eventId, { payerId: payer.id, withInstalments });
  const slotIds = access.rights.budgetScope === "selected" ? new Set(access.rights.sharedSlotIds) : null;
  return getCashCalendar(organizationId, access.eventId, { payerId: null, slotIds, withInstalments });
}
