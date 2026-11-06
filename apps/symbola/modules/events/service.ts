// Porte d'entrée publique du module events — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/events si ce module est extrait en app autonome.
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { parisDaysSince, parisToday } from "@symbola/i18n";
import { createUser, findAccountByEmail } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { sendMail } from "@symbola/mail";
import { starterDemoEvent, starterProgram, starterRetroplanning, starterTutorialEvent, starterVendorSlots } from "@symbola/starter-templates";
import {
  findEventNamesByIds,
  searchEventRows,
  countEventsByCreationMonth,
  countRealEvents,
  findExpiredDemoEventIds,
  deleteDemoEvent,
  deleteExpiredDemoEvents,
  findActiveDemoEvent,
  insertDemoEvent,
  findClientAccessByTokenHash,
  findClientEventIds,
  findEventActivity,
  findEventStatusChanges,
  findEventClientAccesses,
  hasActiveClientAccess,
  markClientAccessAccepted,
  revokeClientAccessRow,
  saveClientAccess,
  toggleClientTask,
  type EventClientAccessRow,
  applyProgramTemplateRows,
  applyTaskTemplateRows,
  deleteProgramItem,
  deleteProgramTemplate,
  deleteProgramTemplateItem,
  findEventProgram,
  findProgramTemplates,
  insertProgramItem,
  insertProgramTemplate,
  insertProgramTemplateItem,
  updateProgramItemRow,
  type ProgramItemData,
  type ProgramItemWithParticipants,
  type ProgramTemplateItemRow,
  type ProgramTemplateRow,
  type ProgramWriteResult,
  deleteDefaultVendorSlot,
  deleteEventTask,
  deleteEventVendorSlot,
  deleteTaskTemplate,
  deleteTaskTemplateItem,
  findDefaultVendorSlots,
  findEventById,
  findEvents,
  findEventTasks,
  findOrganizationTasks,
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
  updateDefaultVendorSlotRow,
  updateEventVendorSlotIcon,
  type DefaultVendorSlotRow,
  type EventClientRow,
  type EventRow,
  type EventTaskRow,
  type EventVendorSlotRow,
  type TaskTemplateItemRow,
  type TaskTemplateRow,
} from "./repository";
import { addDays } from "./schedule";
import { addPlace, listPlaces, removePlace } from "./places";
import { createStorageClient, deletePrivateObject } from "@symbola/files";
import {
  addCandidate,
  addCandidateNote,
  attachCandidateQuote,
  candidateQuoteKeys,
  candidateQuoteKeysOfSlot,
  clientOptions,
  clientQuoteFile,
  getCandidateQuoteFile,
  linkCandidate,
  listCandidates,
  listConsultations,
  listSelectedVendors,
  removeCandidate,
  removeCandidateNote,
  selectCandidate,
  sharedRibVendorId,
  setCandidateNoteVisibility,
  setSlotBrief,
  updateCandidate,
} from "./vendor-candidates";
import { findProgramOverlaps, normalizeTime, programForVariant, sortProgramItems } from "./program";
import type {
  EventPlace,
  AddVendorCandidateInput,
  ClientVendorSlotOptions,
  FileDownload,
  UpdateVendorCandidateInput,
  VendorCandidate,
  VendorConsultation,
  EventsSearchResults,
  MonthlyCount,
  ChangeEventStatusInput,
  CreateProspectInput,
  CreateProspectResult,
  DefaultVendorSlot,
  EventClient,
  EventDetail,
  EventsServiceContract,
  EventSummary,
  StaleProspect,
  EventStatusDates,
  AcceptClientInvitationResult,
  ClientAccessStatus,
  ClientEventView,
  EventActivity,
  EventClientAccess,
  InviteEventClientInput,
  InviteEventClientResult,
  EventsTrial,
  StartEventsTrialInput,
  EventProgram,
  EventTask,
  EventTaskInput,
  EventVendorSlot,
  ListEventsInput,
  ProgramItem,
  ProgramItemInput,
  ProgramParticipant,
  ProgramTemplate,
  ProgramTemplateItem,
  ProgramTemplateItemInput,
  LossReason,
  ProspectSource,
  TaskRecalculation,
  TaskResponsible,
  TaskTemplate,
  TaskTemplateItem,
  TaskTemplateItemInput,
  UpdateEventTaskInput,
  ListOrganizationTasksInput,
  OrganizationTask,
  UpdateEventVendorSlotInput,
  VendorSlotProgress,
  VendorSlotStatus,
} from "@symbola/contracts";

export { eventsPrivacy } from "./privacy";
export { monthKey } from "./schedule";
export { programForVariant, type ProgramVariant } from "./program";

export type {
  ChangeEventStatusInput,
  CreateProspectInput,
  CreateProspectResult,
  EventClient,
  EventClientInput,
  EventDetail,
  EventStatus,
  EventSummary,
  StaleProspect,
  EventStatusDates,
  ListEventsInput,
  LossReason,
  ProspectSource,
  DefaultVendorSlot,
  EventVendorSlot,
  UpdateEventVendorSlotInput,
  VendorSlotProgress,
  VendorSlotStatus,
  AddVendorCandidateInput,
  EventPlace,
  ClientVendorOption,
  ClientVendorSlotOptions,
  UpdateVendorCandidateInput,
  VendorCandidate,
  VendorCandidateNote,
  VendorCandidateResponse,
  VendorConsultation,
  EventTask,
  EventTaskInput,
  TaskRecalculation,
  TaskResponsible,
  TaskTemplate,
  TaskTemplateItem,
  TaskTemplateItemInput,
  UpdateEventTaskInput,
  EventProgram,
  ProgramItem,
  ProgramItemInput,
  ProgramOverlap,
  ProgramParticipant,
  ProgramTemplate,
  ProgramTemplateItem,
  ProgramTemplateItemInput,
  AcceptClientInvitationResult,
  ClientAccessStatus,
  ClientEventView,
  EventActivity,
  EventActivityKind,
  EventClientAccess,
  InviteEventClientInput,
  InviteEventClientResult,
  EventsTrial,
  StartEventsTrialInput,
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
    isDemo: event.isDemo,
  };
}

function toEventDetail(event: EventRow, clients: EventClientRow[]): EventDetail {
  return {
    ...toEventSummary(event, clients),
    prospectSourceId: event.prospectSourceId,
    lossReasonId: event.lossReasonId,
    lossReasonNote: event.lossReasonNote,
    tasksScheduledFor: event.tasksScheduledFor,
    ...(event.importedFields ? { importedFields: event.importedFields } : {}),
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

// Lot 13 (HUB-15) — prospects sans nouvelle depuis au moins `days` jours
// (aucune modification de la fiche, calendrier de Paris), hors essais,
// pour le bloc « À traiter » de l'accueil.
export async function listStaleProspects(organizationId: string, days: number, now: Date = new Date()): Promise<StaleProspect[]> {
  const rows = await findEvents(organizationId, { statusIn: ["prospect"] });
  return rows
    .filter(({ event }) => !event.isDemo)
    .map(({ event, clients }) => ({
      eventId: event.id,
      names: eventNames(clients),
      lastUpdateAt: event.updatedAt,
      daysSince: parisDaysSince(event.updatedAt, now),
    }))
    .filter((row) => row.daysSince >= days)
    .sort((a, b) => b.daysSince - a.daysSince);
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

// EVT-07 — ajout en lot (listes de départ, ONB-01) : les libellés déjà
// présents, à la casse et aux espaces près, ne sont pas dupliqués. Renvoie
// le nombre d'entrées ajoutées.
function normalizedLabel(label: string): string {
  return label.trim().toLocaleLowerCase("fr");
}

export async function addProspectSources(organizationId: string, labels: string[]): Promise<number> {
  const existing = new Set((await findProspectSources(organizationId)).map((row) => normalizedLabel(row.label)));
  let added = 0;
  for (const label of labels.map((value) => value.trim()).filter(Boolean)) {
    if (existing.has(normalizedLabel(label))) continue;
    await insertProspectSource(organizationId, label);
    existing.add(normalizedLabel(label));
    added += 1;
  }
  return added;
}

export async function addLossReasons(organizationId: string, reasons: { label: string; isFreeText: boolean }[]): Promise<number> {
  const existing = new Set((await findLossReasons(organizationId)).map((row) => normalizedLabel(row.label)));
  let added = 0;
  for (const reason of reasons) {
    const label = reason.label.trim();
    if (!label || existing.has(normalizedLabel(label))) continue;
    await insertLossReason(organizationId, label, reason.isFreeText);
    existing.add(normalizedLabel(label));
    added += 1;
  }
  return added;
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
  return { id: row.id, label: row.label, icon: row.icon, position: row.position };
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
    ...(row.importedFields ? { importedFields: row.importedFields } : {}),
    brief: row.brief,
    selectedCandidateId: row.selectedCandidateId,
    icon: row.icon,
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

export async function addDefaultVendorSlots(
  organizationId: string,
  entries: (string | { label: string; icon?: string | null })[],
): Promise<DefaultVendorSlot[]> {
  return (await insertDefaultVendorSlots(organizationId, entries)).map(toDefaultVendorSlot);
}

// Lot 12 (EVT-17) : renommer une ligne du budget par défaut, changer son icône.
export async function updateDefaultVendorSlot(organizationId: string, id: string, label: string, icon: string | null): Promise<void> {
  const clean = label.trim();
  if (!clean) throw new RangeError("le nom de la ligne est obligatoire");
  if (!(await updateDefaultVendorSlotRow(organizationId, id, clean, icon))) throw new VendorSlotNotFoundError();
}

export async function setEventVendorSlotIcon(organizationId: string, vendorSlotId: string, icon: string | null): Promise<void> {
  await updateEventVendorSlotIcon(organizationId, vendorSlotId, icon);
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
  const keys = await candidateQuoteKeysOfSlot(organizationId, vendorSlotId);
  await deleteEventVendorSlot(organizationId, vendorSlotId);
  await deleteStoredFiles(keys);
}

// Lot 12 (EVT-15) — lieux de l'événement.
export { EventPlaceEventNotFoundError } from "./places";

export async function listEventPlaces(organizationId: string, eventId: string): Promise<EventPlace[]> {
  return listPlaces(organizationId, eventId);
}

export async function addEventPlace(organizationId: string, eventId: string, input: { label: string; address?: string | null; vendorId?: string | null }): Promise<EventPlace> {
  return addPlace(organizationId, eventId, input);
}

export async function removeEventPlace(organizationId: string, eventId: string, placeId: string): Promise<void> {
  await removePlace(organizationId, eventId, placeId);
}

// Lot 11 (EVT-10 / EVT-11, ADR 0031) — prestataires consultés par poste.

export { CandidateQuoteRejectedError, VendorCandidateNotFoundError, CANDIDATE_QUOTE_MAX_SIZE_BYTES } from "./vendor-candidates";

export async function setVendorSlotBrief(organizationId: string, vendorSlotId: string, brief: string | null): Promise<void> {
  await setSlotBrief(organizationId, vendorSlotId, brief);
}

export async function listVendorCandidates(organizationId: string, eventId: string): Promise<VendorCandidate[]> {
  return listCandidates(organizationId, eventId);
}

export async function addVendorCandidate(input: AddVendorCandidateInput): Promise<VendorCandidate> {
  return addCandidate(input);
}

export async function updateVendorCandidate(input: UpdateVendorCandidateInput): Promise<void> {
  await updateCandidate(input);
}

export async function linkVendorCandidate(organizationId: string, candidateId: string, vendorId: string): Promise<void> {
  await linkCandidate(organizationId, candidateId, vendorId);
}

export async function removeVendorCandidate(organizationId: string, candidateId: string): Promise<void> {
  await removeCandidate(organizationId, candidateId);
}

export async function attachVendorCandidateQuote(input: { organizationId: string; candidateId: string; content: Uint8Array }): Promise<void> {
  await attachCandidateQuote(input);
}

export async function getVendorCandidateQuoteFile(organizationId: string, candidateId: string): Promise<FileDownload> {
  return getCandidateQuoteFile(organizationId, candidateId);
}

export async function addVendorCandidateNote(input: {
  organizationId: string;
  candidateId: string;
  body: string;
  visibleToClients: boolean;
  createdByUserId: string;
}): Promise<void> {
  await addCandidateNote(input);
}

export async function setVendorCandidateNoteVisibility(organizationId: string, noteId: string, visibleToClients: boolean): Promise<void> {
  await setCandidateNoteVisibility(organizationId, noteId, visibleToClients);
}

export async function removeVendorCandidateNote(organizationId: string, noteId: string): Promise<void> {
  await removeCandidateNote(organizationId, noteId);
}

export async function selectVendorCandidate(input: { organizationId: string; candidateId: string; changedByUserId: string }): Promise<void> {
  await selectCandidate(input);
}

export async function listVendorConsultations(organizationId: string, vendorId: string): Promise<VendorConsultation[]> {
  return listConsultations(organizationId, vendorId, (eventIds) => findEventNamesByIds(organizationId, eventIds));
}

export async function listSelectedVendorIds(organizationId: string): Promise<string[]> {
  return listSelectedVendors(organizationId);
}

export class ClientVendorOptionsAccessDeniedError extends Error {
  constructor() {
    super("accès refusé aux options de cet événement");
    this.name = "ClientVendorOptionsAccessDeniedError";
  }
}

// EVT-11 — l'accès du client à l'événement est vérifié avant toute lecture.
export async function getClientVendorOptions(organizationId: string, userId: string, eventId: string): Promise<ClientVendorSlotOptions[]> {
  if (!(await hasActiveClientAccess(organizationId, userId, eventId))) throw new ClientVendorOptionsAccessDeniedError();
  return clientOptions(organizationId, eventId);
}

export async function getClientVendorQuoteFile(organizationId: string, userId: string, eventId: string, candidateId: string): Promise<FileDownload> {
  if (!(await hasActiveClientAccess(organizationId, userId, eventId))) throw new ClientVendorOptionsAccessDeniedError();
  return clientQuoteFile(organizationId, eventId, candidateId);
}

export async function getClientSharedRibVendorId(organizationId: string, userId: string, eventId: string, candidateId: string): Promise<string> {
  if (!(await hasActiveClientAccess(organizationId, userId, eventId))) throw new ClientVendorOptionsAccessDeniedError();
  return sharedRibVendorId(organizationId, eventId, candidateId);
}

async function deleteStoredFiles(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const storage = createStorageClient();
  for (const key of keys) await deletePrivateObject(storage, key).catch(() => undefined);
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
    ...(row.importedFields ? { importedFields: row.importedFields } : {}),
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

// Noms affichés d'un événement : prénoms des mariés (« Inès & Sacha »).
export function eventNames(clients: { firstName: string }[]): string {
  return clients.map((client) => client.firstName).join(" & ");
}

// HUB-02 — tâches de toute l'organisation (accueil, écran Tâches), triées
// par échéance, avec le nom de leur événement.
export async function listOrganizationTasks(input: ListOrganizationTasksInput): Promise<OrganizationTask[]> {
  assertDate(input.today);
  let until: string | null = null;
  if (input.horizonDays !== null) {
    const limit = new Date(`${input.today}T00:00:00Z`);
    limit.setUTCDate(limit.getUTCDate() + input.horizonDays);
    until = limit.toISOString().slice(0, 10);
  }
  const rows = await findOrganizationTasks(input.organizationId, { until, includeDone: input.includeDone ?? false });
  if (rows.length === 0) return [];
  const eventsById = new Map((await listEvents({ organizationId: input.organizationId })).map((event) => [event.id, event]));
  return rows.flatMap((row) => {
    const event = eventsById.get(row.eventId);
    if (!event) return [];
    const task = toEventTask(row);
    return [
      {
        ...task,
        overdue: !task.done && task.dueDate < input.today,
        event: { id: event.id, names: eventNames(event.clients), eventDate: event.eventDate, status: event.status, isDemo: event.isDemo },
      },
    ];
  });
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

// EVT-05 — programme du jour J.

export class ProgramItemNotFoundError extends Error {
  constructor() {
    super("ligne du programme introuvable");
    this.name = "ProgramItemNotFoundError";
  }
}

// Un intervenant cité n'est pas un poste de cet événement.
export class ProgramParticipantNotFoundError extends Error {
  constructor() {
    super("intervenant introuvable pour cet événement");
    this.name = "ProgramParticipantNotFoundError";
  }
}

export class ProgramTemplateNotFoundError extends Error {
  constructor() {
    super("modèle de programme introuvable");
    this.name = "ProgramTemplateNotFoundError";
  }
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const label of labels.map((value) => value.trim()).filter(Boolean)) {
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

function normalizeProgramItem(input: ProgramItemInput): ProgramItemData {
  return {
    startTime: normalizeTime(input.startTime),
    endTime: optionalText(input.endTime) === null ? null : normalizeTime(input.endTime!.trim()),
    label: normalizeLabel(input.label),
    location: optionalText(input.location),
    internalNote: optionalText(input.internalNote),
  };
}

function toProgramItem({ item, participants }: ProgramItemWithParticipants): ProgramItem {
  return {
    id: item.id,
    eventId: item.eventId,
    startTime: normalizeTime(item.startTime),
    endTime: item.endTime === null ? null : normalizeTime(item.endTime),
    label: item.label,
    location: item.location,
    internalNote: item.internalNote,
    participants: participants.map(
      ({ row, vendorSlotLabel }): ProgramParticipant => ({
        vendorSlotId: row.vendorSlotId,
        label: row.vendorSlotId ? (vendorSlotLabel ?? "") : (row.freeLabel ?? ""),
      }),
    ),
  };
}

function savedProgramItem(result: ProgramWriteResult): ProgramItem {
  switch (result.status) {
    case "saved":
      return toProgramItem(result.item);
    case "event_not_found":
      throw new EventNotFoundError();
    case "item_not_found":
      throw new ProgramItemNotFoundError();
    case "participant_not_found":
      throw new ProgramParticipantNotFoundError();
  }
}

export async function getEventProgram(organizationId: string, eventId: string): Promise<EventProgram> {
  const result = await findEventProgram(organizationId, eventId);
  if (!result) throw new EventNotFoundError();
  const items = sortProgramItems(result.items.map(toProgramItem));
  return {
    items,
    overlaps: findProgramOverlaps(items),
    updatedAt: result.event.programUpdatedAt?.toISOString() ?? null,
  };
}

export async function addProgramItem(organizationId: string, eventId: string, item: ProgramItemInput): Promise<ProgramItem> {
  return savedProgramItem(
    await insertProgramItem(
      organizationId,
      eventId,
      normalizeProgramItem(item),
      item.vendorSlotIds,
      cleanLabels(item.freeParticipants),
    ),
  );
}

export async function updateProgramItem(organizationId: string, itemId: string, item: ProgramItemInput): Promise<ProgramItem> {
  return savedProgramItem(
    await updateProgramItemRow(
      organizationId,
      itemId,
      normalizeProgramItem(item),
      item.vendorSlotIds,
      cleanLabels(item.freeParticipants),
    ),
  );
}

export async function removeProgramItem(organizationId: string, itemId: string): Promise<void> {
  await deleteProgramItem(organizationId, itemId);
}

function toProgramTemplateItem(row: ProgramTemplateItemRow): ProgramTemplateItem {
  return {
    id: row.id,
    startTime: normalizeTime(row.startTime),
    endTime: row.endTime === null ? null : normalizeTime(row.endTime),
    label: row.label,
    location: row.location,
    participantLabels: row.participantLabels,
    position: row.position,
  };
}

function toProgramTemplate(template: ProgramTemplateRow, items: ProgramTemplateItemRow[]): ProgramTemplate {
  return { id: template.id, name: template.name, items: sortProgramItems(items.map(toProgramTemplateItem)) };
}

function normalizeProgramTemplateItem(item: ProgramTemplateItemInput) {
  // Un modèle n'a pas de note interne : elle est propre à chaque événement.
  const { startTime, endTime, label, location } = normalizeProgramItem({ ...item, vendorSlotIds: [], freeParticipants: [] });
  return { startTime, endTime, label, location, participantLabels: cleanLabels(item.participantLabels) };
}

export async function listProgramTemplates(organizationId: string): Promise<ProgramTemplate[]> {
  return (await findProgramTemplates(organizationId)).map(({ template, items }) => toProgramTemplate(template, items));
}

export async function createProgramTemplate(
  organizationId: string,
  name: string,
  items: ProgramTemplateItemInput[],
): Promise<ProgramTemplate> {
  const result = await insertProgramTemplate(
    organizationId,
    normalizeLabel(name),
    items.map(normalizeProgramTemplateItem),
  );
  return toProgramTemplate(result.template, result.items);
}

export async function addProgramTemplateItem(
  organizationId: string,
  templateId: string,
  item: ProgramTemplateItemInput,
): Promise<ProgramTemplateItem> {
  const row = await insertProgramTemplateItem(organizationId, templateId, normalizeProgramTemplateItem(item));
  if (!row) throw new ProgramTemplateNotFoundError();
  return toProgramTemplateItem(row);
}

export async function removeProgramTemplateItem(organizationId: string, itemId: string): Promise<void> {
  await deleteProgramTemplateItem(organizationId, itemId);
}

export async function removeProgramTemplate(organizationId: string, templateId: string): Promise<void> {
  await deleteProgramTemplate(organizationId, templateId);
}

export async function applyProgramTemplate(
  organizationId: string,
  eventId: string,
  templateId: string,
): Promise<ProgramItem[]> {
  const result = await applyProgramTemplateRows(organizationId, eventId, templateId);
  if (result.status !== "applied") {
    throw result.status === "event_not_found" ? new EventNotFoundError() : new ProgramTemplateNotFoundError();
  }
  return sortProgramItems(result.items.map(toProgramItem));
}

// EVT-06 — accès des mariés.

const CLIENT_INVITATION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours, comme HUB-03
// Longueur minimale d'un mot de passe de marié (recommandation CNIL pour un
// mot de passe seul, sans double authentification imposée).
const CLIENT_PASSWORD_MIN_LENGTH = 12;

// L'e-mail a déjà un compte professionnel ou un compte d'une autre
// organisation : un compte par personne (PRD EVT-06).
export class ClientEmailUnavailableError extends Error {
  constructor() {
    super("cet e-mail est déjà utilisé par un autre compte");
    this.name = "ClientEmailUnavailableError";
  }
}

export class ClientAlreadyInvitedError extends Error {
  constructor() {
    super("ce marié a déjà accès à l'événement");
    this.name = "ClientAlreadyInvitedError";
  }
}

export class ClientPasswordTooShortError extends Error {
  constructor() {
    super(`le mot de passe doit contenir au moins ${CLIENT_PASSWORD_MIN_LENGTH} caractères`);
    this.name = "ClientPasswordTooShortError";
  }
}

// Accès absent, retiré, ou demande hors de l'événement du marié : même
// réponse dans tous les cas, sans dire ce qui existe.
export class ClientAccessDeniedError extends Error {
  constructor() {
    super("accès refusé");
    this.name = "ClientAccessDeniedError";
  }
}

const emailSchema = z.email();

// Le jeton porte l'organisation en clair (« <organisation>.<secret> ») :
// la recherche se fait sous RLS dans cette organisation, et seul le haché
// du secret est stocké.
function hashClientToken(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function parseClientToken(token: string): { organizationId: string; secret: string } | null {
  const [organizationId, secret, ...rest] = token.split(".");
  if (rest.length > 0 || !secret || !z.uuid().safeParse(organizationId).success) return null;
  return { organizationId: organizationId!, secret };
}

function clientAccessStatus(row: EventClientAccessRow, now = new Date()): ClientAccessStatus {
  if (row.revokedAt) return "revoked";
  if (row.acceptedAt) return "active";
  return row.expiresAt.getTime() < now.getTime() ? "expired" : "invited";
}

function toEventClientAccess(row: EventClientAccessRow): EventClientAccess {
  return {
    id: row.id,
    eventId: row.eventId,
    email: row.email,
    status: clientAccessStatus(row),
    createdAt: row.createdAt.toISOString(),
  };
}

async function sendClientMail(email: string, locale: "fr" | "en", invitationUrl: string | null): Promise<void> {
  const appUrl = parseEnv(process.env).APP_PUBLIC_URL;
  // Service sans next-intl : deux variantes inline, comme l'invitation HUB-03.
  const fr = invitationUrl
    ? `Bonjour,\n\nVotre wedding planner vous invite à suivre la préparation de votre mariage sur Symbola. Créez votre compte avec ce lien, valable 7 jours :\n${invitationUrl}\n\nÀ bientôt,\nL'équipe Symbola`
    : `Bonjour,\n\nVotre wedding planner vous a ouvert l'accès à un nouvel événement sur Symbola. Connectez-vous pour le retrouver :\n${appUrl}/login\n\nÀ bientôt,\nL'équipe Symbola`;
  const en = invitationUrl
    ? `Hello,\n\nYour wedding planner invites you to follow your wedding preparations on Symbola. Create your account with this link, valid for 7 days:\n${invitationUrl}\n\nSee you soon,\nThe Symbola team`
    : `Hello,\n\nYour wedding planner has given you access to a new event on Symbola. Log in to find it:\n${appUrl}/login\n\nSee you soon,\nThe Symbola team`;
  await sendMail({
    to: email,
    subject: locale === "en" ? "Your wedding on Symbola" : "Votre mariage sur Symbola",
    text: locale === "en" ? en : fr,
  });
}

async function withAuthDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

export async function inviteEventClient(input: InviteEventClientInput): Promise<InviteEventClientResult> {
  const email = input.email.trim();
  if (!emailSchema.safeParse(email).success) throw new RangeError("e-mail invalide");

  const account = await withAuthDb((db) => findAccountByEmail(db, email));
  if (account && (account.role !== "client" || account.organizationId !== input.organizationId)) {
    throw new ClientEmailUnavailableError();
  }

  const secret = account ? null : randomBytes(32).toString("base64url");
  const result = await saveClientAccess({
    organizationId: input.organizationId,
    eventId: input.eventId,
    email,
    invitedByUserId: input.invitedByUserId,
    expiresAt: new Date(Date.now() + CLIENT_INVITATION_DURATION_MS),
    tokenHash: secret ? hashClientToken(secret) : null,
    userId: account?.id ?? null,
  });
  if (result.status === "event_not_found") throw new EventNotFoundError();
  if (result.status === "demo_event") throw new DemoEventRestrictionError();
  if (result.status !== "saved") throw new ClientAlreadyInvitedError();

  const invitationToken = secret ? `${input.organizationId}.${secret}` : null;
  const appUrl = parseEnv(process.env).APP_PUBLIC_URL;
  await sendClientMail(email, input.locale, invitationToken ? `${appUrl}/espace/invitation/${invitationToken}` : null);
  return { access: toEventClientAccess(result.access), invitationToken };
}

export async function listEventClientAccesses(organizationId: string, eventId: string): Promise<EventClientAccess[]> {
  return (await findEventClientAccesses(organizationId, eventId)).map(toEventClientAccess);
}

export async function revokeEventClientAccess(organizationId: string, accessId: string): Promise<void> {
  await revokeClientAccessRow(organizationId, accessId);
}

export async function acceptEventClientInvitation(token: string, password: string): Promise<AcceptClientInvitationResult> {
  const parsed = parseClientToken(token);
  if (!parsed) return { outcome: "invalid_or_expired" };
  const access = await findClientAccessByTokenHash(parsed.organizationId, hashClientToken(parsed.secret));
  if (!access) {
    return { outcome: "invalid_or_expired" };
  }
  if (access.acceptedAt) return { outcome: "already_accepted" };
  if (access.revokedAt || access.expiresAt.getTime() < Date.now()) return { outcome: "invalid_or_expired" };
  if (password.length < CLIENT_PASSWORD_MIN_LENGTH) throw new ClientPasswordTooShortError();

  const userId = await withAuthDb(async (db) => {
    const account = await findAccountByEmail(db, access.email);
    if (account) {
      if (account.role !== "client" || account.organizationId !== parsed.organizationId) {
        throw new ClientEmailUnavailableError();
      }
      return account.id;
    }
    const user = await createUser(db, {
      organizationId: parsed.organizationId,
      email: access.email,
      password,
      role: "client",
    });
    return user.id;
  });
  if (!(await markClientAccessAccepted(parsed.organizationId, access.id, userId))) {
    return { outcome: "already_accepted" };
  }
  return { outcome: "success", email: access.email };
}

export async function listClientEvents(organizationId: string, userId: string): Promise<EventSummary[]> {
  const eventIds = new Set(await findClientEventIds(organizationId, userId));
  if (eventIds.size === 0) return [];
  const rows = await findEvents(organizationId, {});
  return rows.filter(({ event }) => eventIds.has(event.id)).map(({ event, clients }) => toEventSummary(event, clients));
}

export async function getClientEventView(organizationId: string, userId: string, eventId: string): Promise<ClientEventView> {
  if (!(await hasActiveClientAccess(organizationId, userId, eventId))) throw new ClientAccessDeniedError();
  const found = await findEventById(organizationId, eventId);
  if (!found) throw new ClientAccessDeniedError();
  const [tasks, program] = await Promise.all([listEventTasks(organizationId, eventId), getEventProgram(organizationId, eventId)]);
  return {
    // Résumé seulement : ni source du prospect ni motif de perte.
    event: toEventSummary(found.event, found.clients),
    tasks,
    program: { items: programForVariant(program.items, "couple"), overlaps: [], updatedAt: program.updatedAt },
  };
}

export async function setClientTaskDone(
  organizationId: string,
  userId: string,
  taskId: string,
  done: boolean,
): Promise<EventTask> {
  const result = await toggleClientTask(organizationId, userId, taskId, done);
  if (result.status === "denied") throw new ClientAccessDeniedError();
  return toEventTask(result.task);
}

// Lot 13 (EVT-19) — date (calendrier de Paris) du dernier passage dans
// chaque statut : la frise de la fiche affiche la date de chaque étape.
export async function getEventStatusDates(organizationId: string, eventId: string): Promise<EventStatusDates> {
  const dates: EventStatusDates = {};
  for (const change of await findEventStatusChanges(organizationId, eventId)) dates[change.toStatus] = parisToday(change.changedAt);
  return dates;
}

export async function listEventActivity(organizationId: string, eventId: string): Promise<EventActivity[]> {
  return (await findEventActivity(organizationId, eventId)).map(({ activity, actorEmail }) => ({
    id: activity.id,
    kind: activity.kind,
    taskLabel: activity.taskLabel,
    actorEmail,
    createdAt: activity.createdAt.toISOString(),
  }));
}

// AIDE-02 — essai guidé (ADR 0008).

const TRIAL_DURATION_MS = 24 * 60 * 60 * 1000; // essai abandonné supprimé après 24 h (PRD, proposé)

// Action impossible sur un événement d'essai (ex. inviter un marié : jamais
// d'e-mail à un tiers depuis un essai).
export class DemoEventRestrictionError extends Error {
  constructor() {
    super("action indisponible pendant l'essai");
    this.name = "DemoEventRestrictionError";
  }
}

function toTrial(event: EventRow): EventsTrial {
  return { eventId: event.id, expiresAt: event.demoExpiresAt!.toISOString() };
}

// Événement fictif complet, construit depuis les modèles de départ : la
// planner y fait de vraies opérations (statut, postes, tâches, programme)
// sans toucher à ses données.
export async function startEventsTrial(input: StartEventsTrialInput): Promise<EventsTrial> {
  const now = input.now ?? new Date();
  const active = await findActiveDemoEvent(input.organizationId, now);
  if (active) return toTrial(active);

  const demo = starterDemoEvent(input.locale);
  const eventDate = addDays(now.toISOString().slice(0, 10), demo.daysFromToday);
  const retroplanning = starterRetroplanning(input.locale);
  const program = starterProgram(input.locale);
  const event = await insertDemoEvent(input.organizationId, {
    createdByUserId: input.userId,
    eventDate,
    expiresAt: new Date(now.getTime() + TRIAL_DURATION_MS),
    clients: demo.clients,
    venueName: demo.venueName,
    venueCity: demo.venueCity,
    fallbackVendorSlotLabels: starterVendorSlots(input.locale),
    tasks: retroplanning.items.map((item) => ({
      label: item.label,
      dueDate: addDays(eventDate, item.offsetDays),
      responsible: item.responsible,
    })),
    programItems: program.items,
  });
  return toTrial(event);
}

// Lot 10 (AIDE-06) — événement fictif d'un tutoriel « en faisant » : son type
// (anniversaire, séminaire, mariage…) et ses données viennent des modèles de
// départ ; marqué démo, supprimé avec le tutoriel ou au bout de 24 h comme
// l'essai guidé. withPlanning : avec ou sans rétroplanning et programme de
// départ (un tutoriel qui fait appliquer un modèle part d'un événement vide).
export async function startTutorialEvent(input: StartEventsTrialInput & { tutorialKey: string }): Promise<EventsTrial & { kind: string }> {
  const now = input.now ?? new Date();
  const example = starterTutorialEvent(input.tutorialKey, input.locale);
  if (!example) throw new Error(`aucun exemple pour le tutoriel ${input.tutorialKey}`);
  const eventDate = addDays(now.toISOString().slice(0, 10), example.daysFromToday);
  const retroplanning = starterRetroplanning(input.locale);
  const event = await insertDemoEvent(input.organizationId, {
    createdByUserId: input.userId,
    eventDate,
    expiresAt: new Date(now.getTime() + TRIAL_DURATION_MS),
    clients: example.clients,
    venueName: example.venueName,
    venueCity: example.venueCity,
    fallbackVendorSlotLabels: starterVendorSlots(input.locale),
    tasks: example.withPlanning
      ? retroplanning.items.map((item) => ({ label: item.label, dueDate: addDays(eventDate, item.offsetDays), responsible: item.responsible }))
      : [],
    programItems: example.withPlanning ? starterProgram(input.locale).items : [],
  });
  return { ...toTrial(event), kind: example.kind };
}

export async function getActiveEventsTrial(organizationId: string, now: Date = new Date()): Promise<EventsTrial | null> {
  const event = await findActiveDemoEvent(organizationId, now);
  return event ? toTrial(event) : null;
}

// Les devis joints aux consultés d'un essai partent avec lui (lot 11).
async function demoCandidateQuoteKeys(expired: { organizationId: string; eventId: string }[]): Promise<string[]> {
  const keys: string[] = [];
  for (const organizationId of new Set(expired.map((entry) => entry.organizationId))) {
    const eventIds = expired.filter((entry) => entry.organizationId === organizationId).map((entry) => entry.eventId);
    keys.push(...(await candidateQuoteKeys(organizationId, eventIds, { demoOnly: true })));
  }
  return keys;
}

export async function endEventsTrial(organizationId: string, eventId: string): Promise<void> {
  const keys = await candidateQuoteKeys(organizationId, [eventId], { demoOnly: true });
  await deleteDemoEvent(organizationId, eventId);
  await deleteStoredFiles(keys);
}

export async function purgeExpiredDemoEvents(organizationId: string, now: Date = new Date()): Promise<number> {
  return purgeExpiredDemoEventsForOrganizations([organizationId], now);
}

// Purge planifiée : toutes les organisations en un passage.
export async function purgeExpiredDemoEventsForOrganizations(
  organizationIds: string[],
  now: Date = new Date(),
): Promise<number> {
  const keys = await demoCandidateQuoteKeys(await findExpiredDemoEventIds(organizationIds, now));
  const purged = await deleteExpiredDemoEvents(organizationIds, now);
  await deleteStoredFiles(keys);
  return purged;
}

// Essais expirés (organisation, événement) : les autres modules y
// purgent leurs données avant purgeExpiredDemoEvents (lib/demo-purge.ts).
export async function listExpiredDemoEvents(
  organizationIds: string[],
  now: Date = new Date(),
): Promise<{ organizationId: string; eventId: string }[]> {
  return findExpiredDemoEventIds(organizationIds, now);
}

// Tableau de bord (AIDE-04) : un événement d'essai ne compte pas.
export async function hasRealEvents(organizationId: string): Promise<boolean> {
  return (await countRealEvents(organizationId)) > 0;
}

// Lot 9 (ADR 0029) — statistique d'usage pour l'Admin : événements réels
// créés par mois, essais exclus, pour plusieurs organisations à la fois.
export async function countEventsCreatedByMonth(organizationIds: string[], since: Date): Promise<Record<string, MonthlyCount[]>> {
  return countEventsByCreationMonth(organizationIds, since);
}

// Lot 10 (AIDE-08) — recherche globale : événements, tâches et prestataires
// réels de l'organisation dont le texte contient chacun des mots.
export async function searchEvents(organizationId: string, words: string[], limit: number): Promise<EventsSearchResults> {
  return searchEventRows(organizationId, words, limit);
}

export async function getEventNamesByIds(organizationId: string, eventIds: string[]): Promise<Record<string, string>> {
  return findEventNamesByIds(organizationId, eventIds);
}

// Lot 3 (BUD-04) : exposition publique de la vérification déjà utilisée en
// interne par getClientEventView — le module budget en a besoin pour sa
// propre vue en lecture seule du marié.
export { hasActiveClientAccess };

// IMP-05 — fonctions d'import (lot 5, ADR 0022) : écriture d'un lot de
// lignes, détection des modifications à la main, annulation.
export {
  findModifiedImportedEventsElements,
  importedEventIds,
  importEventRows,
  importListRows,
  importTaskRows,
  importVendorSlotsForBudget,
  readImportedEventsElements,
  undoImportedEventsElements,
} from "./import";

const _contractCheck: EventsServiceContract = {
  listEventPlaces,
  addEventPlace,
  removeEventPlace,
  setVendorSlotBrief,
  listVendorCandidates,
  addVendorCandidate,
  updateVendorCandidate,
  linkVendorCandidate,
  removeVendorCandidate,
  attachVendorCandidateQuote,
  getVendorCandidateQuoteFile,
  addVendorCandidateNote,
  setVendorCandidateNoteVisibility,
  removeVendorCandidateNote,
  selectVendorCandidate,
  listVendorConsultations,
  listSelectedVendorIds,
  getClientVendorOptions,
  getClientVendorQuoteFile,
  getClientSharedRibVendorId,
  listEvents,
  listStaleProspects,
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
  addProspectSources,
  addLossReasons,
  listOrganizationTasks,
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
  getEventProgram,
  addProgramItem,
  updateProgramItem,
  removeProgramItem,
  listProgramTemplates,
  createProgramTemplate,
  addProgramTemplateItem,
  removeProgramTemplateItem,
  removeProgramTemplate,
  applyProgramTemplate,
  inviteEventClient,
  listEventClientAccesses,
  revokeEventClientAccess,
  acceptEventClientInvitation,
  listClientEvents,
  getClientEventView,
  setClientTaskDone,
  listEventActivity,
  getEventStatusDates,
  startEventsTrial,
  getActiveEventsTrial,
  endEventsTrial,
  purgeExpiredDemoEvents,
  hasRealEvents,
  countEventsCreatedByMonth,
  searchEvents,
  getEventNamesByIds,
  startTutorialEvent,
  hasActiveClientAccess,
  listExpiredDemoEvents,
};
void _contractCheck;

// Lot 6 (RGPD-05) — données nécessaires aux règles de conservation.
export { listRetentionEvents, type RetentionEvent } from "./privacy-retention";
