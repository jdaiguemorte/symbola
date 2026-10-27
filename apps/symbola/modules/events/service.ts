// Porte d'entrée publique du module events — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/events si ce module est extrait en app autonome.
import {
  applyTaskTemplateRows,
  deleteDefaultVendorSlot,
  deleteEventTask,
  deleteEventVendorSlot,
  deleteTaskTemplate,
  deleteTaskTemplateItem,
  findDefaultVendorSlots,
  findEventById,
  findEvents,
  findEventTasks,
  findEventVendorSlots,
  findLossReasons,
  findProspectSources,
  findTaskRecalculation,
  findTaskTemplates,
  insertDefaultVendorSlots,
  insertEventTask,
  insertEventVendorSlot,
  insertLossReason,
  insertProspect,
  insertProspectSource,
  insertTaskTemplate,
  insertTaskTemplateItem,
  moveEventTaskRow,
  resolveTaskRecalculationRow,
  updateEventDateRow,
  updateEventStatus,
  updateEventTaskRow,
  updateEventVendorSlotRow,
  type DefaultVendorSlotRow,
  type EventClientRow,
  type EventRow,
  type EventTaskRow,
  type EventVendorSlotRow,
  type TaskTemplateItemRow,
  type TaskTemplateRow,
} from "./repository";
import { addDays } from "./schedule";

export { monthKey } from "./schedule";
import type {
  ChangeEventStatusInput,
  CreateProspectInput,
  CreateProspectResult,
  DefaultVendorSlot,
  EventClient,
  EventDetail,
  EventsServiceContract,
  EventSummary,
  EventTask,
  EventTaskInput,
  EventVendorSlot,
  ListEventsInput,
  LossReason,
  ProspectSource,
  TaskRecalculation,
  TaskResponsible,
  TaskTemplate,
  TaskTemplateItem,
  TaskTemplateItemInput,
  UpdateEventTaskInput,
  UpdateEventVendorSlotInput,
  VendorSlotProgress,
  VendorSlotStatus,
} from "@symbola/contracts";

export { eventsPrivacy } from "./privacy";

export type {
  ChangeEventStatusInput,
  CreateProspectInput,
  CreateProspectResult,
  EventClient,
  EventClientInput,
  EventDetail,
  EventStatus,
  EventSummary,
  ListEventsInput,
  LossReason,
  ProspectSource,
  DefaultVendorSlot,
  EventVendorSlot,
  UpdateEventVendorSlotInput,
  VendorSlotProgress,
  VendorSlotStatus,
  EventTask,
  EventTaskInput,
  TaskRecalculation,
  TaskResponsible,
  TaskTemplate,
  TaskTemplateItem,
  TaskTemplateItemInput,
  UpdateEventTaskInput,
} from "@symbola/contracts";

function toEventClient(row: EventClientRow): EventClient {
  return { id: row.id, firstName: row.firstName, lastName: row.lastName, position: row.position };
}

function toEventSummary(event: EventRow, clients: EventClientRow[]): EventSummary {
  return {
    id: event.id,
    status: event.status,
    eventDate: event.eventDate,
    venueName: event.venueName,
    venueCity: event.venueCity,
    clients: clients.map(toEventClient),
  };
}

function toEventDetail(event: EventRow, clients: EventClientRow[]): EventDetail {
  return {
    ...toEventSummary(event, clients),
    prospectSourceId: event.prospectSourceId,
    lossReasonId: event.lossReasonId,
    lossReasonNote: event.lossReasonNote,
    tasksScheduledFor: event.tasksScheduledFor,
  };
}

export async function listEvents(input: ListEventsInput): Promise<EventSummary[]> {
  const rows = await findEvents(input.organizationId, {
    statusIn: input.statusIn,
    year: input.year,
    search: input.search,
    prospectSourceId: input.prospectSourceId,
  });
  return rows.map(({ event, clients }) => toEventSummary(event, clients));
}

export async function getEvent(organizationId: string, eventId: string): Promise<EventDetail | null> {
  const result = await findEventById(organizationId, eventId);
  if (!result) return null;
  return toEventDetail(result.event, result.clients);
}

export async function createProspect(input: CreateProspectInput): Promise<CreateProspectResult> {
  const event = await insertProspect({
    organizationId: input.organizationId,
    createdByUserId: input.createdByUserId,
    clients: input.clients,
    prospectSourceId: input.prospectSourceId,
    eventDate: input.eventDate,
    venueName: input.venueName,
    venueCity: input.venueCity,
  });
  return { id: event.id };
}

export async function changeEventStatus(input: ChangeEventStatusInput): Promise<void> {
  await updateEventStatus(input);
}

export async function listProspectSources(organizationId: string): Promise<ProspectSource[]> {
  const rows = await findProspectSources(organizationId);
  return rows.map((row) => ({ id: row.id, label: row.label }));
}

export async function createProspectSource(organizationId: string, label: string): Promise<ProspectSource> {
  const row = await insertProspectSource(organizationId, label);
  return { id: row.id, label: row.label };
}

export async function listLossReasons(organizationId: string): Promise<LossReason[]> {
  const rows = await findLossReasons(organizationId);
  return rows.map((row) => ({ id: row.id, label: row.label, isFreeText: row.isFreeText }));
}

export async function createLossReason(
  organizationId: string,
  label: string,
  isFreeText: boolean,
): Promise<LossReason> {
  const row = await insertLossReason(organizationId, label, isFreeText);
  return { id: row.id, label: row.label, isFreeText: row.isFreeText };
}

// EVT-03 — postes prestataires.

export class VendorNameRequiredError extends Error {
  constructor() {
    super("le nom du prestataire est obligatoire pour un poste réservé");
    this.name = "VendorNameRequiredError";
  }
}

// Identifiant inconnu ou appartenant à une autre organisation (masqué
// par la RLS) : l'appelant affiche « introuvable » plutôt qu'une erreur.
export class EventNotFoundError extends Error {
  constructor() {
    super("événement introuvable");
    this.name = "EventNotFoundError";
  }
}

export class VendorSlotNotFoundError extends Error {
  constructor() {
    super("poste introuvable");
    this.name = "VendorSlotNotFoundError";
  }
}

export const VENDOR_SLOT_STATUSES: VendorSlotStatus[] = [
  "to_find",
  "quote_requested",
  "quote_received",
  "booked",
  "not_required",
];

function toDefaultVendorSlot(row: DefaultVendorSlotRow): DefaultVendorSlot {
  return { id: row.id, label: row.label, position: row.position };
}

function toEventVendorSlot(row: EventVendorSlotRow): EventVendorSlot {
  return {
    id: row.id,
    eventId: row.eventId,
    label: row.label,
    status: row.status,
    vendorName: row.vendorName,
    amountCents: row.amountCents,
    currency: "EUR",
    position: row.position,
  };
}

// Barre d'avancement de la fiche : postes réservés sur postes requis (un
// poste « Non requis » ne compte pas).
export function summarizeVendorSlots(slots: Pick<EventVendorSlot, "status">[]): VendorSlotProgress {
  const required = slots.filter((slot) => slot.status !== "not_required");
  return { booked: required.filter((slot) => slot.status === "booked").length, required: required.length };
}

export async function listDefaultVendorSlots(organizationId: string): Promise<DefaultVendorSlot[]> {
  return (await findDefaultVendorSlots(organizationId)).map(toDefaultVendorSlot);
}

export async function addDefaultVendorSlots(organizationId: string, labels: string[]): Promise<DefaultVendorSlot[]> {
  return (await insertDefaultVendorSlots(organizationId, labels)).map(toDefaultVendorSlot);
}

export async function removeDefaultVendorSlot(organizationId: string, defaultVendorSlotId: string): Promise<void> {
  await deleteDefaultVendorSlot(organizationId, defaultVendorSlotId);
}

export async function listEventVendorSlots(organizationId: string, eventId: string): Promise<EventVendorSlot[]> {
  return (await findEventVendorSlots(organizationId, eventId)).map(toEventVendorSlot);
}

export async function addEventVendorSlot(organizationId: string, eventId: string, label: string): Promise<EventVendorSlot> {
  const row = await insertEventVendorSlot(organizationId, eventId, label.trim());
  if (!row) throw new EventNotFoundError();
  return toEventVendorSlot(row);
}

export async function updateEventVendorSlot(input: UpdateEventVendorSlotInput): Promise<EventVendorSlot> {
  const vendorName = typeof input.vendorName === "string" ? input.vendorName.trim() || null : input.vendorName;
  if (input.status === "booked" && !vendorName) throw new VendorNameRequiredError();
  if (input.amountCents !== undefined && input.amountCents !== null) {
    if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
      throw new RangeError("le montant doit être un nombre entier positif de centimes");
    }
  }
  const row = await updateEventVendorSlotRow({ ...input, vendorName });
  if (!row) throw new VendorSlotNotFoundError();
  return toEventVendorSlot(row);
}

export async function removeEventVendorSlot(organizationId: string, vendorSlotId: string): Promise<void> {
  await deleteEventVendorSlot(organizationId, vendorSlotId);
}

// EVT-04 — rétroplanning.

export class EventDateRequiredError extends Error {
  constructor() {
    super("l'événement n'a pas de date : le modèle ne peut pas être appliqué");
    this.name = "EventDateRequiredError";
  }
}

export class TaskRecalculationPendingError extends Error {
  constructor() {
    super("un recalcul des échéances attend une réponse");
    this.name = "TaskRecalculationPendingError";
  }
}

export class TaskTemplateNotFoundError extends Error {
  constructor() {
    super("modèle introuvable");
    this.name = "TaskTemplateNotFoundError";
  }
}

export class EventTaskNotFoundError extends Error {
  constructor() {
    super("tâche introuvable");
    this.name = "EventTaskNotFoundError";
  }
}

export class TaskLabelRequiredError extends Error {
  constructor() {
    super("l'intitulé de la tâche est obligatoire");
    this.name = "TaskLabelRequiredError";
  }
}

export const TASK_RESPONSIBLES: TaskResponsible[] = ["planner", "clients"];

// Lève une RangeError si la date n'est pas un « AAAA-MM-JJ » réel.
function assertDate(date: string): void {
  addDays(date, 0);
}

function normalizeLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) throw new TaskLabelRequiredError();
  return trimmed;
}

function normalizeTemplateItem(item: TaskTemplateItemInput): TaskTemplateItemInput {
  if (!Number.isInteger(item.offsetDays)) throw new RangeError("le décalage doit être un nombre entier de jours");
  if (!TASK_RESPONSIBLES.includes(item.responsible)) throw new RangeError("responsable inconnu");
  return { label: normalizeLabel(item.label), offsetDays: item.offsetDays, responsible: item.responsible };
}

function toTaskTemplateItem(row: TaskTemplateItemRow): TaskTemplateItem {
  return {
    id: row.id,
    label: row.label,
    offsetDays: row.offsetDays,
    responsible: row.responsible,
    position: row.position,
  };
}

function toTaskTemplate(template: TaskTemplateRow, items: TaskTemplateItemRow[]): TaskTemplate {
  return { id: template.id, name: template.name, items: items.map(toTaskTemplateItem) };
}

function toEventTask(row: EventTaskRow): EventTask {
  return {
    id: row.id,
    eventId: row.eventId,
    label: row.label,
    dueDate: row.dueDate,
    responsible: row.responsible,
    done: row.doneAt !== null,
    position: row.position,
  };
}

export async function listTaskTemplates(organizationId: string): Promise<TaskTemplate[]> {
  return (await findTaskTemplates(organizationId)).map(({ template, items }) => toTaskTemplate(template, items));
}

export async function createTaskTemplate(
  organizationId: string,
  name: string,
  items: TaskTemplateItemInput[],
): Promise<TaskTemplate> {
  const result = await insertTaskTemplate(organizationId, normalizeLabel(name), items.map(normalizeTemplateItem));
  return toTaskTemplate(result.template, result.items);
}

export async function addTaskTemplateItem(
  organizationId: string,
  templateId: string,
  item: TaskTemplateItemInput,
): Promise<TaskTemplateItem> {
  const row = await insertTaskTemplateItem(organizationId, templateId, normalizeTemplateItem(item));
  if (!row) throw new TaskTemplateNotFoundError();
  return toTaskTemplateItem(row);
}

export async function removeTaskTemplateItem(organizationId: string, itemId: string): Promise<void> {
  await deleteTaskTemplateItem(organizationId, itemId);
}

export async function removeTaskTemplate(organizationId: string, templateId: string): Promise<void> {
  await deleteTaskTemplate(organizationId, templateId);
}

// Change la date de l'événement ; s'il reste des tâches non faites, le
// recalcul de leurs échéances est proposé (et non appliqué d'office).
export async function changeEventDate(
  organizationId: string,
  eventId: string,
  eventDate: string | null,
): Promise<TaskRecalculation> {
  if (eventDate !== null) assertDate(eventDate);
  const recalculation = await updateEventDateRow(organizationId, eventId, eventDate);
  if (!recalculation) throw new EventNotFoundError();
  return recalculation;
}

export async function getTaskRecalculation(organizationId: string, eventId: string): Promise<TaskRecalculation> {
  const recalculation = await findTaskRecalculation(organizationId, eventId);
  if (!recalculation) throw new EventNotFoundError();
  return recalculation;
}

export async function resolveTaskRecalculation(organizationId: string, eventId: string, accept: boolean): Promise<void> {
  if (!(await resolveTaskRecalculationRow(organizationId, eventId, accept))) throw new EventNotFoundError();
}

export async function applyTaskTemplate(organizationId: string, eventId: string, templateId: string): Promise<EventTask[]> {
  const result = await applyTaskTemplateRows(organizationId, eventId, templateId);
  switch (result.status) {
    case "applied":
      return result.tasks.map(toEventTask);
    case "event_not_found":
      throw new EventNotFoundError();
    case "template_not_found":
      throw new TaskTemplateNotFoundError();
    case "date_required":
      throw new EventDateRequiredError();
    case "recalculation_pending":
      throw new TaskRecalculationPendingError();
  }
}

export async function listEventTasks(organizationId: string, eventId: string): Promise<EventTask[]> {
  return (await findEventTasks(organizationId, eventId)).map(toEventTask);
}

export async function addEventTask(organizationId: string, eventId: string, task: EventTaskInput): Promise<EventTask> {
  assertDate(task.dueDate);
  if (!TASK_RESPONSIBLES.includes(task.responsible)) throw new RangeError("responsable inconnu");
  const row = await insertEventTask(organizationId, eventId, { ...task, label: normalizeLabel(task.label) });
  if (!row) throw new EventNotFoundError();
  return toEventTask(row);
}

export async function updateEventTask(input: UpdateEventTaskInput): Promise<EventTask> {
  if (input.dueDate !== undefined) assertDate(input.dueDate);
  if (input.responsible !== undefined && !TASK_RESPONSIBLES.includes(input.responsible)) {
    throw new RangeError("responsable inconnu");
  }
  const label = input.label === undefined ? undefined : normalizeLabel(input.label);
  const row = await updateEventTaskRow({ ...input, label });
  if (!row) throw new EventTaskNotFoundError();
  return toEventTask(row);
}

export async function moveEventTask(organizationId: string, taskId: string, direction: "up" | "down"): Promise<void> {
  if (!(await moveEventTaskRow(organizationId, taskId, direction))) throw new EventTaskNotFoundError();
}

export async function removeEventTask(organizationId: string, taskId: string): Promise<void> {
  await deleteEventTask(organizationId, taskId);
}

const _contractCheck: EventsServiceContract = {
  listEvents,
  getEvent,
  createProspect,
  changeEventStatus,
  listProspectSources,
  createProspectSource,
  listLossReasons,
  createLossReason,
  listDefaultVendorSlots,
  addDefaultVendorSlots,
  removeDefaultVendorSlot,
  listEventVendorSlots,
  addEventVendorSlot,
  updateEventVendorSlot,
  removeEventVendorSlot,
  listTaskTemplates,
  createTaskTemplate,
  addTaskTemplateItem,
  removeTaskTemplateItem,
  removeTaskTemplate,
  changeEventDate,
  getTaskRecalculation,
  resolveTaskRecalculation,
  applyTaskTemplate,
  listEventTasks,
  addEventTask,
  updateEventTask,
  moveEventTask,
  removeEventTask,
};
void _contractCheck;
