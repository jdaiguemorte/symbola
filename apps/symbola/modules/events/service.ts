// Porte d'entrée publique du module events — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/events si ce module est extrait en app autonome.
import { z } from "zod";
import { formatCalendarDate, parisDaysSince, parisToday } from "@symbola/i18n";
import { listTeam } from "@symbola/auth";
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { MailQuotaExceededError, reserveOrganizationMail, sendMail } from "@symbola/mail";
import { starterClientTaskReminders, starterDemoEvent, starterLinkExpiry, starterLinkProfiles, starterProgram, starterRetroplanning, starterTutorialEvent, starterVendorSlots, type StarterLinkProfile } from "@symbola/starter-templates";
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
  findEventActivity,
  findEventStatusChanges,
  applyProgramTemplateRows,
  applyTaskTemplateRows,
  deleteProgramItem,
  deleteProgramTemplate,
  deleteProgramTemplateItem,
  renameProgramTemplateRow,
  updateProgramTemplateItemRow,
  findEventProgram,
  findProgramTemplates,
  insertProgramItem,
  insertProgramTemplate,
  insertProgramTemplateItem,
  updateProgramItemRow,
  shiftProgramItemRows,
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
  renameTaskTemplateRow,
  updateTaskTemplateItemRow,
  findDefaultVendorSlots,
  findEventById,
  findEvents,
  findEventTasks,
  findOrganizationTasks,
  findCandidateStatuses,
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
  reorderDefaultVendorSlotRows,
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
  updateEventClientContactRow,
  updateWantedBudgetRow,
  updateVenueRow,
} from "./repository";
import {
  addStarterEventTypes,
  assertEventTypeOf,
  countEventsByType,
  createEventType,
  EventTypeInUseError,
  EventTypeNotFoundError,
  findEventAudience,
  findEventAudiences,
  LastEventTypeError,
  listEventTypes,
  removeEventType,
  setEventTypeOfEvent,
  updateEventType,
} from "./event-types";
import { addDays } from "./schedule";
import {
  attemptLinkCodeRow,
  deleteLinkSessionRow,
  findEventLinkRows,
  findLinkByTokenHash,
  findLinkNameRows,
  findLinkRow,
  findLinkSessionRow,
  findLinkVendorRow,
  findPendingRenewalRows,
  findReminderCandidateRows,
  insertTaskRemindersRow,
  insertLinkRow,
  insertLinkSessionRow,
  issueLinkCodeRow,
  markLinkRenewalRequestedRow,
  replaceLinkTokenRow,
  revokeLinkRow,
  rightsOf,
  toggleLinkTaskRow,
  touchLinkSessionRow,
  updateLinkRow,
  type LinkFields,
  type LinkWithContext,
} from "./links-repository";
import {
  formatLinkToken,
  hashLinkSecret,
  isLinkExpired,
  linkExpiresOn,
  linkSessionExpiresAt,
  linkStatus,
  newLinkSecret,
  normalizeLinkRights,
  parseLinkToken,
  parisStartOfDay,
} from "./link-tokens";
import { isSendingHour, reminderMail, reminderThreshold, type ReminderTask } from "./task-reminders";
import { answerDecisionRow, findDecisionRow, findDecisionRows, insertDecisionRow, replacementsOf, withdrawDecisionRow, type EventDecisionRow } from "./decisions-repository";
import { findPendingDecisions, findUncontractedVendors, insertVendorReminder } from "./today-sources";
import { VendorCandidateNotFoundError as CandidateNotFoundError } from "./vendor-candidates";
import { answerProblem, DECISION_NOTE_MAX, decisionOpenTo, programChangedSince } from "./decisions";
import { hashLinkCode, LINK_CODE_TTL_MS, LINK_CODES_PER_HOUR, linkCodeExpiresAt, maskEmail, newLinkCode, normalizeLinkCode } from "./link-otp";
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
  getCandidate,
  getCandidateQuoteFile,
  linkCandidate,
  listCandidates,
  listConsultations,
  listSelectedVendors,
  removeCandidate,
  removeCandidateNote,
  retainVendorByName,
  retainedVendorsBySlot,
  selectCandidate,
  sharedRibVendorId,
  setCandidateNoteVisibility,
  setSlotBrief,
  updateCandidate,
} from "./vendor-candidates";
import { addDayContact, listDayContacts, removeDayContact } from "./day-contacts";
import { attachDocument, documentKeys, getDocumentFile, listDayChoices, listDocuments, removeDocument, renameDocument, setDayChoice } from "./documents";
import { findProgramOverlaps, MAX_SHIFT_MINUTES, normalizeTime, programForVariant, sortProgramItems } from "./program";
import { endTimeAfter, MINUTES_PER_DAY } from "@/lib/program-spans";
import type {
  PendingDecision,
  UncontractedVendor,
  EventPlace,
  AttachEventDocumentInput,
  DayDocumentChoice,
  EventDocument,
  EventDayContact,
  EventDayContactInput,
  SetDayDocumentEmbeddedInput,
  EventTypeAudience,
  AddVendorCandidateInput,
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
  ClientEventView,
  CreateEventLinkInput,
  EventActivity,
  EventLink,
  EventLinkDelivery,
  EventLinkInput,
  LinkAccess,
  LinkAudience,
  LinkRubric,
  OpenEventLinkResult,
  RenewEventLinkInput,
  VendorLinkView,
  VerifyLinkCodeResult,
  AnswerDecisionInput,
  DecisionKind,
  DecisionOption,
  DecisionSnapshot,
  DecisionStatus,
  EventDecision,
  RequestDecisionInput,
  ClientVendorSlotOptions,
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
  RetainedVendor,
  VendorCandidateStatus,
  VendorSlotProgress,
  VendorSlotStatus,
} from "@symbola/contracts";

export { eventsPrivacy } from "./privacy";
export { monthKey } from "./schedule";
export { programForVariant, type ProgramVariant } from "./program";
// Lot 30b (CHR-06, décision D8) : proposition de décalage, calculée par l'écran après
// le changement d'une heure de début.
export { proposeProgramShift } from "./program";

export type {
  EventType,
  EventTypeAudience,
  EventTypeInput,
  StarterEventTypeInput,
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
  RetainedVendor,
  UpdateEventVendorSlotInput,
  VendorSlotProgress,
  VendorSlotStatus,
  AddVendorCandidateInput,
  EventPlace,
  AttachEventDocumentInput,
  DayDocumentChoice,
  EventDocument,
  EventDayContact,
  EventDayContactInput,
  SetDayDocumentEmbeddedInput,
  ClientVendorOption,
  ClientVendorSlotOptions,
  UpdateVendorCandidateInput,
  VendorCandidate,
  VendorCandidateNote,
  VendorCandidateStatus,
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
  ClientEventView,
  CreateEventLinkInput,
  EventActivity,
  EventActivityKind,
  EventLink,
  EventLinkDelivery,
  EventLinkInput,
  EventLinkRights,
  EventLinkStatus,
  LinkAccess,
  LinkAudience,
  LinkBudgetScope,
  LinkRubric,
  OpenEventLinkResult,
  RenewEventLinkInput,
  VendorLinkView,
  VerifyLinkCodeResult,
  AnswerDecisionInput,
  DecisionKind,
  DecisionOption,
  DecisionSnapshot,
  DecisionStatus,
  EventDecision,
  RequestDecisionInput,
  EventsTrial,
  StartEventsTrialInput,
} from "@symbola/contracts";

function toEventClient(row: EventClientRow): EventClient {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    position: row.position,
    email: row.email,
    phone: row.phone,
    addressLine: row.addressLine,
    postalCode: row.postalCode,
    city: row.city,
  };
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
    eventTypeId: event.eventTypeId,
    lossReasonId: event.lossReasonId,
    lossReasonNote: event.lossReasonNote,
    tasksScheduledFor: event.tasksScheduledFor,
    wantedBudgetCents: event.wantedBudgetCents,
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

// Lot 13 (L13-HUB-15) — prospects sans nouvelle depuis au moins `days` jours
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
  if (input.eventTypeId) await assertEventTypeOf(input.organizationId, input.eventTypeId);
  const event = await insertProspect({
    organizationId: input.organizationId,
    createdByUserId: input.createdByUserId,
    clients: input.clients,
    prospectSourceId: input.prospectSourceId,
    eventTypeId: input.eventTypeId ?? null,
    eventDate: input.eventDate,
    venueName: input.venueName,
    venueCity: input.venueCity,
  });
  return { id: event.id };
}

export async function changeEventStatus(input: ChangeEventStatusInput): Promise<void> {
  await updateEventStatus(input);
}

// Lot 16 (ADR 0045) — types d'événement (modules/events/event-types.ts).
export {
  addStarterEventTypes,
  countEventsByType,
  createEventType,
  EventTypeInUseError,
  EventTypeNotFoundError,
  LastEventTypeError,
  listEventTypes,
  removeEventType,
  updateEventType,
};

export async function setEventType(organizationId: string, eventId: string, eventTypeId: string): Promise<void> {
  if (!(await setEventTypeOfEvent(organizationId, eventId, eventTypeId))) throw new EventNotFoundError();
}

// Qui sont les clients de l'événement (« les mariés » ou « le client ») ; nul
// s'il n'a pas de type : le vocabulaire suit alors le métier.
export async function getEventAudience(organizationId: string, eventId: string): Promise<EventTypeAudience | null> {
  return findEventAudience(organizationId, eventId);
}

// Lot 20 (décision 6) : le vocabulaire de chaque événement, par identifiant.
export async function listEventAudiences(organizationId: string): Promise<Map<string, EventTypeAudience | null>> {
  return findEventAudiences(organizationId);
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

// PRD-EVT-07 — ajout en lot (listes de départ, ONB-01) : les libellés déjà
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

// PRD-EVT-03 — postes prestataires.

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

// Lot 14 (décision I) — coordonnées d'un client : e-mail vérifié, valeurs
// vides enregistrées comme absentes.
export class InvalidClientContactError extends Error {
  constructor() {
    super("coordonnées invalides");
    this.name = "InvalidClientContactError";
  }
}

const CONTACT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateEventClientContact(input: {
  organizationId: string;
  eventId: string;
  clientId: string;
  contact: Partial<Record<"email" | "phone" | "addressLine" | "postalCode" | "city", string | null>>;
}): Promise<void> {
  const clean = (value: string | null | undefined) => (value?.trim() ? value.trim().slice(0, 300) : null);
  const contact = {
    email: clean(input.contact.email),
    phone: clean(input.contact.phone),
    addressLine: clean(input.contact.addressLine),
    postalCode: clean(input.contact.postalCode),
    city: clean(input.contact.city),
  };
  if (contact.email && !CONTACT_EMAIL.test(contact.email)) throw new InvalidClientContactError();
  if (!(await updateEventClientContactRow(input.organizationId, input.eventId, input.clientId, contact))) throw new EventNotFoundError();
}

// Lot 14 (décision K) — budget souhaité, en centimes (null : effacé).
export async function setEventWantedBudget(organizationId: string, eventId: string, wantedBudgetCents: number | null): Promise<void> {
  if (wantedBudgetCents !== null && (!Number.isInteger(wantedBudgetCents) || wantedBudgetCents < 0)) throw new RangeError("montant invalide");
  if (!(await updateWantedBudgetRow(organizationId, eventId, wantedBudgetCents))) throw new EventNotFoundError();
}

// Lot 31b (FAC-04, DOC-02) — lieu de l'événement (nom, ville), pour que la variable
// {evenement.lieu} d'un contrat se comble ; vide : effacé.
export async function setEventVenue(organizationId: string, eventId: string, venue: { venueName: string | null; venueCity: string | null }): Promise<void> {
  const clean = (value: string | null) => {
    const text = value?.trim() ?? "";
    if (text.length > 200) throw new RangeError("lieu trop long");
    return text || null;
  };
  if (!(await updateVenueRow(organizationId, eventId, { venueName: clean(venue.venueName), venueCity: clean(venue.venueCity) }))) throw new EventNotFoundError();
}

export class VendorSlotNotFoundError extends Error {
  constructor() {
    super("poste introuvable");
    this.name = "VendorSlotNotFoundError";
  }
}

// Lot 28a (PRE-02, décision D3) : statuts des prestataires rattachés, et
// statut affiché d'un poste, déduit de ses prestataires.
export { ENGAGED_CANDIDATE_STATUSES, VENDOR_CANDIDATE_STATUSES } from "@symbola/contracts";

const SLOT_STATUS_ORDER: VendorSlotStatus[] = ["shortlisted", "contacted", "quote_received", "retained", "contract_signed", "paid_off"];

export function deriveSlotStatus(notRequired: boolean, candidateStatuses: VendorCandidateStatus[]): VendorSlotStatus {
  if (notRequired) return "not_required";
  const rank = Math.max(-1, ...candidateStatuses.map((status) => SLOT_STATUS_ORDER.indexOf(status as VendorSlotStatus)));
  return rank < 0 ? "to_find" : SLOT_STATUS_ORDER[rank]!;
}

function toDefaultVendorSlot(row: DefaultVendorSlotRow): DefaultVendorSlot {
  return { id: row.id, label: row.label, icon: row.icon, position: row.position };
}

function toEventVendorSlot(row: EventVendorSlotRow, candidateStatuses: VendorCandidateStatus[] = [], retainedVendors: RetainedVendor[] = []): EventVendorSlot {
  return {
    id: row.id,
    eventId: row.eventId,
    label: row.label,
    status: deriveSlotStatus(row.notRequired, candidateStatuses),
    notRequired: row.notRequired,
    retainedVendors,
    position: row.position,
    ...(row.importedFields ? { importedFields: row.importedFields } : {}),
    brief: row.brief,
    icon: row.icon,
  };
}

// Barre d'avancement de la fiche : postes engagés (un prestataire retenu, au
// moins) sur postes requis (un poste « Non requis » ne compte pas).
export function summarizeVendorSlots(slots: Pick<EventVendorSlot, "status">[]): VendorSlotProgress {
  const required = slots.filter((slot) => slot.status !== "not_required");
  return { booked: required.filter((slot) => ENGAGED_SLOT_STATUSES.has(slot.status)).length, required: required.length };
}

const ENGAGED_SLOT_STATUSES = new Set<VendorSlotStatus>(["retained", "contract_signed", "paid_off"]);

export async function listDefaultVendorSlots(organizationId: string): Promise<DefaultVendorSlot[]> {
  return (await findDefaultVendorSlots(organizationId)).map(toDefaultVendorSlot);
}

export async function addDefaultVendorSlots(
  organizationId: string,
  entries: (string | { label: string; icon?: string | null })[],
): Promise<DefaultVendorSlot[]> {
  return (await insertDefaultVendorSlots(organizationId, entries)).map(toDefaultVendorSlot);
}

// Lot 12 (L12-EVT-17) : renommer une ligne du budget par défaut, changer son icône.
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

// Lot 13 (L13-HUB-16) — ordre des lignes du budget, changé par glisser-déposer
// ou au clavier ; les nouveaux événements les reçoivent dans cet ordre.
export async function reorderDefaultVendorSlots(organizationId: string, orderedIds: string[]): Promise<void> {
  if (!(await reorderDefaultVendorSlotRows(organizationId, orderedIds))) throw new VendorSlotNotFoundError();
}

export async function listEventVendorSlots(organizationId: string, eventId: string): Promise<EventVendorSlot[]> {
  const [rows, statuses, retained] = await Promise.all([
    findEventVendorSlots(organizationId, eventId),
    findCandidateStatuses(organizationId, [eventId]),
    retainedVendorsBySlot(organizationId, [eventId]),
  ]);
  return rows.map((row) =>
    toEventVendorSlot(
      row,
      statuses.filter((entry) => entry.vendorSlotId === row.id).map((entry) => entry.status),
      retained.get(row.id) ?? [],
    ),
  );
}

export async function addEventVendorSlot(organizationId: string, eventId: string, label: string): Promise<EventVendorSlot> {
  const row = await insertEventVendorSlot(organizationId, eventId, label.trim());
  if (!row) throw new EventNotFoundError();
  return toEventVendorSlot(row);
}

// Lot 28a (PRE-02) : « Non requis », ou le raccourci « prestataire retenu » du
// formulaire du poste (un nom retient ce prestataire au montant donné ; lot 28b :
// il s'ajoute aux prestataires déjà retenus du poste).
export async function updateEventVendorSlot(input: UpdateEventVendorSlotInput): Promise<void> {
  const vendorName = typeof input.vendorName === "string" ? input.vendorName.trim() || null : null;
  const amountCents = input.amountCents ?? null;
  if (amountCents !== null && (!Number.isInteger(amountCents) || amountCents < 0)) {
    throw new RangeError("le montant doit être un nombre entier positif de centimes");
  }
  if (amountCents !== null && !vendorName) throw new VendorNameRequiredError();
  if (input.notRequired !== undefined) {
    const row = await updateEventVendorSlotRow({ organizationId: input.organizationId, vendorSlotId: input.vendorSlotId, notRequired: input.notRequired });
    if (!row) throw new VendorSlotNotFoundError();
  }
  if (vendorName) {
    await retainVendorByName({ organizationId: input.organizationId, vendorSlotId: input.vendorSlotId, vendorName, amountCents, changedByUserId: input.changedByUserId });
  }
}

export async function removeEventVendorSlot(organizationId: string, vendorSlotId: string): Promise<void> {
  const keys = await candidateQuoteKeysOfSlot(organizationId, vendorSlotId);
  await deleteEventVendorSlot(organizationId, vendorSlotId);
  await deleteStoredFiles(keys);
}

// Lot 12 (L12-EVT-15) — lieux de l'événement.
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

// Lot 11 (L11-EVT-10 / L11-EVT-11, ADR 0031) — prestataires consultés par poste.

export { CandidateQuoteRejectedError, VendorCandidateNotFoundError, CANDIDATE_QUOTE_MAX_SIZE_BYTES } from "./vendor-candidates";
export { DayContactInvalidError, EventDayContactNotFoundError } from "./day-contacts";
export { DayDocumentSourceError, EventDocumentNotFoundError, EventDocumentRejectedError, EVENT_DOCUMENT_MAX_SIZE_BYTES, EVENT_DOCUMENT_LABEL_MAX } from "./documents";

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

// Lot 28b (BUD-01) : un prestataire rattaché, pour le module Budget (nom, poste, devis).
export async function getVendorCandidate(organizationId: string, candidateId: string): Promise<VendorCandidate | null> {
  return getCandidate(organizationId, candidateId);
}

export async function listVendorConsultations(organizationId: string, vendorId: string): Promise<VendorConsultation[]> {
  return listConsultations(organizationId, vendorId, (eventIds) => findEventNamesByIds(organizationId, eventIds));
}

export async function listSelectedVendorIds(organizationId: string): Promise<string[]> {
  return listSelectedVendors(organizationId);
}

// L11-EVT-11, lot 26a : options montrées au tiers dont le lien ouvre la
// rubrique « Options de prestataires » ; l'événement est celui du lien.
export async function getLinkVendorOptions(organizationId: string, linkId: string): Promise<ClientVendorSlotOptions[]> {
  const access = await requireLinkRubric(organizationId, linkId, "vendor_options");
  return clientOptions(organizationId, access.eventId);
}

export async function getLinkVendorQuoteFile(organizationId: string, linkId: string, candidateId: string): Promise<FileDownload> {
  const access = await requireLinkRubric(organizationId, linkId, "vendor_options");
  return clientQuoteFile(organizationId, access.eventId, candidateId);
}

export async function getLinkSharedRibVendorId(organizationId: string, linkId: string, candidateId: string): Promise<string> {
  const access = await requireLinkRubric(organizationId, linkId, "vendor_options");
  return sharedRibVendorId(organizationId, access.eventId, candidateId);
}

// Lot 29b (JRJ-04, décision D8) — documents de l'événement et documents
// embarqués pour le jour J (documents.ts).
export async function listEventDocuments(organizationId: string, eventId: string): Promise<EventDocument[]> {
  return listDocuments(organizationId, eventId);
}

export async function attachEventDocument(input: AttachEventDocumentInput): Promise<EventDocument> {
  const document = await attachDocument(input);
  if (!document) throw new EventNotFoundError();
  return document;
}

export async function renameEventDocument(organizationId: string, documentId: string, label: string): Promise<void> {
  await renameDocument(organizationId, documentId, label);
}

export async function removeEventDocument(organizationId: string, documentId: string): Promise<void> {
  await removeDocument(organizationId, documentId);
}

export async function getEventDocumentFile(organizationId: string, documentId: string): Promise<FileDownload> {
  return getDocumentFile(organizationId, documentId);
}

export async function listDayDocumentChoices(organizationId: string, eventId: string): Promise<DayDocumentChoice[]> {
  return listDayChoices(organizationId, eventId);
}

export async function setDayDocumentEmbedded(input: SetDayDocumentEmbeddedInput): Promise<void> {
  await setDayChoice(input);
}

// Lot 30a (JRJ-03, décision D4) — contacts du jour J (day-contacts.ts).
export async function listEventDayContacts(organizationId: string, eventId: string): Promise<EventDayContact[]> {
  return listDayContacts(organizationId, eventId);
}

export async function addEventDayContact(organizationId: string, eventId: string, input: EventDayContactInput): Promise<EventDayContact> {
  const contact = await addDayContact(organizationId, eventId, input);
  if (!contact) throw new EventNotFoundError();
  return contact;
}

export async function removeEventDayContact(organizationId: string, contactId: string): Promise<void> {
  await removeDayContact(organizationId, contactId);
}

async function deleteStoredFiles(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const storage = createStorageClient();
  for (const key of keys) await deletePrivateObject(storage, key).catch(() => undefined);
}

// PRD-EVT-04 — rétroplanning.

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

// Lot 21 (L21-EVT-22) : modifier une ligne et renommer un modèle de rétroplanning.
export async function updateTaskTemplateItem(organizationId: string, itemId: string, item: TaskTemplateItemInput): Promise<TaskTemplateItem> {
  const row = await updateTaskTemplateItemRow(organizationId, itemId, normalizeTemplateItem(item));
  if (!row) throw new TaskTemplateNotFoundError();
  return toTaskTemplateItem(row);
}

export async function renameTaskTemplate(organizationId: string, templateId: string, name: string): Promise<void> {
  if (!(await renameTaskTemplateRow(organizationId, templateId, normalizeLabel(name)))) throw new TaskTemplateNotFoundError();
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

// PRD-HUB-02 — tâches de toute l'organisation (accueil, écran Tâches), triées
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

// PRD-EVT-05 — programme du jour J.

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

// Lot 30b (CHR-06, décisions D6 et D7) : responsable trop long, durée hors d'une journée.
export class ProgramItemInvalidError extends Error {
  constructor(readonly reason: "responsible" | "duration") {
    super(`ligne du programme invalide : ${reason}`);
    this.name = "ProgramItemInvalidError";
  }
}

// Lot 30b (CHR-06, décision D8) : le décalage ferait sortir un début du jour J.
export class ProgramShiftOutOfDayError extends Error {
  constructor() {
    super("décalage hors du jour J");
    this.name = "ProgramShiftOutOfDayError";
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

// Lot 30b (D7) : sans heure de fin, une durée la donne (une journée au plus).
function programEndTime(startTime: string, input: ProgramItemInput): string | null {
  if (optionalText(input.endTime) !== null) return normalizeTime(input.endTime!.trim());
  const duration = input.durationMinutes;
  if (duration === null || duration === undefined) return null;
  if (!Number.isInteger(duration) || duration < 1 || duration > MINUTES_PER_DAY) throw new ProgramItemInvalidError("duration");
  return endTimeAfter(startTime, duration);
}

function normalizeProgramItem(input: ProgramItemInput): ProgramItemData {
  const startTime = normalizeTime(input.startTime);
  const responsible = optionalText(input.responsible)?.replace(/\s+/g, " ") ?? null;
  if (responsible !== null && responsible.length > 120) throw new ProgramItemInvalidError("responsible");
  return {
    startTime,
    endTime: programEndTime(startTime, input),
    label: normalizeLabel(input.label),
    location: optionalText(input.location),
    internalNote: optionalText(input.internalNote),
    responsible,
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
    responsible: item.responsible,
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

// Lot 30b (CHR-06, décision D8) : décale des séquences de l'événement, début et fin ;
// sert aussi à annuler (décalage opposé). Tout ou rien.
export async function shiftProgramItems(organizationId: string, eventId: string, itemIds: string[], minutes: number): Promise<ProgramItem[]> {
  const ids = [...new Set(itemIds)];
  if (!Number.isInteger(minutes) || minutes === 0 || Math.abs(minutes) > MAX_SHIFT_MINUTES || ids.length === 0) throw new RangeError("décalage invalide");
  const result = await shiftProgramItemRows(organizationId, eventId, ids, minutes);
  switch (result.status) {
    case "shifted":
      return sortProgramItems(result.items.map(toProgramItem));
    case "event_not_found":
      throw new EventNotFoundError();
    case "item_not_found":
      throw new ProgramItemNotFoundError();
    case "out_of_day":
      throw new ProgramShiftOutOfDayError();
  }
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

// Lot 21 (L21-EVT-21) : modifier une ligne et renommer un modèle de programme.
export async function updateProgramTemplateItem(organizationId: string, itemId: string, item: ProgramTemplateItemInput): Promise<ProgramTemplateItem> {
  const row = await updateProgramTemplateItemRow(organizationId, itemId, normalizeProgramTemplateItem(item));
  if (!row) throw new ProgramTemplateNotFoundError();
  return toProgramTemplateItem(row);
}

export async function renameProgramTemplate(organizationId: string, templateId: string, name: string): Promise<void> {
  if (!(await renameProgramTemplateRow(organizationId, templateId, normalizeLabel(name)))) throw new ProgramTemplateNotFoundError();
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

// Lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15, SEC-17 ; ADR 0053) — liens
// personnels des tiers, qui remplacent les comptes des mariés (ADR 0020). Le
// lien n'est montré qu'une fois (décision D10), à la création et au
// renouvellement : seul son haché reste en base.

export class EventLinkInvalidError extends Error {
  constructor(readonly reason: "name" | "email" | "expiry" | "client" | "slot" | "audience" | "vendor") {
    super(`lien personnel invalide : ${reason}`);
    this.name = "EventLinkInvalidError";
  }
}

export class EventLinkNotFoundError extends Error {
  constructor() {
    super("lien personnel introuvable");
    this.name = "EventLinkNotFoundError";
  }
}

// Lien absent, retiré ou expiré, rubrique fermée, objet d'un autre événement :
// même réponse dans tous les cas, sans dire ce qui existe (SEC-13).
export class LinkAccessDeniedError extends Error {
  constructor() {
    super("accès refusé");
    this.name = "LinkAccessDeniedError";
  }
}

const emailSchema = z.email();
const LINK_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PERSON_NAME_MAX = 120;
// Liens du client (lot 26a) et du prestataire (lot 26b) ; l'invité viendra au lot 49.
const CREATABLE_AUDIENCES: readonly LinkAudience[] = ["client", "vendor"];
// Une session de lien n'est réécrite qu'au plus toutes les cinq minutes.
const LINK_SESSION_TOUCH_MS = 5 * 60 * 1000;

function validLinkFields(input: EventLinkInput): LinkFields {
  const personName = input.personName.trim().slice(0, PERSON_NAME_MAX);
  if (!personName) throw new EventLinkInvalidError("name");
  const email = input.email.trim();
  if (!emailSchema.safeParse(email).success) throw new EventLinkInvalidError("email");
  const customExpiresOn = input.customExpiresOn?.trim() || null;
  if (customExpiresOn && (!LINK_DATE_PATTERN.test(customExpiresOn) || Number.isNaN(Date.parse(`${customExpiresOn}T00:00:00Z`)))) {
    throw new EventLinkInvalidError("expiry");
  }
  return {
    personName,
    email,
    eventClientId: input.eventClientId || null,
    rights: normalizeLinkRights(input.rights),
    customExpiresOn,
    otpRequired: input.otpRequired === true,
    taskReminders: input.taskReminders !== false,
  };
}

function linkWriteError(status: "event_not_found" | "demo_event" | "invalid_client" | "invalid_slot" | "invalid_vendor" | "not_found"): Error {
  if (status === "event_not_found") return new EventNotFoundError();
  if (status === "demo_event") return new DemoEventRestrictionError();
  if (status === "not_found") return new EventLinkNotFoundError();
  if (status === "invalid_vendor") return new EventLinkInvalidError("vendor");
  return new EventLinkInvalidError(status === "invalid_client" ? "client" : "slot");
}

function expiresOnOf(context: LinkWithContext): string {
  return linkExpiresOn({
    audience: context.link.audience,
    customExpiresOn: context.link.customExpiresOn,
    eventDate: context.event.eventDate,
    createdAt: context.link.createdAt,
  });
}

function toEventLink(context: LinkWithContext, now = new Date()): EventLink {
  const { link } = context;
  const expiresOn = expiresOnOf(context);
  return {
    id: link.id,
    eventId: link.eventId,
    audience: link.audience,
    personName: link.personName,
    email: link.email,
    eventClientId: link.eventClientId,
    rights: rightsOf(context),
    customExpiresOn: link.customExpiresOn,
    expiresOn,
    status: linkStatus({ revokedAt: link.revokedAt, expiresOn }, now),
    vendorCandidateId: link.vendorCandidateId,
    otpRequired: link.otpRequired,
    taskReminders: link.taskReminders,
    lastOpenedAt: link.lastOpenedAt?.toISOString() ?? null,
    renewalRequestedAt: link.renewalRequestedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
  };
}

// Un lien vaut s'il n'est ni retiré ni expiré, et si son événement n'est ni
// perdu ni un essai.
function usableLink(context: LinkWithContext, now: Date): boolean {
  return !context.link.revokedAt && !isLinkExpired(expiresOnOf(context), now) && context.event.status !== "lost" && !context.event.isDemo;
}

function toLinkAccess(context: LinkWithContext): LinkAccess {
  return {
    organizationId: context.link.organizationId,
    linkId: context.link.id,
    eventId: context.link.eventId,
    audience: context.link.audience,
    personName: context.link.personName,
    email: context.link.email,
    rights: rightsOf(context),
    expiresOn: expiresOnOf(context),
    vendorCandidateId: context.link.vendorCandidateId,
  };
}

// SEC-17, décision D2 : le jeton suit « # » ; il n'est jamais envoyé au serveur
// ni au proxy, donc jamais dans leurs journaux.
function linkUrl(token: string): string {
  return `${parseEnv(process.env).APP_PUBLIC_URL}/lien#${token}`;
}

async function sendLinkMail(input: {
  audience: LinkAudience;
  email: string;
  personName: string;
  locale: "fr" | "en";
  vocabulary: EventTypeAudience;
  url: string;
  expiresOn: string;
  renewed: boolean;
}): Promise<void> {
  if (input.audience === "vendor") {
    await sendVendorLinkMail(input);
    return;
  }
  // Service sans next-intl : variantes inline, comme l'invitation PRD-HUB-03.
  // Lot 16 (ADR 0045) : un mariage parle de « votre mariage », les autres
  // événements de « votre événement ».
  const couple = input.vocabulary === "couple";
  const until = formatCalendarDate(input.expiresOn, input.locale);
  const fr = input.renewed
    ? `Bonjour ${input.personName},\n\nVoici votre nouveau lien personnel pour suivre ${couple ? "votre mariage" : "votre événement"} sur Symbola, valable jusqu'au ${until} inclus :\n${input.url}\n\nL'ancien lien ne fonctionne plus. Ce lien vous est réservé : ne le transférez pas.\n\nÀ bientôt,\nL'équipe Symbola`
    : `Bonjour ${input.personName},\n\n${couple ? "Votre wedding planner" : "Votre organisateur"} vous a ouvert un espace pour suivre ${couple ? "votre mariage" : "votre événement"} sur Symbola, sans compte ni mot de passe. Votre lien personnel, valable jusqu'au ${until} inclus :\n${input.url}\n\nCe lien vous est réservé : ne le transférez pas. Si vous ne l'attendiez pas, ignorez ce message.\n\nÀ bientôt,\nL'équipe Symbola`;
  const en = input.renewed
    ? `Hello ${input.personName},\n\nHere is your new personal link to follow ${couple ? "your wedding" : "your event"} on Symbola, valid until ${until} included:\n${input.url}\n\nThe previous link no longer works. This link is for you only: please do not forward it.\n\nSee you soon,\nThe Symbola team`
    : `Hello ${input.personName},\n\n${couple ? "Your wedding planner" : "Your event organiser"} has opened a space for you to follow ${couple ? "your wedding" : "your event"} on Symbola, with no account or password. Your personal link, valid until ${until} included:\n${input.url}\n\nThis link is for you only: please do not forward it. If you were not expecting it, ignore this message.\n\nSee you soon,\nThe Symbola team`;
  await sendMail({
    to: input.email,
    subject: input.locale === "en" ? (couple ? "Your wedding on Symbola" : "Your event on Symbola") : couple ? "Votre mariage sur Symbola" : "Votre événement sur Symbola",
    text: input.locale === "en" ? en : fr,
  });
}

// Lot 26b (D9) : le prestataire reçoit l'accès à son espace (date, lieux,
// horaires qui le concernent) ; jamais au portail du client.
async function sendVendorLinkMail(input: { email: string; personName: string; locale: "fr" | "en"; url: string; expiresOn: string; renewed: boolean }): Promise<void> {
  const until = formatCalendarDate(input.expiresOn, input.locale);
  const fr = `Bonjour ${input.personName},\n\n${
    input.renewed ? "Voici votre nouveau lien personnel" : "L'organisateur d'un événement auquel vous participez vous a ouvert un espace sur Symbola, sans compte ni mot de passe. Votre lien personnel"
  } pour retrouver la date, les lieux et les horaires qui vous concernent, valable jusqu'au ${until} inclus :\n${input.url}\n\n${
    input.renewed ? "L'ancien lien ne fonctionne plus. " : ""
  }Ce lien vous est réservé : ne le transférez pas. Si vous ne l'attendiez pas, ignorez ce message.\n\nÀ bientôt,\nL'équipe Symbola`;
  const en = `Hello ${input.personName},\n\n${
    input.renewed ? "Here is your new personal link" : "The organiser of an event you are working on has opened a space for you on Symbola, with no account or password. Your personal link"
  } to find the date, venues and times that concern you, valid until ${until} included:\n${input.url}\n\n${
    input.renewed ? "The previous link no longer works. " : ""
  }This link is for you only: please do not forward it. If you were not expecting it, ignore this message.\n\nSee you soon,\nThe Symbola team`;
  await sendMail({
    to: input.email,
    subject: input.locale === "en" ? "Your event space on Symbola" : "Votre espace prestataire sur Symbola",
    text: input.locale === "en" ? en : fr,
  });
}

export async function createEventLink(input: CreateEventLinkInput): Promise<EventLinkDelivery> {
  if (!CREATABLE_AUDIENCES.includes(input.audience)) throw new EventLinkInvalidError("audience");
  const fields = validLinkFields(input.link);
  // Lot 24b (SEC-22, décision D5) : l'e-mail est réservé avant tout, pour ne
  // pas créer de lien qu'on ne pourrait pas annoncer.
  await reserveOrganizationMail(input.organizationId);
  const secret = newLinkSecret();
  const result = await insertLinkRow({
    ...fields,
    organizationId: input.organizationId,
    eventId: input.eventId,
    audience: input.audience,
    vendorCandidateId: input.vendorCandidateId || null,
    locale: input.locale,
    tokenHash: hashLinkSecret(secret),
  });
  if (result.status !== "saved") throw linkWriteError(result.status);
  const link = toEventLink(result.context);
  const url = linkUrl(formatLinkToken(input.organizationId, secret));
  const vocabulary = input.vocabulary ?? (await findEventAudience(input.organizationId, input.eventId)) ?? "couple";
  await sendLinkMail({ audience: link.audience, email: link.email, personName: link.personName, locale: input.locale, vocabulary, url, expiresOn: link.expiresOn, renewed: false });
  return { link, url };
}

export async function listEventLinks(organizationId: string, eventId: string): Promise<EventLink[]> {
  const now = new Date();
  return (await findEventLinkRows(organizationId, eventId)).map((context) => toEventLink(context, now));
}

export async function updateEventLink(organizationId: string, linkId: string, input: EventLinkInput): Promise<EventLink> {
  const result = await updateLinkRow(organizationId, linkId, validLinkFields(input));
  if (result.status !== "saved") throw linkWriteError(result.status);
  return toEventLink(result.context);
}

// Renouveler : nouveau jeton, l'ancien cesse aussitôt. Un lien expiré est
// prolongé du délai de son public à partir d'aujourd'hui (la planner peut
// choisir une autre date en modifiant le lien).
export async function renewEventLink(input: RenewEventLinkInput): Promise<EventLinkDelivery> {
  const current = await findLinkRow(input.organizationId, input.linkId);
  if (!current || current.link.revokedAt) throw new EventLinkNotFoundError();
  if (current.event.isDemo) throw new DemoEventRestrictionError();
  const now = new Date();
  const extendTo = isLinkExpired(expiresOnOf(current), now) ? addDays(parisToday(now), starterLinkExpiry().daysAfterEvent[current.link.audience]) : undefined;
  await reserveOrganizationMail(input.organizationId);
  const secret = newLinkSecret();
  const context = await replaceLinkTokenRow(input.organizationId, input.linkId, hashLinkSecret(secret), extendTo, input.locale);
  if (!context) throw new EventLinkNotFoundError();
  const link = toEventLink(context, now);
  const url = linkUrl(formatLinkToken(input.organizationId, secret));
  const vocabulary = input.vocabulary ?? (await findEventAudience(input.organizationId, link.eventId)) ?? "couple";
  await sendLinkMail({ audience: link.audience, email: link.email, personName: link.personName, locale: input.locale, vocabulary, url, expiresOn: link.expiresOn, renewed: true });
  return { link, url };
}

// Retirer coupe aussitôt les sessions ouvertes ; retirer deux fois ne fait rien.
export async function revokeEventLink(organizationId: string, linkId: string): Promise<void> {
  await revokeLinkRow(organizationId, linkId);
}

// SEC-17, décision D2 : la page /lien échange le jeton (reçu en POST, jamais
// dans l'adresse) contre une session. Jeton invalide, lien retiré ou expiré,
// événement perdu ou d'essai : même réponse.
// Lot 26b (POR-01, D6) : un lien qui demande un code n'ouvre de session
// qu'après le code (verifyLinkCode) ; chaque ouverture envoie un nouveau code.
export async function openEventLink(token: string, now: Date = new Date(), locale: "fr" | "en" = "fr"): Promise<OpenEventLinkResult> {
  const found = await usableLinkOfToken(token, now);
  if (!found) return { outcome: "invalid" };
  if (found.context.link.otpRequired) return await sendLinkCode(found.organizationId, found.context, now, locale);
  return await startLinkSession(found.organizationId, found.context, now);
}

async function usableLinkOfToken(token: string, now: Date): Promise<{ organizationId: string; context: LinkWithContext } | null> {
  const parsed = parseLinkToken(token);
  if (!parsed) return null;
  const context = await findLinkByTokenHash(parsed.organizationId, hashLinkSecret(parsed.secret));
  return context && usableLink(context, now) ? { organizationId: parsed.organizationId, context } : null;
}

async function startLinkSession(organizationId: string, context: LinkWithContext, now: Date): Promise<Extract<OpenEventLinkResult, { outcome: "opened" }>> {
  const sessionSecret = newLinkSecret();
  const expiresAt = linkSessionExpiresAt(expiresOnOf(context), now);
  await withActor({ kind: "link", id: context.link.id }, () =>
    insertLinkSessionRow({
      organizationId,
      linkId: context.link.id,
      eventId: context.link.eventId,
      tokenHash: hashLinkSecret(sessionSecret),
      expiresAt,
      now,
    }),
  );
  return {
    outcome: "opened",
    sessionToken: formatLinkToken(organizationId, sessionSecret),
    maxAgeSeconds: Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
    audience: context.link.audience,
  };
}

// Le code part à l'e-mail du lien ; seul son haché est gardé. Plafond par
// lien (LINK_CODES_PER_HOUR) et plafond d'envois de l'organisation (SEC-22) :
// au-delà, la page le dit sans rien envoyer.
async function sendLinkCode(organizationId: string, context: LinkWithContext, now: Date, locale: "fr" | "en"): Promise<OpenEventLinkResult> {
  const { link } = context;
  const emailHint = maskEmail(link.email);
  try {
    await reserveOrganizationMail(organizationId);
  } catch (error) {
    if (error instanceof MailQuotaExceededError) return { outcome: "code_required", emailHint, codeSent: false };
    throw error;
  }
  const code = newLinkCode();
  const issued = await withActor({ kind: "link", id: link.id }, () =>
    issueLinkCodeRow({
      organizationId,
      linkId: link.id,
      eventId: link.eventId,
      codeHash: hashLinkCode(link.id, code),
      expiresAt: linkCodeExpiresAt(now),
      now,
      maxPerHour: LINK_CODES_PER_HOUR,
    }),
  );
  if (issued === "throttled") return { outcome: "code_required", emailHint, codeSent: false };
  const minutes = Math.round(LINK_CODE_TTL_MS / 60_000);
  await sendMail({
    to: link.email,
    subject: locale === "en" ? `Your Symbola code: ${code}` : `Votre code Symbola : ${code}`,
    text:
      locale === "en"
        ? `Hello ${link.personName},\n\nYour code to open your space on Symbola: ${code}\n\nIt is valid for ${minutes} minutes and can be used only once. If you did not ask for it, ignore this message: nobody can open your space without your link.\n\nThe Symbola team`
        : `Bonjour ${link.personName},\n\nVotre code pour ouvrir votre espace sur Symbola : ${code}\n\nIl est valable ${minutes} minutes et ne sert qu'une fois. Si vous ne l'avez pas demandé, ignorez ce message : personne ne peut ouvrir votre espace sans votre lien.\n\nL'équipe Symbola`,
  });
  return { outcome: "code_required", emailHint, codeSent: true };
}

// Lot 26b (POR-01, D6) : le code saisi ouvre la session. Lien invalide : même
// réponse que /lien. Mauvais code : il reste des essais, ou il faut un
// nouveau code (« code_expired »), comme pour un code expiré ou déjà utilisé.
export async function verifyLinkCode(token: string, code: string, now: Date = new Date()): Promise<VerifyLinkCodeResult> {
  const found = await usableLinkOfToken(token, now);
  if (!found || !found.context.link.otpRequired) return { outcome: "invalid" };
  const { link } = found.context;
  const typed = normalizeLinkCode(code);
  const attempt = await withActor({ kind: "link", id: link.id }, () =>
    attemptLinkCodeRow({
      organizationId: found.organizationId,
      linkId: link.id,
      eventId: link.eventId,
      // Un code mal formé compte comme un essai (son haché ne correspond à rien).
      codeHash: hashLinkCode(link.id, typed ?? ""),
      now,
    }),
  );
  if (attempt.status === "expired") return { outcome: "code_expired" };
  if (attempt.status === "wrong") return attempt.attemptsLeft > 0 ? { outcome: "wrong_code", attemptsLeft: attempt.attemptsLeft } : { outcome: "code_expired" };
  return await startLinkSession(found.organizationId, found.context, now);
}

// Décision D7 : à chaque requête, la session et son lien sont relus ; une
// session expirée, ou d'un lien qui ne vaut plus, est supprimée.
export async function resolveLinkSession(sessionToken: string, now: Date = new Date()): Promise<LinkAccess | null> {
  const parsed = parseLinkToken(sessionToken);
  if (!parsed) return null;
  const tokenHash = hashLinkSecret(parsed.secret);
  const found = await findLinkSessionRow(parsed.organizationId, tokenHash);
  if (!found) return null;
  if (found.session.expiresAt.getTime() <= now.getTime() || !usableLink(found.context, now)) {
    await deleteLinkSessionRow(parsed.organizationId, tokenHash);
    return null;
  }
  if (now.getTime() - found.session.lastSeenAt.getTime() > LINK_SESSION_TOUCH_MS) {
    await touchLinkSessionRow(parsed.organizationId, found.session.id, now, linkSessionExpiresAt(expiresOnOf(found.context), now));
  }
  return toLinkAccess(found.context);
}

export async function closeLinkSession(sessionToken: string): Promise<void> {
  const parsed = parseLinkToken(sessionToken);
  if (!parsed) return;
  await deleteLinkSessionRow(parsed.organizationId, hashLinkSecret(parsed.secret));
}

// SEC-15, décision D5 : « Demander un nouveau lien » depuis un lien expiré. La
// demande est notée sur le lien et la planner prévenue ; rien n'est envoyé au
// demandeur, et la réponse est la même pour un jeton inconnu ou retiré.
export async function requestLinkRenewal(token: string, now: Date = new Date()): Promise<void> {
  const parsed = parseLinkToken(token);
  if (!parsed) return;
  const context = await findLinkByTokenHash(parsed.organizationId, hashLinkSecret(parsed.secret));
  if (!context || context.link.revokedAt || context.event.isDemo || context.event.status === "lost") return;
  if (!isLinkExpired(expiresOnOf(context), now)) return;
  const fresh = await withActor({ kind: "link", id: context.link.id }, () => markLinkRenewalRequestedRow(parsed.organizationId, context.link.id, now));
  if (fresh) await notifyRenewalRequest(parsed.organizationId, context);
}

// L'e-mail va à la personne de l'équipe qui a créé le lien, sinon aux
// titulaires. Une seule fois par lien tant qu'il n'est pas renouvelé.
async function notifyRenewalRequest(organizationId: string, context: LinkWithContext): Promise<void> {
  const team = (await listTeam(appDatabase(), organizationId)).filter((member) => !member.disabledAt);
  const creator = team.find((member) => member.id === context.link.createdBy);
  const recipients = creator ? [creator] : team.filter((member) => member.role === "owner");
  const url = `${parseEnv(process.env).APP_PUBLIC_URL}/events/${context.link.eventId}?onglet=maries`;
  for (const member of recipients) {
    await sendMail({
      to: member.email,
      subject: "Demande d'un nouveau lien / New link requested",
      text: `Bonjour,\n\n${context.link.personName} demande un nouveau lien personnel : le sien a expiré. Vous pouvez le renouveler depuis la fiche de l'événement :\n${url}\n\n—\n\nHello,\n\n${context.link.personName} is asking for a new personal link: theirs has expired. You can renew it from the event page:\n${url}\n\nL'équipe Symbola / The Symbola team`,
    });
  }
}

// Accès d'un lien, relu en base : null s'il ne vaut plus.
export async function getLinkAccess(organizationId: string, linkId: string, now: Date = new Date()): Promise<LinkAccess | null> {
  const context = await findLinkRow(organizationId, linkId);
  return context && usableLink(context, now) ? toLinkAccess(context) : null;
}

// POR-10 : une rubrique fermée est refusée par le service, pas seulement
// masquée par l'écran. Le portail est celui du client : le lien d'un
// prestataire n'y a jamais accès (lot 26b, SC-S3).
async function requireLinkRubric(organizationId: string, linkId: string, rubric?: LinkRubric): Promise<LinkAccess> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || access.audience !== "client" || (rubric && !access.rights.rubrics.includes(rubric))) throw new LinkAccessDeniedError();
  return access;
}

// Lot 26b (D9) — espace minimal du prestataire : prénoms des clients, date,
// lieux, lignes du programme où figure son poste. Ni note interne, ni autre
// intervenant, ni prix, ni budget.
export async function getVendorLinkView(organizationId: string, linkId: string): Promise<VendorLinkView> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || access.audience !== "vendor" || !access.vendorCandidateId) throw new LinkAccessDeniedError();
  const [vendor, found] = await Promise.all([findLinkVendorRow(organizationId, access.vendorCandidateId), findEventById(organizationId, access.eventId)]);
  if (!vendor || vendor.eventId !== access.eventId || !found) throw new LinkAccessDeniedError();
  const [places, program] = await Promise.all([listEventPlaces(organizationId, access.eventId), getEventProgram(organizationId, access.eventId)]);
  return {
    vendorName: vendor.vendorName,
    slotLabel: vendor.slotLabel,
    clientFirstNames: found.clients.map((client) => client.firstName),
    eventDate: found.event.eventDate,
    places: places.map((place) => ({ id: place.id, label: place.label, address: place.address })),
    programItems: program.items
      .filter((item) => item.participants.some((participant) => participant.vendorSlotId === vendor.vendorSlotId))
      .map((item) => ({ id: item.id, startTime: item.startTime, endTime: item.endTime, label: item.label, location: item.location })),
  };
}

// Vue du tiers : résumé de l'événement, rétroplanning et programme (variante
// « mariés », jamais de note interne) si leurs rubriques sont ouvertes.
export async function getLinkEventView(organizationId: string, linkId: string): Promise<ClientEventView> {
  const access = await requireLinkRubric(organizationId, linkId);
  const found = await findEventById(organizationId, access.eventId);
  if (!found) throw new LinkAccessDeniedError();
  const rubrics = access.rights.rubrics;
  const [tasks, program] = await Promise.all([
    rubrics.includes("tasks") ? listEventTasks(organizationId, access.eventId) : Promise.resolve(null),
    rubrics.includes("program") ? getEventProgram(organizationId, access.eventId) : Promise.resolve(null),
  ]);
  return {
    // Résumé seulement : ni source du prospect ni motif de perte.
    event: toEventSummary(found.event, found.clients),
    tasks,
    program: program ? { items: programForVariant(program.items, "couple"), overlaps: [], updatedAt: program.updatedAt } : null,
  };
}

export async function setLinkTaskDone(organizationId: string, linkId: string, taskId: string, done: boolean): Promise<EventTask> {
  const access = await requireLinkRubric(organizationId, linkId, "tasks");
  const result = await withActor({ kind: "link", id: linkId }, () =>
    toggleLinkTaskRow({ organizationId, linkId, eventId: access.eventId, taskId, done }),
  );
  if (result.status === "denied") throw new LinkAccessDeniedError();
  return toEventTask(result.task);
}

export async function getLinkNamesByIds(organizationId: string, linkIds: string[]): Promise<Record<string, string>> {
  return findLinkNameRows(organizationId, linkIds);
}

// Lot 27a (CHR-04, décision D7) — rappels des tâches confiées au client, pour
// une organisation : appelé par la tâche horaire de l'app. Un e-mail par
// personne et par jour, regroupant les tâches qui atteignent un seuil (sept
// jours avant, la veille, le lendemain d'un retard), jamais deux fois le même
// rappel ; liens valables seulement ; plafond d'envois de l'organisation.
export async function sendClientTaskReminders(organizationId: string, now: Date = new Date()): Promise<number> {
  const policy = starterClientTaskReminders();
  if (!isSendingHour(now, policy)) return 0;
  const today = parisToday(now);
  const candidates = await findReminderCandidateRows(
    organizationId,
    addDays(today, -policy.overdue.within),
    addDays(today, policy.daysBefore.week),
    parisStartOfDay(today),
  );
  let sent = 0;
  for (const candidate of candidates) {
    if (candidate.sentToday || !usableLink(candidate.context, now)) continue;
    const due: (ReminderTask & { taskId: string })[] = candidate.tasks.flatMap((task) => {
      const threshold = reminderThreshold(task.dueDate, today, policy);
      return threshold && !candidate.sent.has(`${task.id}:${threshold}`) ? [{ taskId: task.id, label: task.label, dueDate: task.dueDate, threshold }] : [];
    });
    if (due.length === 0) continue;
    try {
      await reserveOrganizationMail(organizationId, { now });
    } catch (error) {
      if (error instanceof MailQuotaExceededError) break;
      throw error;
    }
    const { link } = candidate.context;
    const recorded = await withActor(SYSTEM_ACTOR, () =>
      insertTaskRemindersRow({ organizationId, eventId: link.eventId, linkId: link.id, reminders: due.map(({ taskId, threshold }) => ({ taskId, threshold })), now }),
    );
    if (recorded === 0) continue;
    const couple = ((await findEventAudience(organizationId, link.eventId)) ?? "couple") === "couple";
    const mail = reminderMail({ personName: link.personName, locale: link.locale === "en" ? "en" : "fr", couple, tasks: due, today });
    await sendMail({ to: link.email, subject: mail.subject, text: mail.text });
    sent += 1;
  }
  return sent;
}

// Lot 27b (POR-03, BUD-07, EVT-09 ; décisions D9 et D10) — décisions demandées
// au client. La planner les demande (contenu figé), le client y répond depuis
// son portail (première réponse), la décision répondue ne se modifie plus : une
// nouvelle la remplace. Une décision n'engage rien d'elle-même (D9).

export class DecisionInvalidError extends Error {
  constructor(readonly reason: "options" | "expense" | "program" | "date" | "note" | "replace" | "pending" | "choice" | "comment" | "answered") {
    super(`décision invalide : ${reason}`);
    this.name = "DecisionInvalidError";
  }
}

export class DecisionNotFoundError extends Error {
  constructor() {
    super("décision introuvable");
    this.name = "DecisionNotFoundError";
  }
}

function toDecision(row: EventDecisionRow, replacedBy: Map<string, string>, currentProgramUpdatedAt: string | null): EventDecision {
  const snapshot = row.snapshot as DecisionSnapshot;
  return {
    id: row.id,
    eventId: row.eventId,
    kind: row.kind as DecisionKind,
    subjectId: row.subjectId,
    slotId: row.slotId,
    title: row.title,
    note: row.note,
    snapshot,
    dueOn: row.dueOn,
    status: row.status as DecisionStatus,
    choiceId: row.choiceId,
    comment: row.comment,
    decidedByName: row.decidedByName,
    decidedByLinkId: row.decidedByLinkId,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    replacesDecisionId: row.replacesDecisionId,
    replacedById: replacedBy.get(row.id) ?? null,
    requestedAt: row.requestedAt.toISOString(),
    programChanged: row.status === "approved" && programChangedSince(snapshot, currentProgramUpdatedAt),
  };
}

async function decisionsWithContext(organizationId: string, eventId: string, rows: EventDecisionRow[], all: EventDecisionRow[]): Promise<EventDecision[]> {
  const programUpdatedAt = rows.some((row) => row.kind === "program") ? (await getEventProgram(organizationId, eventId)).updatedAt : null;
  const replacedBy = replacementsOf(all);
  return rows.map((row) => toDecision(row, replacedBy, programUpdatedAt));
}

export async function requestDecision(input: RequestDecisionInput): Promise<EventDecision> {
  const { organizationId, eventId } = input;
  const found = await findEventById(organizationId, eventId);
  if (!found) throw new EventNotFoundError();
  if (found.event.isDemo) throw new DemoEventRestrictionError();
  const note = input.note?.trim() || null;
  if (note && note.length > DECISION_NOTE_MAX) throw new DecisionInvalidError("note");
  const dueOn = input.dueOn?.trim() || null;
  if (dueOn && (!LINK_DATE_PATTERN.test(dueOn) || Number.isNaN(Date.parse(`${dueOn}T00:00:00Z`)))) throw new DecisionInvalidError("date");

  let subject: { subjectId: string | null; slotId: string | null; title: string; snapshot: DecisionSnapshot };
  if (input.kind === "option") {
    const slot = (await listEventVendorSlots(organizationId, eventId)).find((candidate) => candidate.id === input.slotId);
    const options: DecisionOption[] = (await listVendorCandidates(organizationId, eventId))
      .filter((candidate) => candidate.vendorSlotId === input.slotId && candidate.shownToClients)
      .map((candidate) => ({ candidateId: candidate.id, vendorName: candidate.vendorName, quoteAmountCents: candidate.quoteAmountCents }));
    if (!slot || options.length < 2) throw new DecisionInvalidError("options");
    subject = { subjectId: slot.id, slotId: slot.id, title: slot.label, snapshot: { kind: "option", slotLabel: slot.label, options } };
  } else if (input.kind === "expense") {
    const slot = (await listEventVendorSlots(organizationId, eventId)).find((candidate) => candidate.id === input.slotId);
    const label = input.label.trim();
    if (!slot || !label || !Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new DecisionInvalidError("expense");
    subject = { subjectId: input.lineId, slotId: slot.id, title: label, snapshot: { kind: "expense", slotLabel: slot.label, label, vendorName: input.vendorName, amountCents: input.amountCents } };
  } else {
    const program = await getEventProgram(organizationId, eventId);
    if (program.items.length === 0) throw new DecisionInvalidError("program");
    // Titre vide : l'écran affiche « le programme du jour J » dans la langue de la personne.
    subject = { subjectId: null, slotId: null, title: "", snapshot: { kind: "program", programUpdatedAt: program.updatedAt, itemCount: program.items.length } };
  }

  const existing = await findDecisionRows(organizationId, eventId);
  if (existing.some((row) => row.status === "pending" && row.kind === input.kind && row.subjectId === subject.subjectId)) throw new DecisionInvalidError("pending");
  const replacesDecisionId = input.replacesDecisionId || null;
  if (replacesDecisionId) {
    const replaced = existing.find((row) => row.id === replacesDecisionId);
    const answered = replaced && (replaced.status === "approved" || replaced.status === "declined");
    if (!replaced || !answered || replaced.kind !== input.kind || replaced.subjectId !== subject.subjectId || replacementsOf(existing).has(replaced.id)) throw new DecisionInvalidError("replace");
  }
  const row = await insertDecisionRow({ organizationId, eventId, kind: input.kind, ...subject, note, dueOn, replacesDecisionId });
  return toDecision(row, new Map(), input.kind === "program" && subject.snapshot.kind === "program" ? subject.snapshot.programUpdatedAt : null);
}

// Une demande sans réponse peut être retirée ; une décision répondue, non.
export async function withdrawDecision(organizationId: string, decisionId: string): Promise<void> {
  if (await withdrawDecisionRow(organizationId, decisionId)) return;
  if (!(await findDecisionRow(organizationId, decisionId))) throw new DecisionNotFoundError();
  throw new DecisionInvalidError("answered");
}

// --- Lot 32a (HUB-08, UX-06, EVT-02 ; D4, D6) : urgences de toute l'organisation ---

export async function listPendingDecisions(organizationId: string): Promise<PendingDecision[]> {
  return (await findPendingDecisions(organizationId)).map((row) => ({
    id: row.id,
    eventId: row.eventId,
    kind: row.kind as DecisionKind,
    title: row.title,
    dueOn: row.dueOn,
    requestedAt: row.requestedAt.toISOString(),
  }));
}

export async function listUncontractedVendors(organizationId: string, today: string): Promise<UncontractedVendor[]> {
  assertDate(today);
  return (await findUncontractedVendors(organizationId, today)).map(({ candidate, slotLabel }) => ({
    candidateId: candidate.id,
    eventId: candidate.eventId,
    vendorId: candidate.vendorId,
    vendorName: candidate.vendorName,
    slotLabel,
    since: parisToday(candidate.updatedAt),
  }));
}

// D6 : la relance d'un prestataire s'inscrit dans l'activité de l'évènement ; le message part de la
// messagerie de la planner (l'appelant), Symbola n'envoie rien.
export async function recordVendorReminder(input: { organizationId: string; eventId: string; candidateId: string; userId: string }): Promise<{ vendorName: string; vendorId: string | null; slotLabel: string }> {
  const recorded = await insertVendorReminder(input);
  if (!recorded) throw new CandidateNotFoundError();
  return recorded;
}

export async function listEventDecisions(organizationId: string, eventId: string): Promise<EventDecision[]> {
  const rows = await findDecisionRows(organizationId, eventId);
  return decisionsWithContext(organizationId, eventId, rows, rows);
}

async function clientLinkAccess(organizationId: string, linkId: string): Promise<LinkAccess> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || access.audience !== "client") throw new LinkAccessDeniedError();
  return access;
}

// Ce que voit un lien : les décisions de ses rubriques (D10), sauf retirées.
export async function listLinkDecisions(organizationId: string, linkId: string): Promise<EventDecision[]> {
  const access = await clientLinkAccess(organizationId, linkId);
  const all = await findDecisionRows(organizationId, access.eventId);
  const visible = all.filter((row) => row.status !== "withdrawn" && decisionOpenTo({ kind: row.kind as DecisionKind, slotId: row.slotId }, access));
  return decisionsWithContext(organizationId, access.eventId, visible, all);
}

export async function answerLinkDecision(input: AnswerDecisionInput): Promise<EventDecision> {
  const access = await clientLinkAccess(input.organizationId, input.linkId);
  const row = await findDecisionRow(input.organizationId, input.decisionId);
  if (!row || row.eventId !== access.eventId || row.status === "withdrawn" || !decisionOpenTo({ kind: row.kind as DecisionKind, slotId: row.slotId }, access)) throw new LinkAccessDeniedError();
  if (row.status !== "pending") throw new DecisionInvalidError("answered");
  const comment = input.comment?.trim() || null;
  const choiceId = input.choiceId || null;
  const problem = answerProblem(row.snapshot as DecisionSnapshot, { answer: input.answer, choiceId, comment });
  if (problem) throw new DecisionInvalidError(problem);
  const answered = await withActor({ kind: "link", id: access.linkId }, () =>
    answerDecisionRow({ organizationId: input.organizationId, decisionId: row.id, status: input.answer, choiceId, comment, linkId: access.linkId, personName: access.personName, now: new Date() }),
  );
  if (!answered) throw new DecisionInvalidError("answered");
  const [decision] = await decisionsWithContext(input.organizationId, access.eventId, [answered], await findDecisionRows(input.organizationId, access.eventId));
  return decision!;
}

// Décision D3 : profils de départ d'un lien (ils pré-cochent les rubriques).
export function listLinkProfiles(locale: "fr" | "en", vocabulary: EventTypeAudience): StarterLinkProfile[] {
  return starterLinkProfiles(locale, vocabulary === "clients" ? "clients" : "couple");
}

// Décision D5 : demandes de nouveau lien en attente, pour « Aujourd'hui ».
export async function listPendingLinkRenewals(organizationId: string): Promise<{ linkId: string; eventId: string; personName: string; requestedAt: string }[]> {
  return (await findPendingRenewalRows(organizationId)).map((row) => ({ ...row, requestedAt: row.requestedAt.toISOString() }));
}

// Lot 13 (L13-EVT-19) — date (calendrier de Paris) du dernier passage dans
// chaque statut : la frise de la fiche affiche la date de chaque étape.
export async function getEventStatusDates(organizationId: string, eventId: string): Promise<EventStatusDates> {
  const dates: EventStatusDates = {};
  for (const change of await findEventStatusChanges(organizationId, eventId)) dates[change.toStatus] = parisToday(change.changedAt);
  return dates;
}

export async function listEventActivity(organizationId: string, eventId: string): Promise<EventActivity[]> {
  return (await findEventActivity(organizationId, eventId)).map(({ activity, actorName, vendorName }) => ({
    id: activity.id,
    kind: activity.kind,
    // Lot 32a (D6, RGP-05) : une relance porte le nom actuel du prestataire, vide s'il est retiré.
    taskLabel: activity.kind === "vendor_reminded" ? (vendorName ?? "") : activity.taskLabel,
    actorName,
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
    // Lot 29b : les documents de l'essai partent avec lui.
    keys.push(...(await documentKeys(organizationId, eventIds, { demoOnly: true })));
  }
  return keys;
}

export async function endEventsTrial(organizationId: string, eventId: string): Promise<void> {
  const keys = [...(await candidateQuoteKeys(organizationId, [eventId], { demoOnly: true })), ...(await documentKeys(organizationId, [eventId], { demoOnly: true }))];
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
  listEventTypes,
  addStarterEventTypes,
  createEventType,
  updateEventType,
  removeEventType,
  countEventsByType,
  setEventType,
  getEventAudience,
  listEventAudiences,
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
  getVendorCandidate,
  listVendorConsultations,
  listSelectedVendorIds,
  getLinkVendorOptions,
  getLinkVendorQuoteFile,
  getLinkSharedRibVendorId,
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
  reorderDefaultVendorSlots,
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
  updateTaskTemplateItem,
  renameTaskTemplate,
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
  shiftProgramItems,
  listProgramTemplates,
  createProgramTemplate,
  addProgramTemplateItem,
  updateProgramTemplateItem,
  renameProgramTemplate,
  removeProgramTemplateItem,
  removeProgramTemplate,
  applyProgramTemplate,
  createEventLink,
  listEventLinks,
  updateEventLink,
  renewEventLink,
  revokeEventLink,
  openEventLink,
  verifyLinkCode,
  getVendorLinkView,
  sendClientTaskReminders,
  requestDecision,
  withdrawDecision,
  listEventDecisions,
  listEventDocuments,
  attachEventDocument,
  renameEventDocument,
  removeEventDocument,
  getEventDocumentFile,
  listDayDocumentChoices,
  setDayDocumentEmbedded,
  listEventDayContacts,
  addEventDayContact,
  removeEventDayContact,
  listLinkDecisions,
  answerLinkDecision,
  resolveLinkSession,
  closeLinkSession,
  requestLinkRenewal,
  getLinkAccess,
  getLinkEventView,
  setLinkTaskDone,
  getLinkNamesByIds,
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
  listExpiredDemoEvents,
};
void _contractCheck;

// Lot 6 (RGPD-05) — données nécessaires aux règles de conservation.
export { listRetentionEvents, type RetentionEvent } from "./privacy-retention";
