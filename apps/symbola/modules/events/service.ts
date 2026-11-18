// Porte d'entrée publique du module events — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/events si ce module est extrait en app autonome.
import { z } from "zod";
import { formatCalendarDate, isTimeZone, parisDaysSince, parisToday } from "@symbola/i18n";
import { canSetStatus, eventPhase } from "./lifecycle";
// Lot 34a (EVT-05) : les règles du cycle de vie, pour les écrans et lib/.
import { getPipeline as getPipelineOf } from "./pipeline";
import { countRequestsToReview, findNewRequestRows } from "./prospects-repository";
import type { Pipeline } from "@symbola/contracts";
export { canPostpone, canSetStatus, closingDue, eventPhase, FINISHED_STATUSES, FIRM_STATUSES, IN_PROGRESS_STATUSES, isInProgress, MANUAL_STATUSES, TENTATIVE_STATUSES, TIMELINE_PHASES } from "./lifecycle";
import type { EventStatus as LifecycleStatus } from "@symbola/contracts";
import { listTeam } from "@symbola/auth";
import { includingDeleted, SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { MailQuotaExceededError, reserveOrganizationMail } from "@symbola/mail";
import { starterClientTaskReminders, starterDemoEvent, starterExampleEvent, starterLinkExpiry, starterLinkProfiles, starterProgram, starterRetroplanning, starterTutorialEvent, starterVendorSlots, type StarterLinkProfile } from "@symbola/starter-templates";
import {
  postponeEventRow,
  confirmPostponementRow,
  previewTaskRecalculationRows,
  releaseEventTaskRow,
  updateEventTimeZoneRow,
  setTaskTemplateEventTypeRow,
  findDefaultTaskTemplateId,
  countRealClientLinks,
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
  type EventRecord,
  type EventRow,
  type EventTaskRow,
  type EventVendorSlotRow,
  type TaskTemplateItemRow,
  type TaskTemplateRow,
  findEventClientLink,
  findClientLinks,
  findEventIdsOfContact,
  findLinkedContactIds,
  updateEventIdentityRow,
  updateWantedBudgetRow,
  updateVenueRow,
  restoreEventTaskRow,
  restoreProgramItemRow,
  findEventIdentityState,
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
  findVendorTaskRows,
  toggleVendorTaskRow,
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
import { isSendingHour, reminderTaskLines, reminderThreshold, type ReminderTask } from "./task-reminders";
import { recordAudit } from "@symbola/db/audit";
import { resolveClientContacts } from "./clients";
import { assertOrganizationEmailReady, assertRecipientsConfirmed, ContactEmailTakenError, ContactInvalidError, ContactNotFoundError, EmailVariableMissingError, getUserContact, sendOrganizationEmail, sendSymbolaEmail, updateContact } from "@/modules/hub/service";
import { createTranslator } from "next-intl";
import type { EmailTemplateKind, EmailValues, TrashedObject } from "@symbola/contracts";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { answerDecisionRow, findDecisionRow, findDecisionRows, insertDecisionRow, replacementsOf, withdrawDecisionRow, type EventDecisionRow } from "./decisions-repository";
import { findPendingDecisions, findUncontractedVendors, insertVendorReminder } from "./today-sources";
import { VendorCandidateNotFoundError as CandidateNotFoundError } from "./vendor-candidates";
import { answerProblem, DECISION_NOTE_MAX, decisionOpenTo, programChangedSince } from "./decisions";
import { hashLinkCode, LINK_CODE_TTL_MS, LINK_CODES_PER_HOUR, linkCodeExpiresAt, maskEmail, newLinkCode, normalizeLinkCode } from "./link-otp";
import { addPlace, listPlaces, makeReceptionPlace, removePlace, restorePlace, updatePlace } from "./places";
import { attachFile, getAttachmentFile, listAttachments, listEventAttachments, removeAttachment } from "./task-attachments";
import { addComment, listComments, removeComment, restoreComment } from "./task-comments";
import { listTrashedEventRows, restoreDocumentRow, restoreEventRow, restoreProgramTemplateRow, restoreTaskTemplateRow, trashEventRow } from "./trash";
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
import {
  addDocumentVersion,
  attachDocument,
  createDocumentFolder,
  createDocumentLink,
  documentKeys,
  getDocumentFile,
  getDocumentVersionFile,
  getSharedDocumentFile,
  listDayChoices,
  listDocumentFolders,
  listDocumentLinks,
  listDocuments,
  listEventDocumentLinkRows,
  listEventDocumentVersionRows,
  listDocumentVersions,
  listSharedDocuments,
  moveDocument,
  openDocumentLink,
  peekDocumentLink,
  removeDocument,
  removeDocumentFolder,
  renameDocument,
  renameDocumentFolder,
  revokeDocumentLink,
  setDayChoice,
  setDocumentSharing,
} from "./documents";
import { findProgramOverlaps, hasProgramChanges, MAX_SHIFT_MINUTES, normalizeTime, programChanges, publishedProgramItems, sortProgramItems, vendorProgramOf } from "./program";
import {
  claimProgramNotification,
  findLatestProgramVersion,
  findLinkProgramSeen,
  findProgramVersion,
  findProgramVersions,
  insertProgramVersion,
  markProgramSeen,
  ProgramPublishError,
  recordProgramNotification,
  releaseProgramNotification,
} from "./program-versions";
import { endTimeAfter, MINUTES_PER_DAY } from "@/lib/program-spans";
import type {
  PendingDecision,
  UncontractedVendor,
  EventPlace,
  EventPlaceInput,
  EventIdentityInput,
  EventTaskAttachment,
  AttachTaskFileInput,
  EventTaskComment,
  AttachEventDocumentInput,
  AddEventDocumentVersionInput,
  CreateEventDocumentLinkInput,
  DayDocumentChoice,
  EventDocument,
  EventDocumentFolder,
  EventDocumentShareLink,
  EventDocumentVersion,
  OpenedEventDocumentLink,
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
  ProgramPublication,
  ProgramVersion,
  ProgramVersionSummary,
  PublishEventProgramInput,
  ProgramRecipient,
  ProgramRecipientDocument,
  NotifyProgramVersionInput,
  ProgramNotification,
  CalendarEvent,
  PublishedProgramView,
  VendorProgramView,
  ProgramTemplate,
  ProgramTemplateItem,
  ProgramTemplateItemInput,
  LossReason,
  ProspectSource,
  TaskRecalculation,
  TaskResponsible,
  TemplateTaskResponsible,
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
// Lot 37b (CHR-07, DAT-14 ; D8) : diffusion du programme refusée (vide, ou déjà diffusé tel quel).
export { ProgramPublishError } from "./program-versions";
// Lot 37b (DOC-12, ADR 0071) : la part du module au relevé de stockage, et ses évènements d'essai.
// Les évènements d'essai, écartés du relevé, viennent de listDemoEventIds (export complet).
export { measureEventsStorage } from "./storage-usage";
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
  EventPhase,
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
  AddEventDocumentVersionInput,
  CreateEventDocumentLinkInput,
  DayDocumentChoice,
  EventDocument,
  EventDocumentFolder,
  EventDocumentShareLink,
  EventDocumentVersion,
  OpenedEventDocumentLink,
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
  TemplateTaskResponsible,
  TaskTemplate,
  TaskTemplateItem,
  TaskTemplateItemInput,
  UpdateEventTaskInput,
  EventProgram,
  ProgramItem,
  ProgramPublication,
  ProgramVersion,
  ProgramVersionSummary,
  PublishEventProgramInput,
  ProgramRecipient,
  ProgramRecipientDocument,
  NotifyProgramVersionInput,
  ProgramNotification,
  CalendarEvent,
  PublishedProgramItem,
  PublishedProgramView,
  VendorProgramView,
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
    contactId: row.contactId,
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

function toEventSummary(event: EventRecord, clients: EventClientRow[]): EventSummary {
  return {
    id: event.id,
    status: event.status,
    phase: eventPhase(event),
    eventDate: event.eventDate,
    timeZone: event.timeZone,
    venueName: event.venueName,
    venueCity: event.venueCity,
    clients: clients.map(toEventClient),
    isDemo: event.isDemo,
  };
}

function toEventDetail(event: EventRecord, clients: EventClientRow[]): EventDetail {
  return {
    ...toEventSummary(event, clients),
    prospectSourceId: event.prospectSourceId,
    eventTypeId: event.eventTypeId,
    lossReasonId: event.lossReasonId,
    lossReasonNote: event.lossReasonNote,
    tasksScheduledFor: event.tasksScheduledFor,
    postponedFromDate: event.postponedFromDate,
    postponedFromStatus: event.postponedFromStatus,
    wantedBudgetCents: event.wantedBudgetCents,
    guestsEstimated: event.guestsEstimated,
    guestsConfirmed: event.guestsConfirmed,
    style: event.style,
    notes: event.notes,
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

// Lot 38b (HUB-29 ; D11) — les évènements du flux de calendrier de l'équipe : datés, ni essai, ni
// perdus ou annulés.
export async function listCalendarEvents(organizationId: string): Promise<CalendarEvent[]> {
  const rows = await findEvents(organizationId, {});
  return rows
    .filter(({ event }) => event.eventDate !== null && !event.isDemo && event.status !== "cancelled")
    .map(({ event, clients }) => ({ ...toEventSummary(event, clients), eventTypeId: event.eventTypeId }));
}

// Lot 13 (L13-HUB-15) — prospects sans nouvelle depuis au moins `days` jours
// (aucune modification de la fiche, calendrier de Paris), hors essais,
// pour le bloc « À traiter » de l'accueil.
export async function listStaleProspects(organizationId: string, days: number, now: Date = new Date()): Promise<StaleProspect[]> {
  // Lot 34a (D2) : les options ; l'appelant écarte celles qui ont un devis envoyé (relancées par
  // le devis).
  const rows = await findEvents(organizationId, { statusIn: ["option"] });
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
  // Lot 36a (UX-02, DAT-12) : chaque client est un contact du hub, choisi, repris par son adresse
  // e-mail, ou créé.
  const clientContactIds = await resolveClientContacts(input.organizationId, input.clients);
  const event = await insertProspect({
    organizationId: input.organizationId,
    createdByUserId: input.createdByUserId,
    clientContactIds,
    prospectSourceId: input.prospectSourceId,
    eventTypeId: input.eventTypeId ?? null,
    eventDate: input.eventDate,
    venueName: input.venueName,
    venueCity: input.venueCity,
  });
  // Lot 34a (EVT-01, D8) : le rétroplanning du type naît avec l'événement, Option comprise.
  if (input.applyTemplate !== false && event.eventDate) await applyDefaultTemplate(input.organizationId, event.id, event.eventTypeId);
  return { id: event.id };
}

async function applyDefaultTemplate(organizationId: string, eventId: string, eventTypeId: string | null): Promise<void> {
  const templateId = await findDefaultTaskTemplateId(organizationId, eventTypeId);
  if (templateId) await applyTaskTemplateRows(organizationId, eventId, templateId);
}

// Lot 34a (EVT-05, D2 à D6) — statuts. La frise pose Option, Confirmé, En préparation, Clôturé ;
// l'annulation passe par cancelEvent (motif), le report par postponeEvent ; un report en cours se
// confirme (confirmPostponement), une annulation se réactive en Option.
export class EventStatusTransitionError extends Error {
  constructor() {
    super("changement de statut impossible depuis le statut actuel");
    this.name = "EventStatusTransitionError";
  }
}

async function currentStatus(organizationId: string, eventId: string): Promise<LifecycleStatus> {
  const found = await findEventById(organizationId, eventId);
  if (!found) throw new EventNotFoundError();
  return found.event.status;
}

export async function changeEventStatus(input: ChangeEventStatusInput): Promise<void> {
  const from = await currentStatus(input.organizationId, input.eventId);
  if (input.toStatus === "cancelled") {
    if (from === "cancelled") throw new EventStatusTransitionError();
  } else if (!canSetStatus(from, input.toStatus)) {
    throw new EventStatusTransitionError();
  }
  await updateEventStatus(input);
}

export async function cancelEvent(input: { organizationId: string; eventId: string; changedByUserId: string; lossReasonId: string | null; lossReasonNote: string | null }): Promise<void> {
  await changeEventStatus({ ...input, toStatus: "cancelled" });
}

export async function reactivateEvent(input: { organizationId: string; eventId: string; changedByUserId: string }): Promise<void> {
  await changeEventStatus({ ...input, toStatus: "option" });
}

export async function postponeEvent(input: { organizationId: string; eventId: string; changedByUserId: string; newDate: string | null }): Promise<void> {
  if (input.newDate !== null) assertDate(input.newDate);
  const result = await postponeEventRow(input);
  if (result.status === "not_found") throw new EventNotFoundError();
  if (result.status === "not_postponable") throw new EventStatusTransitionError();
}

// Confirmer le report : les échéances relatives suivent la nouvelle date, puis l'événement
// retrouve son statut d'avant. Renvoie la date d'avant (pour le devis signé, D7).
export async function confirmPostponement(input: { organizationId: string; eventId: string; changedByUserId: string }): Promise<{ previousDate: string | null; eventDate: string }> {
  const result = await confirmPostponementRow(input);
  if (result.status !== "confirmed") {
    if (result.status === "not_found") throw new EventNotFoundError();
    if (result.status === "not_postponed") throw new EventStatusTransitionError();
    throw new EventDateRequiredError();
  }
  return { previousDate: result.previousDate, eventDate: result.event.eventDate! };
}

// CHR-01, EVT-05 : ce que ferait le recalcul, et les tâches qui tomberaient dans le passé.
export type TaskRecalculationPreview = { moves: { taskId: string; label: string; fromDate: string; toDate: string }[]; inThePast: { taskId: string; label: string; toDate: string }[] };

export async function previewTaskRecalculation(organizationId: string, eventId: string, today: string): Promise<TaskRecalculationPreview> {
  assertDate(today);
  const moves = await previewTaskRecalculationRows(organizationId, eventId);
  if (moves === null) throw new EventNotFoundError();
  return { moves, inThePast: moves.filter((move) => move.toDate < today).map(({ taskId, label, toDate }) => ({ taskId, label, toDate })) };
}

// ARC-17, D9 : fuseau IANA de l'événement.
export async function setEventTimeZone(organizationId: string, eventId: string, timeZone: string): Promise<void> {
  if (!isTimeZone(timeZone)) throw new RangeError("fuseau inconnu");
  if (!(await updateEventTimeZoneRow(organizationId, eventId, timeZone))) throw new EventNotFoundError();
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

// Lot 36a (CRM-03, ADR 0069) : les coordonnées d'un client sont celles de son contact ; les modifier
// depuis l'évènement modifie la fiche du contact, partout. Une adresse prise par un autre contact
// est refusée (DAT-12).
export class ClientEmailTakenError extends Error {}

export async function updateEventClientContact(input: {
  organizationId: string;
  eventId: string;
  clientId: string;
  contact: Partial<Record<"email" | "phone" | "addressLine" | "postalCode" | "city", string | null>>;
}): Promise<void> {
  const link = await findEventClientLink(input.organizationId, input.eventId, input.clientId);
  if (!link?.contactId) throw new EventNotFoundError();
  try {
    await updateContact(input.organizationId, link.contactId, {
      email: input.contact.email ?? null,
      phone: input.contact.phone ?? null,
      addressLine: input.contact.addressLine ?? null,
      postalCode: input.contact.postalCode ?? null,
      city: input.contact.city ?? null,
    });
  } catch (error) {
    if (error instanceof ContactInvalidError) throw new InvalidClientContactError();
    if (error instanceof ContactEmailTakenError) throw new ClientEmailTakenError();
    if (error instanceof ContactNotFoundError) throw new EventNotFoundError();
    throw error;
  }
}

// Lot 14 (décision K) — budget souhaité, en centimes (null : effacé).
// Lot 34b (EVT-03, D11) — fiche d'identité : invités estimés et confirmés (0 à 100 000), style
// (2 000 caractères) et notes (10 000 caractères) ; un champ vide vaut nul.
export async function setEventIdentity(organizationId: string, eventId: string, input: EventIdentityInput): Promise<void> {
  const count = (value: number | null) => {
    if (value === null) return null;
    if (!Number.isInteger(value) || value < 0 || value > 100_000) throw new RangeError("nombre d'invités invalide");
    return value;
  };
  const text = (value: string | null, max: number) => {
    const clean = value?.replace(/\r\n/g, "\n").trim() ?? "";
    if (clean.length > max) throw new RangeError("texte trop long");
    return clean || null;
  };
  const identity = { guestsEstimated: count(input.guestsEstimated), guestsConfirmed: count(input.guestsConfirmed), style: text(input.style, 2000), notes: text(input.notes, 10_000) };
  if (!(await updateEventIdentityRow(organizationId, eventId, identity))) throw new EventNotFoundError();
}

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

// Lot 12 (L12-EVT-15) — lieux de l'événement. Lot 34b (EVT-03, D10) : une seule liste, le
// premier est le lieu de réception ; chaque lieu porte adresse, ville, horaires et contact.
export { EventPlaceEventNotFoundError, EventPlaceNotFoundError } from "./places";

export async function listEventPlaces(organizationId: string, eventId: string): Promise<EventPlace[]> {
  return listPlaces(organizationId, eventId);
}

export async function addEventPlace(organizationId: string, eventId: string, input: EventPlaceInput): Promise<EventPlace> {
  return addPlace(organizationId, eventId, input);
}

export async function updateEventPlace(organizationId: string, eventId: string, placeId: string, input: EventPlaceInput): Promise<EventPlace> {
  return updatePlace(organizationId, eventId, placeId, input);
}

export async function makeEventReceptionPlace(organizationId: string, eventId: string, placeId: string): Promise<void> {
  await makeReceptionPlace(organizationId, eventId, placeId);
}

export async function removeEventPlace(organizationId: string, eventId: string, placeId: string): Promise<void> {
  await removePlace(organizationId, eventId, placeId);
}

// Lot 11 (L11-EVT-10 / L11-EVT-11, ADR 0031) — prestataires consultés par poste.

export { CandidateQuoteRejectedError, VendorCandidateNotFoundError, CANDIDATE_QUOTE_MAX_SIZE_BYTES } from "./vendor-candidates";
export { DayContactInvalidError, EventDayContactNotFoundError } from "./day-contacts";
export {
  DayDocumentSourceError,
  DOCUMENT_LINK_MAX_DAYS,
  DOCUMENT_LINK_MIN_DAYS,
  EventDocumentNotFoundError,
  EventDocumentRejectedError,
  EVENT_DOCUMENT_FOLDER_NAME_MAX,
  EVENT_DOCUMENT_MAX_SIZE_BYTES,
  EVENT_DOCUMENT_LABEL_MAX,
} from "./documents";

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

// Lot 37a (DOC-01, D3, D4) — dossiers et versions des documents déposés.
export async function listEventDocumentFolders(organizationId: string, eventId: string): Promise<EventDocumentFolder[]> {
  return listDocumentFolders(organizationId, eventId);
}

export async function createEventDocumentFolder(organizationId: string, eventId: string, name: string): Promise<EventDocumentFolder> {
  const folder = await createDocumentFolder(organizationId, eventId, name);
  if (!folder) throw new EventNotFoundError();
  return folder;
}

export async function renameEventDocumentFolder(organizationId: string, folderId: string, name: string): Promise<void> {
  await renameDocumentFolder(organizationId, folderId, name);
}

export async function removeEventDocumentFolder(organizationId: string, folderId: string): Promise<void> {
  await removeDocumentFolder(organizationId, folderId);
}

export async function moveEventDocument(organizationId: string, documentId: string, folderId: string | null): Promise<void> {
  await moveDocument(organizationId, documentId, folderId);
}

export async function addEventDocumentVersion(input: AddEventDocumentVersionInput): Promise<EventDocument> {
  return addDocumentVersion(input);
}

export async function listEventDocumentVersions(organizationId: string, documentId: string): Promise<EventDocumentVersion[]> {
  return listDocumentVersions(organizationId, documentId);
}

export async function getEventDocumentVersionFile(organizationId: string, documentId: string, version: number): Promise<FileDownload> {
  return getDocumentVersionFile(organizationId, documentId, version);
}

// Lot 37a (POR-10, D6) — partage avec les clients et les prestataires de l'évènement.
export async function setEventDocumentSharing(organizationId: string, documentId: string, sharing: { clients: boolean; vendors: boolean }): Promise<void> {
  await setDocumentSharing(organizationId, documentId, sharing);
}

// Le lien relu en base décide du public : client (portail) ou prestataire (son espace).
async function sharedAudienceOf(organizationId: string, linkId: string): Promise<{ eventId: string; audience: "client" | "vendor" }> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || (access.audience !== "client" && access.audience !== "vendor")) throw new LinkAccessDeniedError();
  if (access.audience === "vendor" && !access.vendorCandidateId) throw new LinkAccessDeniedError();
  return { eventId: access.eventId, audience: access.audience };
}

export async function listLinkSharedDocuments(organizationId: string, linkId: string): Promise<EventDocument[]> {
  const { eventId, audience } = await sharedAudienceOf(organizationId, linkId);
  return listSharedDocuments(organizationId, eventId, audience);
}

export async function getLinkSharedDocumentFile(organizationId: string, linkId: string, documentId: string): Promise<FileDownload> {
  const { eventId, audience } = await sharedAudienceOf(organizationId, linkId);
  return getSharedDocumentFile(organizationId, { eventId, documentId, audience });
}

// Lot 37a (DOC-04, D7) — liens de partage d'un document, à durée limitée.
// Le jeton suit « # » (SEC-17, comme un lien personnel) : il n'est jamais envoyé au serveur dans
// l'adresse ; la page /partage le lit, puis l'envoie en POST.
export async function createEventDocumentLink(input: CreateEventDocumentLinkInput): Promise<{ link: EventDocumentShareLink; token: string; url: string }> {
  const created = await createDocumentLink(input);
  return { ...created, url: `${parseEnv(process.env).APP_PUBLIC_URL}/partage#${created.token}` };
}

export async function listEventDocumentLinks(organizationId: string, documentId: string): Promise<EventDocumentShareLink[]> {
  return listDocumentLinks(organizationId, documentId);
}

// Pour l'onglet « Documents » : les versions et les liens de tous les documents de l'évènement.
export async function listEventDocumentVersionsOfEvent(organizationId: string, eventId: string): Promise<EventDocumentVersion[]> {
  return listEventDocumentVersionRows(organizationId, eventId);
}

export async function listEventDocumentLinksOfEvent(organizationId: string, eventId: string): Promise<EventDocumentShareLink[]> {
  return listEventDocumentLinkRows(organizationId, eventId);
}

export async function revokeEventDocumentLink(organizationId: string, linkId: string, now?: Date): Promise<void> {
  await revokeDocumentLink(organizationId, linkId, now);
}

export async function describeEventDocumentLink(token: string, now?: Date): Promise<{ label: string; mime: string; sizeBytes: number } | null> {
  return peekDocumentLink(token, now);
}

export async function openEventDocumentLink(token: string, now?: Date): Promise<OpenedEventDocumentLink | null> {
  return openDocumentLink(token, now);
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

export const TASK_RESPONSIBLES: TaskResponsible[] = ["planner", "clients", "vendor"];
// Lot 34b (CHR-02, D12) : un modèle ne confie rien à un prestataire, qui n'est connu qu'une fois
// retenu sur l'événement.
export const TEMPLATE_TASK_RESPONSIBLES: TemplateTaskResponsible[] = ["planner", "clients"];

export class TaskVendorInvalidError extends Error {
  constructor() {
    super("la tâche ne se confie qu'à un prestataire retenu sur l'événement");
    this.name = "TaskVendorInvalidError";
  }
}

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
  if (!TEMPLATE_TASK_RESPONSIBLES.includes(item.responsible)) throw new RangeError("responsable inconnu");
  return { label: normalizeLabel(item.label), offsetDays: item.offsetDays, responsible: item.responsible };
}

function toTaskTemplateItem(row: TaskTemplateItemRow): TaskTemplateItem {
  return {
    id: row.id,
    label: row.label,
    offsetDays: row.offsetDays,
    responsible: row.responsible === "vendor" ? "planner" : row.responsible,
    position: row.position,
  };
}

function toTaskTemplate(template: TaskTemplateRow, items: TaskTemplateItemRow[]): TaskTemplate {
  return { id: template.id, name: template.name, eventTypeId: template.eventTypeId, items: items.map(toTaskTemplateItem) };
}

function toEventTask(row: EventTaskRow): EventTask {
  return {
    id: row.id,
    eventId: row.eventId,
    label: row.label,
    dueDate: row.dueDate,
    responsible: row.responsible,
    vendorCandidateId: row.vendorCandidateId,
    done: row.doneAt !== null,
    position: row.position,
    offsetDays: row.offsetDays,
    fixed: row.fixedAt !== null,
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
  eventTypeId: string | null = null,
): Promise<TaskTemplate> {
  if (eventTypeId) await assertEventTypeOf(organizationId, eventTypeId);
  const result = await insertTaskTemplate(organizationId, normalizeLabel(name), items.map(normalizeTemplateItem), eventTypeId);
  return toTaskTemplate(result.template, result.items);
}

// Lot 34a (EVT-01, D8) : rattacher un modèle à un type d'événement, ou le détacher.
export async function setTaskTemplateEventType(organizationId: string, templateId: string, eventTypeId: string | null): Promise<void> {
  // La clé étrangère ne voit pas la RLS : le type doit être de l'organisation.
  if (eventTypeId) await assertEventTypeOf(organizationId, eventTypeId);
  if (!(await setTaskTemplateEventTypeRow(organizationId, templateId, eventTypeId))) throw new TaskTemplateNotFoundError();
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
  const before = await findEventById(organizationId, eventId);
  const recalculation = await updateEventDateRow(organizationId, eventId, eventDate);
  if (!recalculation) throw new EventNotFoundError();
  // Lot 34a (EVT-01, D8) : sa première date donne son rétroplanning à un évènement qui n'en a pas.
  if (before && before.event.eventDate === null && eventDate !== null && (await findEventTasks(organizationId, eventId)).length === 0) {
    await applyDefaultTemplate(organizationId, eventId, before.event.eventTypeId);
  }
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
  if (row === "invalid_vendor") throw new TaskVendorInvalidError();
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
  if (row === "invalid_vendor") throw new TaskVendorInvalidError();
  return toEventTask(row);
}

// Lot 34a (DAT-07) : une tâche fixée redevient relative, à sa date d'écart.
export async function releaseEventTask(organizationId: string, taskId: string): Promise<EventTask> {
  const row = await releaseEventTaskRow(organizationId, taskId);
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

// Lot 37b (CHR-07, DAT-14 ; D8, ADR 0071) — « Diffuser le programme » fige une version numérotée,
// sans note interne, avec sa date et son auteur ; refusé si le programme est vide ou déjà diffusé
// tel quel. Clients et prestataires lisent la dernière version diffusée.
export async function publishEventProgram(input: PublishEventProgramInput): Promise<ProgramVersionSummary> {
  const program = await getEventProgram(input.organizationId, input.eventId);
  const items = publishedProgramItems(program.items);
  if (items.length === 0) throw new ProgramPublishError("empty");
  const result = await insertProgramVersion({ organizationId: input.organizationId, eventId: input.eventId, userId: input.userId, items, now: input.now ?? new Date() });
  if (result.status !== "published") throw result.status === "event_not_found" ? new EventNotFoundError() : new ProgramPublishError("unchanged");
  return result.version;
}

// La diffusion vue de la fiche : la dernière version, la liste des versions et ce qui a changé depuis.
export async function getEventProgramPublication(organizationId: string, eventId: string): Promise<ProgramPublication> {
  const [program, versions, latest] = await Promise.all([getEventProgram(organizationId, eventId), findProgramVersions(organizationId, eventId), findLatestProgramVersion(organizationId, eventId)]);
  const current = publishedProgramItems(program.items);
  const changes = programChanges(latest?.items ?? null, current);
  return { latest: versions[0] ?? null, versions, changes, canPublish: current.length > 0 && hasProgramChanges(changes) };
}

// DAT-14 : chaque version diffusée reste consultable et imprimable.
export async function getEventProgramVersion(organizationId: string, eventId: string, number: number): Promise<ProgramVersion | null> {
  if (!Number.isInteger(number) || number < 1) return null;
  return findProgramVersion(organizationId, eventId, number);
}

// Lot 38a (D9) — « Prévenir par e-mail » : « no_version » (rien n'est diffusé), « already_notified »
// (cette version est déjà partie), « no_recipients » (aucun lien actif concerné).
export class ProgramNotifyError extends Error {
  constructor(readonly reason: "no_version" | "already_notified" | "no_recipients") {
    super(`envoi du programme refusé : ${reason}`);
    this.name = "ProgramNotifyError";
  }
}

type ProgramRecipientRow = ProgramRecipient & { vendor: { vendorSlotId: string; slotLabel: string } | null };

// Les liens actifs des clients qui ont la rubrique Programme, et ceux des prestataires dont le poste
// existe encore (sa vue du programme en dépend).
async function programRecipientRows(organizationId: string, eventId: string, now: Date): Promise<ProgramRecipientRow[]> {
  const rows: ProgramRecipientRow[] = [];
  for (const context of await findEventLinkRows(organizationId, eventId)) {
    if (!usableLink(context, now)) continue;
    const base = { linkId: context.link.id, name: context.link.personName, email: context.link.email, locale: context.link.locale === "en" ? ("en" as const) : ("fr" as const) };
    if (context.link.audience === "client" && rightsOf(context).rubrics.includes("program")) rows.push({ ...base, audience: "client", vendor: null });
    if (context.link.audience === "vendor" && context.link.vendorCandidateId) {
      const vendor = await findLinkVendorRow(organizationId, context.link.vendorCandidateId);
      if (vendor && vendor.eventId === eventId) rows.push({ ...base, audience: "vendor", vendor: { vendorSlotId: vendor.vendorSlotId, slotLabel: vendor.slotLabel } });
    }
  }
  return rows;
}

export async function listProgramRecipients(organizationId: string, eventId: string, now: Date = new Date()): Promise<ProgramRecipient[]> {
  return (await programRecipientRows(organizationId, eventId, now)).map(({ vendor: _vendor, ...recipient }) => recipient);
}

// Chacun reçoit son programme de la dernière version : celui des clients, ou la vue de son poste
// (ses séquences en entier, le déroulé du jour en titres et horaires ; jamais de note interne).
function programDocumentOf(row: ProgramRecipientRow, found: { clients: { firstName: string }[]; event: { eventDate: string | null } }, version: ProgramVersion): ProgramRecipientDocument {
  const { vendor, ...recipient } = row;
  const event = { clientFirstNames: found.clients.map((client) => client.firstName), eventDate: found.event.eventDate };
  const published = { number: version.number, publishedAt: version.publishedAt };
  return vendor
    ? { recipient, event, version: published, view: { kind: "vendor", slotLabel: vendor.slotLabel, ...vendorProgramOf(version.items, vendor.vendorSlotId) } }
    : { recipient, event, version: published, view: { kind: "client", items: version.items } };
}

// Lot 38a (D9 ; MSG-02, D8 ; MSG-01, D5) — envoie la dernière version diffusée à ses destinataires,
// une seule fois : garde-fou à plusieurs personnes, chaque e-mail vérifié avant le premier envoi,
// chacun avec son PDF ; la version note quand et à combien de personnes elle est partie. Un plafond
// d'envois atteint arrête l'envoi : les e-mails non partis sont comptés.
export async function notifyProgramVersion(input: NotifyProgramVersionInput): Promise<ProgramNotification> {
  const { organizationId, eventId } = input;
  const now = input.now ?? new Date();
  const [found, version] = await Promise.all([findEventById(organizationId, eventId), findLatestProgramVersion(organizationId, eventId)]);
  if (!found) throw new EventNotFoundError();
  if (found.event.isDemo) throw new DemoEventRestrictionError();
  if (!version) throw new ProgramNotifyError("no_version");
  if (version.notifiedAt) throw new ProgramNotifyError("already_notified");
  const rows = await programRecipientRows(organizationId, eventId, now);
  if (rows.length === 0) throw new ProgramNotifyError("no_recipients");
  assertRecipientsConfirmed(
    rows.map(({ name, email }) => ({ name, email })),
    input.confirmedRecipients,
  );
  const vocabulary = (await findEventAudience(organizationId, eventId)) ?? "couple";
  const letters: { row: ProgramRecipientRow; values: EmailValues }[] = [];
  for (const row of rows) {
    const values: EmailValues = {
      ...(await linkEmailValues({ organizationId, eventId, audience: row.audience, personName: row.name, locale: row.locale, vocabulary, expiresOn: null })),
      version: String(version.number),
    };
    await assertOrganizationEmailReady({ organizationId, kind: "program_published", locale: row.locale, values });
    letters.push({ row, values });
  }
  if (!(await claimProgramNotification(organizationId, eventId, version.number, now))) throw new ProgramNotifyError("already_notified");
  let sent = 0;
  let failure: unknown = null;
  for (const { row, values } of letters) {
    try {
      const pdf = await input.renderDocument(programDocumentOf(row, found, version));
      await sendOrganizationEmail({
        organizationId,
        to: row.email,
        kind: "program_published",
        locale: row.locale,
        values,
        attachments: [{ filename: pdf.filename, content: Buffer.from(pdf.content), contentType: "application/pdf" }],
      });
      sent += 1;
    } catch (error) {
      failure = error;
      if (error instanceof MailQuotaExceededError) break;
      // Nom de l'erreur seulement au journal : jamais d'adresse (SEC-20).
      console.error("e-mail du programme non parti", error instanceof Error ? error.name : "erreur");
    }
  }
  if (sent === 0) {
    await releaseProgramNotification(organizationId, eventId, version.number);
    throw failure;
  }
  await recordProgramNotification(organizationId, eventId, version.number, sent);
  return { version: version.number, sent, notSent: letters.length - sent };
}

// D11 : la page d'un lien marque la dernière version comme vue (jamais l'aperçu « vu par »).
export async function markLinkProgramSeen(organizationId: string, linkId: string, number: number): Promise<void> {
  if (!Number.isInteger(number) || number < 1) return;
  await markProgramSeen(organizationId, linkId, number);
}

async function linkPublishedProgram(organizationId: string, linkId: string, eventId: string): Promise<{ version: ProgramVersion | null; isNew: boolean }> {
  const [version, seen] = await Promise.all([findLatestProgramVersion(organizationId, eventId), findLinkProgramSeen(organizationId, linkId)]);
  return { version, isNew: version !== null && seen !== null && version.number > seen };
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
  return !context.link.revokedAt && !isLinkExpired(expiresOnOf(context), now) && context.event.status !== "cancelled" && !context.event.isDemo;
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

// Lot 38a (MSG-01 ; D3, D5, D6 ; ADR 0072) : l'e-mail d'un lien part du modèle de l'organisation, à
// son image, dans la langue du lien. « {{évènement}} » dit « votre mariage » au client, « le mariage
// de Léa & Maxime » au prestataire (ADR 0045 : le vocabulaire du type d'évènement).
function emailTranslator(locale: "fr" | "en") {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Emails" });
}

function linkEmailKind(audience: LinkAudience, renewed: boolean): EmailTemplateKind {
  if (audience === "vendor") return renewed ? "vendor_link_renewed" : "vendor_link";
  return renewed ? "client_link_renewed" : "client_link";
}

async function linkEmailValues(input: { organizationId: string; eventId: string; audience: LinkAudience; personName: string; locale: "fr" | "en"; vocabulary: EventTypeAudience; expiresOn: string | null; url?: string }): Promise<EmailValues> {
  const found = await findEventById(input.organizationId, input.eventId);
  const clients = found ? eventNames(found.clients.filter((client) => client.firstName.trim())) : "";
  const t = emailTranslator(input.locale);
  const couple = input.vocabulary === "couple";
  const event =
    input.audience === "vendor"
      ? clients
        ? t(couple ? "event.coupleVendor" : "event.clientsVendor", { clients })
        : t(couple ? "event.coupleVendorUnnamed" : "event.clientsVendorUnnamed")
      : t(couple ? "event.coupleClient" : "event.clientsClient");
  return {
    first_name: input.personName,
    event,
    clients,
    event_date: found?.event.eventDate ? formatCalendarDate(found.event.eventDate, input.locale) : "",
    // Avant la création du lien, son échéance n'est pas encore connue : une valeur d'attente.
    valid_until: input.expiresOn ? formatCalendarDate(input.expiresOn, input.locale) : "—",
    ...(input.url ? { link: input.url } : {}),
  };
}

export async function createEventLink(input: CreateEventLinkInput): Promise<EventLinkDelivery> {
  if (!CREATABLE_AUDIENCES.includes(input.audience)) throw new EventLinkInvalidError("audience");
  const fields = validLinkFields(input.link);
  const vocabulary = input.vocabulary ?? (await findEventAudience(input.organizationId, input.eventId)) ?? "couple";
  const kind = linkEmailKind(input.audience, false);
  // L'évènement d'abord : un essai n'envoie jamais d'e-mail à un tiers (l'écriture le revérifie).
  const found = await findEventById(input.organizationId, input.eventId);
  if (!found) throw new EventNotFoundError();
  if (found.event.isDemo) throw new DemoEventRestrictionError();
  // Lot 38a (MSG-01, D5) : un lien ne se crée pas si son e-mail ne pourrait pas partir (variable vide).
  const base = { organizationId: input.organizationId, eventId: input.eventId, audience: input.audience, personName: fields.personName, locale: input.locale, vocabulary };
  await assertOrganizationEmailReady({ organizationId: input.organizationId, kind, locale: input.locale, values: await linkEmailValues({ ...base, expiresOn: null }) });
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
  await sendOrganizationEmail({ organizationId: input.organizationId, to: link.email, kind, locale: input.locale, values: await linkEmailValues({ ...base, personName: link.personName, expiresOn: link.expiresOn, url }), reserve: false });
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
  const vocabulary = input.vocabulary ?? (await findEventAudience(input.organizationId, current.link.eventId)) ?? "couple";
  const kind = linkEmailKind(current.link.audience, true);
  const base = { organizationId: input.organizationId, eventId: current.link.eventId, audience: current.link.audience, personName: current.link.personName, locale: input.locale, vocabulary };
  // Lot 38a (MSG-01, D5) : pas de nouveau jeton si l'e-mail ne pourrait pas partir.
  await assertOrganizationEmailReady({ organizationId: input.organizationId, kind, locale: input.locale, values: await linkEmailValues({ ...base, expiresOn: null }) });
  await reserveOrganizationMail(input.organizationId);
  const secret = newLinkSecret();
  const context = await replaceLinkTokenRow(input.organizationId, input.linkId, hashLinkSecret(secret), extendTo, input.locale);
  if (!context) throw new EventLinkNotFoundError();
  const link = toEventLink(context, now);
  const url = linkUrl(formatLinkToken(input.organizationId, secret));
  await sendOrganizationEmail({ organizationId: input.organizationId, to: link.email, kind, locale: input.locale, values: await linkEmailValues({ ...base, expiresOn: link.expiresOn, url }), reserve: false });
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
  // Lot 38a (D3) : un texte fixe de Symbola, mis en page.
  const t = emailTranslator(locale);
  await sendSymbolaEmail({ to: link.email, locale, subject: t("fixed.linkCode.subject", { code }), body: t("fixed.linkCode.body", { name: link.personName, code, minutes }), organizationId });
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
  if (!context || context.link.revokedAt || context.event.isDemo || context.event.status === "cancelled") return;
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
    // Lot 38a (D3) : dans la langue de la personne de l'équipe, texte fixe de Symbola.
    const locale = (await getUserContact(appDatabase(), organizationId, member.id))?.language ?? "fr";
    const t = emailTranslator(locale);
    await sendSymbolaEmail({
      to: member.email,
      locale,
      subject: t("fixed.renewalRequest.subject", { name: context.link.personName }),
      body: t("fixed.renewalRequest.body", { name: context.link.personName, url }),
      button: { label: t("fixed.renewalRequest.button"), url },
      organizationId,
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
// intervenant, ni prix, ni budget. Lot 37b (CHR-07, D9) : le programme est la dernière version
// diffusée ; ses séquences en entier, et le déroulé du jour en titres et horaires seulement.
export async function getVendorLinkView(organizationId: string, linkId: string): Promise<VendorLinkView> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || access.audience !== "vendor" || !access.vendorCandidateId) throw new LinkAccessDeniedError();
  const [vendor, found] = await Promise.all([findLinkVendorRow(organizationId, access.vendorCandidateId), findEventById(organizationId, access.eventId)]);
  if (!vendor || vendor.eventId !== access.eventId || !found) throw new LinkAccessDeniedError();
  const [places, published] = await Promise.all([listEventPlaces(organizationId, access.eventId), linkPublishedProgram(organizationId, linkId, access.eventId)]);
  const program: VendorProgramView = {
    version: published.version ? { number: published.version.number, publishedAt: published.version.publishedAt } : null,
    ...vendorProgramOf(published.version?.items ?? [], vendor.vendorSlotId),
    isNew: published.isNew,
  };
  return {
    vendorName: vendor.vendorName,
    slotLabel: vendor.slotLabel,
    clientFirstNames: found.clients.map((client) => client.firstName),
    eventDate: found.event.eventDate,
    places: places.map((place) => ({ id: place.id, label: place.label, address: place.address, city: place.city, startTime: place.startTime, endTime: place.endTime })),
    program,
    // Lot 34b (CHR-02, D12) : seulement les tâches qui lui sont confiées.
    tasks: (await findVendorTaskRows(organizationId, access.eventId, access.vendorCandidateId)).map((task) => ({ id: task.id, label: task.label, dueDate: task.dueDate, done: task.doneAt !== null })),
  };
}

// Lot 34b (CHR-02, D12) : le prestataire coche une tâche qui lui est confiée, depuis son espace.
export async function setVendorLinkTaskDone(organizationId: string, linkId: string, taskId: string, done: boolean): Promise<void> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || access.audience !== "vendor" || !access.vendorCandidateId) throw new LinkAccessDeniedError();
  const vendorCandidateId = access.vendorCandidateId;
  const result = await withActor({ kind: "link", id: linkId }, () =>
    toggleVendorTaskRow({ organizationId, linkId, eventId: access.eventId, vendorCandidateId, taskId, done }),
  );
  if (result.status === "denied") throw new LinkAccessDeniedError();
}

// Lot 34b (CHR-02, D13) — pièces jointes et commentaires d'une tâche, réservés à l'équipe.
export { TaskAttachmentNotFoundError } from "./task-attachments";
export { TaskCommentNotFoundError, TASK_COMMENT_MAX } from "./task-comments";

export async function listTaskAttachments(organizationId: string, taskId: string): Promise<EventTaskAttachment[]> {
  return listAttachments(organizationId, taskId);
}

export async function listEventTaskAttachments(organizationId: string, eventId: string): Promise<EventTaskAttachment[]> {
  return listEventAttachments(organizationId, eventId);
}

export async function attachTaskFile(input: AttachTaskFileInput): Promise<EventTaskAttachment> {
  const attachment = await attachFile(input);
  if (!attachment) throw new EventTaskNotFoundError();
  return attachment;
}

export async function removeTaskAttachment(organizationId: string, attachmentId: string): Promise<void> {
  await removeAttachment(organizationId, attachmentId);
}

export async function getTaskAttachmentFile(organizationId: string, attachmentId: string): Promise<FileDownload> {
  return getAttachmentFile(organizationId, attachmentId);
}

export async function listTaskComments(organizationId: string, taskId: string): Promise<EventTaskComment[]> {
  return listComments(organizationId, taskId);
}

export async function addTaskComment(input: { organizationId: string; taskId: string; authorUserId: string; body: string }): Promise<EventTaskComment> {
  const comment = await addComment(input);
  if (!comment) throw new EventTaskNotFoundError();
  return comment;
}

export async function removeTaskComment(input: { organizationId: string; commentId: string; authorUserId: string }): Promise<void> {
  await removeComment(input);
}

// Vue du tiers : résumé de l'événement, rétroplanning et programme (jamais de note interne) si
// leurs rubriques sont ouvertes. Lot 37b (D10) : la dernière version diffusée du programme.
export async function getLinkEventView(organizationId: string, linkId: string): Promise<ClientEventView> {
  const access = await requireLinkRubric(organizationId, linkId);
  const found = await findEventById(organizationId, access.eventId);
  if (!found) throw new LinkAccessDeniedError();
  const rubrics = access.rights.rubrics;
  const [tasks, program] = await Promise.all([
    rubrics.includes("tasks") ? listEventTasks(organizationId, access.eventId) : Promise.resolve(null),
    rubrics.includes("program") ? linkPublishedProgram(organizationId, linkId, access.eventId) : Promise.resolve(null),
  ]);
  return {
    // Résumé seulement : ni source du prospect ni motif de perte.
    event: toEventSummary(found.event, found.clients),
    tasks,
    program: program ? clientProgramView(program) : null,
  };
}

function clientProgramView(published: { version: ProgramVersion | null; isNew: boolean }): PublishedProgramView {
  return {
    version: published.version ? { number: published.version.number, publishedAt: published.version.publishedAt } : null,
    items: published.version?.items ?? [],
    isNew: published.isNew,
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
    const { link } = candidate.context;
    // Lot 38a (MSG-01, D5 ; ADR 0072) : le rappel part du modèle de l'organisation. Une variable vide
    // l'arrête avant toute réservation : il est porté au journal et signalé dans « Aujourd'hui ».
    const locale = link.locale === "en" ? "en" : "fr";
    const vocabulary = (await findEventAudience(organizationId, link.eventId)) ?? "couple";
    const values: EmailValues = {
      ...(await linkEmailValues({ organizationId, eventId: link.eventId, audience: "client", personName: link.personName, locale, vocabulary, expiresOn: null })),
      tasks: reminderTaskLines({ locale, tasks: due, today }),
    };
    try {
      await assertOrganizationEmailReady({ organizationId, kind: "task_reminder", locale, values });
    } catch (error) {
      if (!(error instanceof EmailVariableMissingError)) throw error;
      await recordAudit(appDatabase(), { organizationId, action: "hub.mail.variable_missing", objectId: link.eventId, details: { kind: "task_reminder", locale, missing: error.missing.join(",") }, actor: SYSTEM_ACTOR });
      continue;
    }
    try {
      await reserveOrganizationMail(organizationId, { now });
    } catch (error) {
      if (error instanceof MailQuotaExceededError) break;
      throw error;
    }
    const recorded = await withActor(SYSTEM_ACTOR, () =>
      insertTaskRemindersRow({ organizationId, eventId: link.eventId, linkId: link.id, reminders: due.map(({ taskId, threshold }) => ({ taskId, threshold })), now }),
    );
    if (recorded === 0) continue;
    await sendOrganizationEmail({ organizationId, to: link.email, kind: "task_reminder", locale, values, reserve: false });
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

function toDecision(row: EventDecisionRow, replacedBy: Map<string, string>, currentProgram: { updatedAt: string | null; latestVersion: number | null }): EventDecision {
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
    programChanged: row.status === "approved" && programChangedSince(snapshot, currentProgram),
  };
}

async function decisionsWithContext(organizationId: string, eventId: string, rows: EventDecisionRow[], all: EventDecisionRow[]): Promise<EventDecision[]> {
  const hasProgram = rows.some((row) => row.kind === "program");
  const [program, latest] = hasProgram ? await Promise.all([getEventProgram(organizationId, eventId), findLatestProgramVersion(organizationId, eventId)]) : [null, null];
  const currentProgram = { updatedAt: program?.updatedAt ?? null, latestVersion: latest?.number ?? null };
  const replacedBy = replacementsOf(all);
  return rows.map((row) => toDecision(row, replacedBy, currentProgram));
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
    // Lot 37b (D10) : le client approuve la dernière version diffusée, celle qu'il lit.
    const [program, version] = await Promise.all([getEventProgram(organizationId, eventId), findLatestProgramVersion(organizationId, eventId)]);
    if (!version || version.items.length === 0) throw new DecisionInvalidError("program");
    // Titre vide : l'écran affiche « le programme du jour J » dans la langue de la personne.
    subject = { subjectId: null, slotId: null, title: "", snapshot: { kind: "program", programUpdatedAt: program.updatedAt, itemCount: version.items.length, programVersion: version.number } };
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
  const programVersion = subject.snapshot.kind === "program" ? (subject.snapshot.programVersion ?? null) : null;
  return toDecision(row, new Map(), { updatedAt: subject.snapshot.kind === "program" ? subject.snapshot.programUpdatedAt : null, latestVersion: programVersion });
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
// messagerie de la planner (l'appelant), Symbola n'envoie rien. Lot 33b (HUB-10) : jamais depuis un
// évènement fictif, même vers un prestataire réel du carnet ajouté à l'exemple.
export async function recordVendorReminder(input: { organizationId: string; eventId: string; candidateId: string; userId: string }): Promise<{ vendorName: string; vendorId: string | null; slotLabel: string }> {
  const found = await findEventById(input.organizationId, input.eventId);
  if (!found) throw new CandidateNotFoundError();
  if (found.event.isDemo) throw new DemoEventRestrictionError();
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

// Lot 33b (HUB-10, PAR-01 ; D10) — « Explorer avec un exemple » : le mariage de référence en
// données fictives (is_demo), confirmé, avec le rétroplanning et le programme de départ. Étiqueté
// « Exemple », exclu des statistiques, exports et recherches comme tout évènement fictif ; supprimé
// d'un clic, proposé à la suppression au premier évènement réel, et purgé seul au bout de 30 jours.
// Un exemple ou un essai déjà en cours est rouvert, jamais doublé.
export const EXAMPLE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export async function startExampleEvent(input: StartEventsTrialInput): Promise<EventsTrial> {
  const now = input.now ?? new Date();
  const active = await findActiveDemoEvent(input.organizationId, now);
  if (active) return toTrial(active);

  const example = starterExampleEvent(input.locale);
  const eventDate = addDays(now.toISOString().slice(0, 10), example.daysFromToday);
  const retroplanning = starterRetroplanning(input.locale);
  const event = await insertDemoEvent(input.organizationId, {
    createdByUserId: input.userId,
    status: "confirmed",
    eventDate,
    expiresAt: new Date(now.getTime() + EXAMPLE_DURATION_MS),
    clients: example.clients,
    venueName: example.venueName,
    venueCity: example.venueCity,
    fallbackVendorSlotLabels: starterVendorSlots(input.locale),
    tasks: retroplanning.items.map((item) => ({ label: item.label, dueDate: addDays(eventDate, item.offsetDays), responsible: item.responsible })),
    programItems: starterProgram(input.locale).items,
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

// Lot 33b (HUB-10) : nombre d'évènements réels, pour proposer de supprimer l'exemple au premier.
export async function countOrganizationRealEvents(organizationId: string): Promise<number> {
  return countRealEvents(organizationId);
}

// Lot 33b (PAR-01, étape 6) — « Inviter un client » de la liste de prise en main.
export async function countOrganizationClientLinks(organizationId: string): Promise<number> {
  return countRealClientLinks(organizationId);
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
  publishEventProgram,
  getEventProgramPublication,
  getEventProgramVersion,
  markLinkProgramSeen,
  listProgramRecipients,
  notifyProgramVersion,
  listCalendarEvents,
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
  listEventTaskAttachments,
  listEventDocumentFolders,
  createEventDocumentFolder,
  renameEventDocumentFolder,
  removeEventDocumentFolder,
  moveEventDocument,
  addEventDocumentVersion,
  listEventDocumentVersions,
  getEventDocumentVersionFile,
  setEventDocumentSharing,
  listLinkSharedDocuments,
  getLinkSharedDocumentFile,
  createEventDocumentLink,
  listEventDocumentLinks,
  listEventDocumentVersionsOfEvent,
  listEventDocumentLinksOfEvent,
  revokeEventDocumentLink,
  describeEventDocumentLink,
  openEventDocumentLink,
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

// Lot 35a (HUB-13, DAT-13, ADR 0068) : entités du module dans l'export complet de l'organisation.
export { describeEventsExport, EVENTS_EXPORT_EXCLUSIONS, exportEventsData, listDemoEventIds } from "./export";

// Lot 36a (CRM-03, ADR 0069) : contacts des clients des évènements donnés (fin d'un essai : ses
// contacts d'essai partent avec lui), contacts encore clients d'un évènement, et évènements d'un
// contact (sa fiche, CRM-03 D7).
export async function listClientContactIds(organizationId: string, eventIds: readonly string[]): Promise<string[]> {
  return [...new Set((await findClientLinks(organizationId, eventIds)).map((link) => link.contactId).filter((id): id is string => id !== null))];
}

export async function listLinkedContactIds(organizationId: string, contactIds?: readonly string[]): Promise<Set<string>> {
  return findLinkedContactIds(organizationId, contactIds);
}

export async function listEventsOfContact(organizationId: string, contactId: string): Promise<EventSummary[]> {
  const ids = new Set(await findEventIdsOfContact(organizationId, contactId));
  if (ids.size === 0) return [];
  return (await findEvents(organizationId, {}))
    .filter((row) => ids.has(row.event.id) && !row.event.isDemo)
    .map((row) => toEventSummary(row.event, row.clients));
}

// —— Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) — corbeille du module ———————————————————————————

export {
  isContactUsedByAnEvent,
  isEventObjectTrashed,
  listTrashedEventIdsBefore,
  purgeEventElements,
  purgeTrashedEventObjects,
  purgeTrashedEvents,
  type EventTrashKind,
} from "./trash";

// L'évènement va à la corbeille à la date donnée (lib/trash.ts vérifie d'abord qu'il ne porte
// aucune pièce à conserver, et fait suivre ses lignes de budget et de devis).
export async function trashEvent(organizationId: string, eventId: string, at: Date): Promise<boolean> {
  return trashEventRow(organizationId, eventId, at);
}

export async function restoreEvent(organizationId: string, eventId: string): Promise<Date | null> {
  return restoreEventRow(organizationId, eventId);
}

export async function restoreEventTask(organizationId: string, taskId: string): Promise<boolean> {
  return restoreEventTaskRow(organizationId, taskId);
}

export async function restoreProgramItem(organizationId: string, itemId: string): Promise<boolean> {
  return restoreProgramItemRow(organizationId, itemId);
}

export async function restoreEventPlace(organizationId: string, placeId: string): Promise<boolean> {
  return restorePlace(organizationId, placeId);
}

export async function restoreTaskComment(input: { organizationId: string; commentId: string; authorUserId: string }): Promise<boolean> {
  return restoreComment(input);
}

export async function restoreEventDocument(organizationId: string, documentId: string): Promise<boolean> {
  return restoreDocumentRow(organizationId, documentId);
}

export async function restoreTaskTemplate(organizationId: string, templateId: string): Promise<boolean> {
  return restoreTaskTemplateRow(organizationId, templateId);
}

export async function restoreProgramTemplate(organizationId: string, templateId: string): Promise<boolean> {
  return restoreProgramTemplateRow(organizationId, templateId);
}

// Les objets du module à la corbeille ; un évènement est nommé par les prénoms de ses clients.
export async function listTrashedEventObjects(organizationId: string): Promise<TrashedObject[]> {
  const rows = await listTrashedEventRows(organizationId);
  return includingDeleted(() =>
    Promise.all(
      rows.map(async (row) => {
        const event = row.kind === "event" ? await getEvent(organizationId, row.id) : null;
        const label = row.kind === "event" ? (event ? eventNames(event.clients) : "") : (row.label ?? "");
        return { kind: row.kind, id: row.id, label, eventId: row.eventId, deletedAt: row.deletedAt, deletedBy: row.deletedBy };
      }),
    ),
  );
}

// Le libellé d'un évènement de la corbeille (bandeau « Annuler », confirmations).
export async function getTrashedEventLabel(organizationId: string, eventId: string): Promise<string | null> {
  const event = await includingDeleted(() => getEvent(organizationId, eventId));
  return event ? eventNames(event.clients) : null;
}

// Lot 39b (UX-09 ; D8 ; ADR 0074) — identité d'un évènement (invités, style, notes) et sa version.
export async function getEventIdentityState(
  organizationId: string,
  eventId: string,
): Promise<{ guestsEstimated: number | null; guestsConfirmed: number | null; style: string | null; notes: string | null; updatedAt: Date; updatedBy: string | null } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) return null;
  return findEventIdentityState(organizationId, eventId);
}

// Lot 49 (EVT-04 premier pas, INV-03 ; D2) — temps forts de l'évènement, et ce que le module Invités
// lit d'un évènement (clients, dates, statut, temps forts), par cette porte d'entrée (ADR 0011).
export { addKeyMoment, guestEventContexts, KEY_MOMENTS_MAX, KeyMomentInvalidError, KeyMomentNotFoundError, listKeyMoments, listRealEventIds, removeKeyMoment, updateKeyMoment } from "./key-moments";

// Lot 44 (CRM-01, CRM-02 ; ADR 0084) — formulaire de contact public et pipeline en colonnes.
export {
  acceptProspectRequest,
  ContactFormInvalidError,
  ContactFormSlugTakenError,
  ContactSubmissionInvalidError,
  contactFormNotice,
  countLinks,
  discardProspectRequest,
  getContactFormSettings,
  getEventProspectRequest,
  isFormTimingValid,
  isValidContactSlug,
  listProspectRequestsToReview,
  normalizeOrigin,
  notifyOwnerOfRequest,
  parseBudget,
  parseContactSubmission,
  ProspectRequestNotFoundError,
  purgeStaleProspectRequests,
  resolvePublicContactForm,
  saveContactFormSettings,
  sealFormOpening,
  submitContactForm,
  suggestContactFormSlug,
  type PublicContactFormView,
  type RawContactSubmission,
  type SubmitOptions,
} from "./contact-form";
export { contactFrameOrigins } from "./contact-frame";
export {
  addPipelineStage,
  listPipelineStages,
  movePipelineCard,
  movePipelineStage,
  PIPELINE_MAX_STAGES,
  PIPELINE_MIN_STAGES,
  PipelineMoveRefusedError,
  PipelineStageInvalidError,
  removePipelineStage,
  renamePipelineStage,
} from "./pipeline";

// Le pipeline, avec le nom des prospects (premier client de chaque option).
export async function getEventsPipeline(organizationId: string, locale: "fr" | "en"): Promise<Pipeline> {
  const options = await listEvents({ organizationId, statusIn: ["option"] });
  return getPipelineOf(organizationId, locale, new Map(options.map((event) => [event.id, eventNames(event.clients)])));
}

// « Gagné » (CRM-02, D9) : l'évènement est confirmé, avec les effets de la confirmation (EVT-05).
export async function winPipelineCard(input: { organizationId: string; eventId: string; userId: string }): Promise<void> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  if (event.status !== "option") throw new EventStatusTransitionError();
  await changeEventStatus({ organizationId: input.organizationId, eventId: input.eventId, changedByUserId: input.userId, toStatus: "confirmed" });
}

export class LossReasonRequiredError extends Error {
  constructor(readonly field: "reason" | "note") {
    super(field === "reason" ? "motif de perte obligatoire" : "précision du motif obligatoire");
    this.name = "LossReasonRequiredError";
  }
}

// « Perdu » (CRM-02, D9) : l'évènement est annulé ; le motif de perte est obligatoire, la note aussi
// pour le motif « Autre ».
export async function losePipelineCard(input: { organizationId: string; eventId: string; userId: string; lossReasonId: string | null; lossReasonNote: string | null }): Promise<void> {
  const reason = input.lossReasonId ? (await listLossReasons(input.organizationId)).find((candidate) => candidate.id === input.lossReasonId) : undefined;
  if (!reason) throw new LossReasonRequiredError("reason");
  const note = input.lossReasonNote?.trim().slice(0, 1000) || null;
  if (reason.isFreeText && !note) throw new LossReasonRequiredError("note");
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  if (event.status !== "option") throw new EventStatusTransitionError();
  await cancelEvent({ organizationId: input.organizationId, eventId: input.eventId, changedByUserId: input.userId, lossReasonId: reason.id, lossReasonNote: note });
}

// « Aujourd'hui » (PAR-02, étape 1) : les prospects du formulaire encore à la première étape, avec
// l'alerte de date prise (CRM-04) ; et le nombre de demandes « à vérifier ».
export type NewProspectRequest = { eventId: string; names: string; eventDate: string | null; period: string | null; receivedAt: string; dateTaken: boolean };

export async function listNewProspectRequests(organizationId: string, locale: "fr" | "en"): Promise<NewProspectRequest[]> {
  const pipeline = await getEventsPipeline(organizationId, locale);
  const firstStageId = pipeline.stages[0]?.id;
  const rows = firstStageId ? await findNewRequestRows(organizationId, firstStageId) : [];
  const cards = new Map(pipeline.cards.map((card) => [card.eventId, card]));
  return rows.flatMap((row) => {
    const card = cards.get(row.eventId);
    return card ? [{ eventId: row.eventId, names: card.names, eventDate: row.eventDate, period: row.period, receivedAt: row.receivedAt.toISOString(), dateTaken: card.dateTaken }] : [];
  });
}

export async function countProspectRequestsToReview(organizationId: string): Promise<{ count: number; oldest: string | null }> {
  const result = await countRequestsToReview(organizationId);
  return { count: result.count, oldest: result.oldest ? result.oldest.toISOString() : null };
}
