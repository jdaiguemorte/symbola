// Porte d'entrée publique du module events — seul fichier que les autres
// modules peuvent importer (ADR 0011). Pensé comme le futur contrat HTTP
// /v1/events si ce module est extrait en app autonome.
import { deleteDayReminderOverrideRow, findDayReminderEventRows, findDayReminderOverrideRows, findLinkVendorRecordId, findUpcomingEventTimeZones, upsertDayReminderOverrideRow } from "./repository";
import { z } from "zod";
import { dateInTimeZone, formatCalendarDate, isTimeZone, parisDaysSince, parisToday } from "@symbola/i18n";
import { canSetStatus, eventPhase } from "./lifecycle";
import { DemoEventRestrictionError, EventNotFoundError, LinkAccessDeniedError } from "./errors";
export { DemoEventRestrictionError, EventNotFoundError, LinkAccessDeniedError } from "./errors";
// Lot 34a (EVT-05) : les règles du cycle de vie, pour les écrans et lib/.
import { getPipeline as getPipelineOf } from "./pipeline";
import { countRequestsToReview, findNewRequestRows } from "./prospects-repository";
import type { AgencyOverview, ListAgencyOverviewInput, ListTasksInput, Pipeline, TaskList, TaskListItem, TaskRecurrenceValue } from "@symbola/contracts";
export { canPostpone, canSetStatus, closingDue, displayStep, eventPhase, FINISHED_STATUSES, FIRM_STATUSES, IN_PROGRESS_STATUSES, isInProgress, MANUAL_STATUSES, TENTATIVE_STATUSES, TIMELINE_PHASES } from "./lifecycle";
import type { EventStatus as LifecycleStatus } from "@symbola/contracts";
import { listTeam } from "@symbola/auth";
import { includingDeleted, SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { organizationLinksClosed } from "./closed-organization";
import { randomUUID } from "node:crypto";
import { parseEnv } from "@symbola/env";
import { MailQuotaExceededError, reserveOrganizationMail } from "@symbola/mail";
import { planningSoftwareProfile, starterClientTaskReminders, starterDemoEvent, starterExampleEvent, starterLinkExpiry, starterLinkProfiles, starterProgram, starterRetroplanning, starterTutorialEvent, starterVendorSlots, starterDayOfSettings, starterEventDocumentFolders, type StarterEventDocumentFolder, type StarterLinkProfile } from "@symbola/starter-templates";
import {
  postponeEventRow,
  confirmPostponementRow,
  previewTaskRecalculationRows,
  releaseEventTaskRow,
  updateEventTimeZoneRow,
  setTaskTemplateEventTypeRow,
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
  countTasksByEvent,
  StatusChangedMeanwhileError,
  applyProgramTemplateRows,
  applyTaskTemplateRows,
  countTemplatePastDueRows,
  type TemplatePastDueAnswer,
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
  saveProgramItemRows,
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
  hasOpenVendorLinkRow,
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
import { reminderTaskLines, reminderThreshold, reminderThresholdStart, type ReminderTask } from "./task-reminders";
import { clientTermForEvent as clientTermOf, getTaskSoonDays } from "./planning";
import type { AutomationHooks, DayReminderSetting, PreparedEmailView, RelationDraft } from "@symbola/contracts";
import { DAY_REMINDER_TARGETS, ENGAGED_CANDIDATE_STATUSES, dayReminderSettingSchema } from "@symbola/contracts";
import { recordAudit } from "@symbola/db/audit";
import { resolveClientContacts } from "./clients";
import { assertOrganizationEmailReady, assertRecipientsConfirmed, ContactEmailTakenError, ContactInvalidError, ContactNotFoundError, EmailVariableMissingError, depositPreparedEmail, getMemberSignature, getOrganizationLanguage, getUserContact, notificationRecipients, notify, preparesRelationEmail, sendOrganizationEmail, sendSymbolaEmail, sendTimeReached, updateContact } from "@/modules/hub/service";
import { createTranslator } from "next-intl";
import type { DayHelper, DayHelperInput, EmailTemplateKind, EmailValues, EventTeamMember, EventTeamRole, TrashedObject } from "@symbola/contracts";
import { EVENT_TEAM_ROLES } from "@symbola/contracts";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { answerDecisionRow, findDecisionRow, findDecisionRows, insertDecisionRow, replacementsOf, withdrawDecisionRow, type EventDecisionRow } from "./decisions-repository";
import { draftVendorRelationEmail, engageOptionChoice, engagementContext } from "./vendor-coordination";
import { findLastVendorReminders, findPendingDecisions, findUncontractedVendors, insertVendorReminder } from "./today-sources";
import { VendorCandidateNotFoundError as CandidateNotFoundError } from "./vendor-candidates";
import { answerProblem, DECISION_NOTE_MAX, decisionOpenTo, programChangedSince } from "./decisions";
import { hashLinkCode, LINK_CODE_TTL_MS, LINK_CODES_PER_HOUR, linkCodeExpiresAt, maskEmail, newLinkCode, normalizeLinkCode } from "./link-otp";
import { addPlace, listPlaces, makeReceptionPlace, removePlace, restorePlace, updatePlace } from "./places";
import { attachFile, getAttachmentFile, listAttachments, listEventAttachments, removeAttachment } from "./task-attachments";
import { addComment, listComments, removeComment, restoreComment } from "./task-comments";
import { addStarterCategories, countByCategory, createCategory, listCategories, moveCategory, removeCategory, TaskCategoryNotFoundError, updateCategory } from "./task-categories";
import { changeTasks, changeTasksKeepingUndo, removeTasks, restoreTasksDeletedWith, undoTasksChange, type UndoableTaskChange } from "./task-bulk";
import { actingMemberId, normalizeTaskNote } from "./task-assignment";
import { countOpenTasksOf, findAgencyOverview, findEventIdsWithoutTasks, findEventTaskRow, findTaskList } from "./task-list";
import { taskDueState } from "./due-state";
import { listTrashedEventRows, restoreDocumentRow, restoreEventRow, restoreProgramTemplateRow, restoreTaskTemplateRow, trashEventRow } from "./trash";
import { createStorageClient, deletePrivateObject, detectFileType, PrivateObjectNotFoundError, readPrivateObject, scanBuffer, uploadPrivateObject } from "@symbola/files";
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
  countSelectedEventsByVendor,
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
import { describeBrochureLink, draftProspectRelationEmail, openBrochureLink, prospectMessageValues, recordQuestionnaireSent, type ProspectRecipient } from "./prospect-messages";
import { listEventQuestionnaires as listQuestionnairesOfEvent } from "./questionnaires";
import {
  eventPrefillState,
  findResolvableAnswer,
  finishLinkQuestionnaire,
  freezeQuestionnaire as freezeQuestionnaireOf,
  getPortalQuestionnaire,
  insertEventQuestionnaire,
  listLinkQuestionnaires,
  markAnswersResolved,
  openQuestionnaireRubric,
  QuestionnaireNotFoundError as QuestionnaireMissingError,
  saveLinkAnswer,
  type PortalQuestionnaireView,
} from "./questionnaires";
import type { EventFieldValues } from "./questionnaire-rules";
import type { EventQuestionnaire, PrefillDifference, QuestionEventField, QuestionnaireAnswerValue } from "@symbola/contracts";
import { KeyMomentNotFoundError, listKeyMoments as listKeyMomentsOf } from "./key-moments";
import {
  actualsOf,
  claimDayShiftNotification,
  dayPhotoActionExists,
  deviceInstant,
  findDayRecords,
  insertDayPhoto,
  recordDayCheck,
  recordDayCheckpoint,
  recordDayIncident,
  recordDayShift,
  recordDayShiftNotification,
  findDayPhotoFile,
  resolveDayPhotoSubject,
  setDayShiftVersion,
  type DayActionResult,
} from "./day-of";
import { buildDayReport, saveDayReport } from "./day-report";
import { insertLeadIfNone, deleteEventTeamMember, deleteMemberFromAllTeams, findEventLeads, findEventTeam, findTeamEventIds, findTeamRole, seesAllEvents, upsertEventTeamMember, type EventViewer } from "./team";
import { importProgram } from "./program-import";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
import { clientProgramItems, findProgramOverlaps, hasProgramChanges, MAX_SHIFT_MINUTES, normalizeTime, programChanges, publishedProgramItems, sortProgramItems, vendorProgramOf } from "./program";
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
import { memoizePerRequest } from "@/lib/request-memo";
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
  MarkContractSignedInput,
  EventTaskProgress,
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
  SaveProgramItemsInput,
  ProgramParticipant,
  ProgramPublication,
  ProgramVersion,
  ProgramVersionSummary,
  PublishEventProgramInput,
  ProgramRecipient,
  ProgramRecipientDocument,
  NotifyProgramVersionInput,
  DayAction,
  DayActionStatus,
  DayPhoto,
  DayPhotoMeta,
  DayPhotoRejection,
  DayReport,
  DayReportHandover,
  DayState,
  ProgramImportResult,
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
  TaskPriority,
  TaskCategory,
  TaskCategoryInput,
  StarterTaskCategoryInput,
  BulkTaskChange,
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

// Lot 66b (JRJ-01 ; D2, D3 ; ADR 0112) : le rappel du jour J réglé pour cet évènement (coupé, ou un autre
// moment ou une autre heure), cible par cible ; sans réglage, celui de l'organisation.
export async function listDayReminderOverrides(organizationId: string, eventId: string): Promise<DayReminderSetting[]> {
  return (await findDayReminderOverrideRows(organizationId, eventId)).map((row) => ({ target: row.target as DayReminderSetting["target"], enabled: row.enabled, moment: row.moment as DayReminderSetting["moment"], sendTime: row.sendTime.slice(0, 5) }));
}

export async function setDayReminderOverride(organizationId: string, eventId: string, target: string, input: { enabled: boolean; moment: string; sendTime: string }): Promise<void> {
  if (!(DAY_REMINDER_TARGETS as readonly string[]).includes(target)) throw new RangeError("cible inconnue");
  const parsed = dayReminderSettingSchema.safeParse(input);
  if (!parsed.success) throw new RangeError("réglage refusé");
  await getEvent(organizationId, eventId);
  await upsertDayReminderOverrideRow(organizationId, eventId, { target: target as DayReminderSetting["target"], ...parsed.data });
}

export async function clearDayReminderOverride(organizationId: string, eventId: string, target: string): Promise<void> {
  if (!(DAY_REMINDER_TARGETS as readonly string[]).includes(target)) throw new RangeError("cible inconnue");
  await deleteDayReminderOverrideRow(organizationId, eventId, target);
}

// Lot 66a (HUB-28 ; D1 ; ADR 0112) : les fuseaux des évènements à venir ou sans date.
export async function listUpcomingEventTimeZones(organizationId: string, today: string): Promise<string[]> {
  return findUpcomingEventTimeZones(organizationId, today);
}
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
  TaskPriority,
  TaskCategory,
  TaskCategoryInput,
  StarterTaskCategoryInput,
  BulkTaskChange,
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
  SaveProgramItemsInput,
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
    eventTypeId: event.eventTypeId,
    name: event.name,
    archivedAt: event.archivedAt?.toISOString() ?? null,
    origin: event.origin,
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
    notes: event.notesSealed ? null : event.notes,
    notesConfidential: event.notesSealed && event.notesConfidentialBy ? { authorUserId: event.notesConfidentialBy } : null,
    ...(event.importedFields ? { importedFields: event.importedFields } : {}),
  };
}

// NFR-02 (ADR 0115) : la fiche d'un évènement et la liste des évènements sont demandées par plusieurs
// composants d'un même écran ; elles sont lues une fois par affichage (lib/request-memo.ts). Les
// lignes rendues sont partagées entre ces composants : aucun ne les modifie.
type EventFilters = Parameters<typeof findEvents>[1];
const findEventsOnce = memoizePerRequest((organizationId: string, filters: string) => findEvents(organizationId, JSON.parse(filters) as EventFilters));
const readEvents = (organizationId: string, filters: EventFilters) => findEventsOnce(organizationId, JSON.stringify(filters));
const readEvent = memoizePerRequest(findEventById);

export async function listEvents(input: ListEventsInput): Promise<EventSummary[]> {
  const rows = await readEvents(input.organizationId, {
    statusIn: input.statusIn,
    year: input.year,
    search: input.search,
    prospectSourceId: input.prospectSourceId,
    origin: input.origin,
  });
  // Lot 58 (PAR-09, étape 5) : un évènement archivé sort des listes courantes, reste consultable.
  const archived = input.archived ?? "include";
  const summaries = rows
    .filter(({ event }) => (archived === "include" ? true : archived === "only" ? event.archivedAt !== null : event.archivedAt === null))
    .map(({ event, clients }) => toEventSummary(event, clients));
  if (!input.withTaskProgress) return summaries;
  // Lot 72a (EVT-07, UX-01) : « Tâches faites » de la liste, en une requête groupée.
  const progress = await taskProgressByEvent(input.organizationId, summaries.map((event) => event.id), parisToday());
  return summaries.map((event) => ({ ...event, taskProgress: progress.get(event.id) ?? { done: 0, total: 0, late: 0 } }));
}

// Lot 72a (EVT-07, UX-01 ; critère 9) — tâches faites, total et en retard de chaque évènement demandé
// (zéro pour un évènement sans tâche, ou d'une autre organisation : la base ne le lit pas).
export async function taskProgressByEvent(organizationId: string, eventIds: string[], today: string): Promise<Map<string, EventTaskProgress>> {
  assertDate(today);
  const ids = [...new Set(eventIds)].filter((id) => UUID_PATTERN.test(id));
  const counts = new Map((await countTasksByEvent(organizationId, ids, today)).map((row) => [row.eventId, { done: row.done, total: row.total, late: row.late }]));
  return new Map(ids.map((id) => [id, counts.get(id) ?? { done: 0, total: 0, late: 0 }]));
}

// Lot 38b (HUB-29 ; D11) — les évènements du flux de calendrier de l'équipe : datés, ni essai, ni
// perdus ou annulés.
export async function listCalendarEvents(organizationId: string): Promise<CalendarEvent[]> {
  const rows = await readEvents(organizationId, {});
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
  const rows = await readEvents(organizationId, { statusIn: ["option"] });
  return rows
    .filter(({ event }) => !event.isDemo)
    .map(({ event, clients }) => ({
      eventId: event.id,
      names: eventNames(clients, event.name),
      lastUpdateAt: event.updatedAt,
      daysSince: parisDaysSince(event.updatedAt, now),
    }))
    .filter((row) => row.daysSince >= days)
    .sort((a, b) => b.daysSince - a.daysSince);
}

export async function getEvent(organizationId: string, eventId: string): Promise<EventDetail | null> {
  const result = await readEvent(organizationId, eventId);
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
    name: input.name?.trim() ? input.name.trim().slice(0, 200) : null,
    prospectSourceId: input.prospectSourceId,
    eventTypeId: input.eventTypeId ?? null,
    eventDate: input.eventDate,
    venueName: input.venueName,
    venueCity: input.venueCity,
    takeover: input.takeover === true,
  });
  // Lot 63c (EVT-01, CHR-01 ; ADR 0106, qui remplace D8 du lot 34a) : aucun rétroplanning d'office.
  // Le modèle choisi à la création s'applique, daté depuis la date de l'évènement ; un modèle d'une
  // autre organisation n'est pas lu (RLS) et refuse la création.
  // Lot 71b (C-67) : un mariage repris ne reçoit aucun modèle d'office.
  if (input.taskTemplateId && event.eventDate && !input.takeover) {
    const applied = await applyTaskTemplateRows(input.organizationId, event.id, input.taskTemplateId);
    if (applied.status === "template_not_found") throw new TaskTemplateNotFoundError();
  }
  return { id: event.id };
}

// Lot 63c (EVT-01, HUB-21 ; ADR 0106) — le modèle de rétroplanning proposé à la création pour un type :
// celui qui lui est rattaché (le premier créé s'il y en a plusieurs), jamais celui d'un autre type.
export async function findTaskTemplateForEventType(organizationId: string, eventTypeId: string): Promise<TaskTemplate | null> {
  return (await listTaskTemplates(organizationId)).find((template) => template.eventTypeId === eventTypeId) ?? null;
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(input.organizationId, input.eventId);
  const from = await currentStatus(input.organizationId, input.eventId);
  if (input.toStatus === "cancelled") {
    if (from === "cancelled") throw new EventStatusTransitionError();
  } else if (!canSetStatus(from, input.toStatus)) {
    throw new EventStatusTransitionError();
  }
  await updateEventStatus(input);
}

export async function cancelEvent(input: { organizationId: string; eventId: string; changedByUserId: string; lossReasonId: string | null; lossReasonNote: string | null }): Promise<void> {
  // Lot 72a (migration 0224) : l'annulation est datée du jour, dans le fuseau de l'évènement.
  await assertEventWritableRow(input.organizationId, input.eventId);
  const found = await findEventById(input.organizationId, input.eventId);
  if (!found) throw new EventNotFoundError();
  if (found.event.status === "cancelled") throw new EventStatusTransitionError();
  await updateEventStatus({ ...input, toStatus: "cancelled", effectiveOn: dateInTimeZone(new Date(), found.event.timeZone) });
}

// Lot 72a (EVT-05 ; E2, J2 ; critère 8) — « Le contrat est signé… » : une demande en cours (Option)
// passe à « Confirmé » à la date de signature choisie. Refusée dans le futur (fuseau de l'évènement) et
// plus d'un an avant la création de l'évènement ; aucune tâche n'est créée (la Synthèse propose ensuite le
// rétroplanning). Un évènement d'une autre organisation répond comme un évènement inexistant.
export class ContractSignedDateError extends Error {
  constructor(readonly reason: "invalid" | "future" | "too_early") {
    super("date de signature refusée");
    this.name = "ContractSignedDateError";
  }
}

const SIGNED_ON_MAX_YEARS_BEFORE_CREATION = 1;

export async function markContractSigned(input: MarkContractSignedInput): Promise<void> {
  await assertEventWritableRow(input.organizationId, input.eventId);
  const found = await findEventById(input.organizationId, input.eventId);
  if (!found) throw new EventNotFoundError();
  const { event } = found;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.signedOn) || Number.isNaN(Date.parse(`${input.signedOn}T00:00:00Z`)) || new Date(`${input.signedOn}T00:00:00Z`).toISOString().slice(0, 10) !== input.signedOn) throw new ContractSignedDateError("invalid");
  if (input.signedOn > dateInTimeZone(input.now ?? new Date(), event.timeZone)) throw new ContractSignedDateError("future");
  const created = dateInTimeZone(event.createdAt, event.timeZone);
  const earliest = `${Number(created.slice(0, 4)) - SIGNED_ON_MAX_YEARS_BEFORE_CREATION}${created.slice(4)}`;
  if (input.signedOn < earliest) throw new ContractSignedDateError("too_early");
  if (!canSetStatus(event.status, "confirmed") || event.status !== "option") throw new EventStatusTransitionError();
  try {
    await updateEventStatus({ organizationId: input.organizationId, eventId: input.eventId, changedByUserId: input.changedByUserId, toStatus: "confirmed", effectiveOn: input.signedOn, expectFrom: "option" });
  } catch (error) {
    if (error instanceof StatusChangedMeanwhileError) throw new EventStatusTransitionError();
    throw error;
  }
}

export async function reactivateEvent(input: { organizationId: string; eventId: string; changedByUserId: string }): Promise<void> {
  await changeEventStatus({ ...input, toStatus: "option" });
}

export async function postponeEvent(input: { organizationId: string; eventId: string; changedByUserId: string; newDate: string | null }): Promise<void> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(input.organizationId, input.eventId);
  if (input.newDate !== null) assertDate(input.newDate);
  const result = await postponeEventRow(input);
  if (result.status === "not_found") throw new EventNotFoundError();
  if (result.status === "not_postponable") throw new EventStatusTransitionError();
}

// Confirmer le report : les échéances relatives suivent la nouvelle date, puis l'événement
// retrouve son statut d'avant. Renvoie la date d'avant (pour le devis signé, D7).
export async function confirmPostponement(input: { organizationId: string; eventId: string; changedByUserId: string }): Promise<{ previousDate: string | null; eventDate: string }> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(input.organizationId, input.eventId);
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(input.organizationId, input.eventId);
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
  if (wantedBudgetCents !== null && (!Number.isInteger(wantedBudgetCents) || wantedBudgetCents < 0)) throw new RangeError("montant invalide");
  if (!(await updateWantedBudgetRow(organizationId, eventId, wantedBudgetCents))) throw new EventNotFoundError();
}

// Lot 31b (FAC-04, DOC-02) — lieu de l'événement (nom, ville), pour que la variable
// {evenement.lieu} d'un contrat se comble ; vide : effacé.
export async function setEventVenue(organizationId: string, eventId: string, venue: { venueName: string | null; venueCity: string | null }): Promise<void> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
  return addPlace(organizationId, eventId, input);
}

export async function updateEventPlace(organizationId: string, eventId: string, placeId: string, input: EventPlaceInput): Promise<EventPlace> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
  return updatePlace(organizationId, eventId, placeId, input);
}

export async function makeEventReceptionPlace(organizationId: string, eventId: string, placeId: string): Promise<void> {
  await makeReceptionPlace(organizationId, eventId, placeId);
}

export async function removeEventPlace(organizationId: string, eventId: string, placeId: string): Promise<void> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(input.organizationId, input.eventId);
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

// Lot 65b : nombre d'évènements où chaque fiche du carnet a été retenue.
export async function countWorkedWithByVendor(organizationId: string): Promise<Map<string, number>> {
  return countSelectedEventsByVendor(organizationId);
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
  const folder = await createDocumentFolder(organizationId, eventId, name);
  if (!folder) throw new EventNotFoundError();
  return folder;
}

// Lot 63c (DOC-01, BUD-04 ; M8) — les dossiers typés d'un évènement (« Devis des prestataires »,
// « Factures des prestataires », « Contrats »), tirés du fichier de données. Ceux qui manquent sont
// créés (à la création de l'évènement, ou au premier dépôt de ce type) ; un dossier renommé ou
// supprimé par l'équipe n'est pas recréé tant qu'aucune pièce de ce type n'est déposée.
export type TypedDocumentFolder = StarterEventDocumentFolder & { folderId: string | null };

export async function listTypedDocumentFolders(organizationId: string, eventId: string, locale: "fr" | "en"): Promise<TypedDocumentFolder[]> {
  const folders = await listDocumentFolders(organizationId, eventId);
  return starterEventDocumentFolders(locale).map((typed) => ({ ...typed, folderId: folders.find((folder) => folder.name === typed.name)?.id ?? null }));
}

export async function ensureTypedDocumentFolder(organizationId: string, eventId: string, locale: "fr" | "en", key: StarterEventDocumentFolder["key"]): Promise<string> {
  const typed = (await listTypedDocumentFolders(organizationId, eventId, locale)).find((folder) => folder.key === key);
  if (!typed) throw new EventNotFoundError();
  return typed.folderId ?? (await createEventDocumentFolder(organizationId, eventId, typed.name)).id;
}

export async function createTypedDocumentFolders(organizationId: string, eventId: string, locale: "fr" | "en"): Promise<void> {
  for (const typed of await listTypedDocumentFolders(organizationId, eventId, locale)) {
    if (!typed.folderId) await createEventDocumentFolder(organizationId, eventId, typed.name);
  }
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

// Lot 45 (CRM-05, D1) : la page /partage ouvre aussi le lien de la brochure envoyée à un prospect.
export async function describeEventDocumentLink(token: string, now?: Date): Promise<{ label: string; mime: string; sizeBytes: number } | null> {
  return (await peekDocumentLink(token, now)) ?? (await describeBrochureLink(token, now));
}

export async function openEventDocumentLink(token: string, now?: Date): Promise<OpenedEventDocumentLink | null> {
  return (await openDocumentLink(token, now)) ?? (await openBrochureLink(token, now));
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
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
    // Lot 53 (CHR-10) : les écrans d'un évènement ne lisent que ses tâches ; une tâche hors évènement
    // passe par listStandaloneTasks (son propre type).
    eventId: row.eventId ?? "",
    label: row.label,
    dueDate: row.dueDate,
    responsible: row.responsible,
    vendorCandidateId: row.vendorCandidateId,
    done: row.doneAt !== null,
    position: row.position,
    offsetDays: row.offsetDays,
    // Lot 53 (CHR-05).
    isMilestone: row.isMilestone,
    fixed: row.fixedAt !== null,
    ...(row.importedFields ? { importedFields: row.importedFields } : {}),
    // Lot 63d (CHR-03).
    categoryId: row.categoryId,
    priority: row.priority,
    // Lot 70a (CHR-02, CHR-04 ; A1 à A4, A7, A9).
    assigneeUserId: row.assigneeUserId,
    doneAt: row.doneAt?.toISOString() ?? null,
    doneBy: row.doneByKind ? { kind: row.doneByKind, userId: row.doneByUserId } : null,
    note: row.note,
  };
}

// Lot 70a (§ 3.4) : ce qu'un lien (mariés, prestataire) lit d'une tâche — ni la note interne, ni la
// personne de l'agence, ni l'identifiant d'un collègue (« l'agence » seulement).
function toLinkTask(task: EventTask): EventTask {
  return { ...task, note: null, assigneeUserId: null, doneBy: task.doneBy ? { kind: task.doneBy.kind, userId: null } : null };
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
  const recalculation = await updateEventDateRow(organizationId, eventId, eventDate);
  if (!recalculation) throw new EventNotFoundError();
  // Lot 63c (ADR 0106) : la première date ne pose plus de rétroplanning d'office ; la fiche le propose.
  return recalculation;
}

export async function getTaskRecalculation(organizationId: string, eventId: string): Promise<TaskRecalculation> {
  const recalculation = await findTaskRecalculation(organizationId, eventId);
  if (!recalculation) throw new EventNotFoundError();
  return recalculation;
}

export async function resolveTaskRecalculation(organizationId: string, eventId: string, accept: boolean): Promise<void> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
  if (!(await resolveTaskRecalculationRow(organizationId, eventId, accept))) throw new EventNotFoundError();
}

// Lot 71c (CHR-01, CHR-02 ; I3) : « Partir d'un modèle » sur un mariage repris pose la question des
// échéances passées ; sans réponse, rien n'est appliqué (TemplatePastDueUnansweredError).
export class TemplatePastDueUnansweredError extends Error {
  constructor() {
    super("échéances passées du modèle sans réponse");
    this.name = "TemplatePastDueUnansweredError";
  }
}

export async function countTemplatePastDue(organizationId: string, eventId: string, now: Date = new Date()): Promise<Map<string, number>> {
  return countTemplatePastDueRows(organizationId, eventId, parisToday(now));
}

export async function applyTaskTemplate(
  organizationId: string,
  eventId: string,
  templateId: string,
  options: { pastDue?: TemplatePastDueAnswer | null; now?: Date } = {},
): Promise<EventTask[]> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
  const result = await applyTaskTemplateRows(organizationId, eventId, templateId, { answer: options.pastDue ?? null, today: parisToday(options.now ?? new Date()) });
  switch (result.status) {
    case "past_due_unanswered":
      throw new TemplatePastDueUnansweredError();
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

// Lot 70a (UX-06 ; Q47-4) : avec la date du jour, chaque tâche porte son état d'échéance.
export async function listEventTasks(organizationId: string, eventId: string, today?: string): Promise<EventTask[]> {
  const rows = await findEventTasks(organizationId, eventId);
  if (today === undefined) return rows.map(toEventTask);
  const soonDays = await getTaskSoonDays(organizationId);
  return rows.map((row) => {
    const task = toEventTask(row);
    return { ...task, dueState: taskDueState(task, today, soonDays) };
  });
}

// Noms affichés d'un événement : prénoms des mariés (« Inès & Sacha »). Lot 63c (Q43) : le nom de
// l'évènement, s'il en a un, les remplace.
export function eventNames(clients: { firstName: string }[], name?: string | null): string {
  return name?.trim() ? name.trim() : clients.map((client) => client.firstName).join(" & ");
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
  const soonDays = await getTaskSoonDays(input.organizationId);
  return rows.flatMap((row) => {
    const event = row.eventId ? eventsById.get(row.eventId) : undefined;
    if (!event) return [];
    const task = toEventTask(row);
    // Lot 70a (UX-06 ; Q47-4) : un seul calcul de l'état d'échéance (due-state.ts).
    const dueState = taskDueState(task, input.today, soonDays);
    return [
      {
        ...task,
        dueState,
        overdue: dueState?.kind === "late",
        event: { id: event.id, names: eventNames(event.clients, event.name), eventDate: event.eventDate, status: event.status, isDemo: event.isDemo },
      },
    ];
  });
}

export async function addEventTask(organizationId: string, eventId: string, task: EventTaskInput): Promise<EventTask> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
  assertDate(task.dueDate);
  if (!TASK_RESPONSIBLES.includes(task.responsible)) throw new RangeError("responsable inconnu");
  if (task.priority !== undefined && !TASK_PRIORITIES.includes(task.priority)) throw new RangeError("priorité inconnue");
  // Lot 70a (CHR-02 ; A3, A7) : un membre actif de l'organisation (vérifié dans la transaction de
  // l'écriture), sinon la personne qui crée ; note interne.
  const note = normalizeTaskNote(task.note);
  const actorId = await actingMemberId();
  const row = await insertEventTask(organizationId, eventId, { ...task, label: normalizeLabel(task.label), note }, actorId);
  if (!row) throw new EventNotFoundError();
  if (row === "invalid_vendor") throw new TaskVendorInvalidError();
  if (row === "invalid_category") throw new TaskCategoryNotFoundError();
  return toEventTask(row);
}

export async function updateEventTask(input: UpdateEventTaskInput): Promise<EventTask> {
  if (input.dueDate !== undefined) assertDate(input.dueDate);
  if (input.responsible !== undefined && !TASK_RESPONSIBLES.includes(input.responsible)) {
    throw new RangeError("responsable inconnu");
  }
  if (input.priority !== undefined && !TASK_PRIORITIES.includes(input.priority)) throw new RangeError("priorité inconnue");
  const label = input.label === undefined ? undefined : normalizeLabel(input.label);
  // Lot 70a (CHR-02 ; A1 à A4, A7) : un membre actif de l'organisation (vérifié dans la transaction de
  // l'écriture) ; la note, nettoyée.
  const note = normalizeTaskNote(input.note);
  const actorId = await actingMemberId();
  const row = await updateEventTaskRow({ ...input, label, note, actorId });
  if (!row) throw new EventTaskNotFoundError();
  if (row === "invalid_vendor") throw new TaskVendorInvalidError();
  if (row === "invalid_category") throw new TaskCategoryNotFoundError();
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

// Lot 63d (CHR-02, UX-07 ; maquette M6) — actions groupées du tableau des tâches, et suppression groupée
// annulable d'un seul « Annuler ».
export const TASK_PRIORITIES: TaskPriority[] = ["high", "normal"];

export async function changeEventTasks(organizationId: string, taskIds: string[], change: BulkTaskChange): Promise<number> {
  // Lot 70a (CHR-02 ; A19) : « Confier à » n'accepte qu'un membre actif de l'organisation (task-bulk.ts).
  return changeTasks(organizationId, taskIds, change, await actingMemberId());
}

// Lot 70a (UX-07 ; C-09, A18) — « Changer la date » et « Confier à » avec « Annuler » : les valeurs d'avant
// sont gardées dix minutes ; seule la personne qui a fait le geste les rend.
export async function changeTasksWithUndo(input: { organizationId: string; userId: string; taskIds: string[]; change: UndoableTaskChange; now?: Date }): Promise<{ changed: number; undoId: string | null }> {
  return changeTasksKeepingUndo({ ...input, actorId: await actingMemberId() });
}

export async function undoTaskChange(input: { organizationId: string; userId: string; undoId: string; now?: Date }): Promise<number> {
  return undoTasksChange(input);
}

// Lot 70a (CHR-02, CHR-03, CHR-10 ; A20) — la liste unique des tâches de l'organisation, filtrée et comptée.
export async function listTasks(input: ListTasksInput): Promise<TaskList> {
  assertDate(input.today);
  const filters = input.filters ?? {};
  const [{ rows, total, todoTotal, todoByWho }, soonDays] = await Promise.all([findTaskList({ organizationId: input.organizationId, today: input.today, viewer: input.viewer, filters }), getTaskSoonDays(input.organizationId)]);
  const eventIds = new Set(rows.flatMap((row) => (row.eventId ? [row.eventId] : [])));
  const eventsById = eventIds.size > 0 ? new Map((await listEvents({ organizationId: input.organizationId })).filter((event) => eventIds.has(event.id)).map((event) => [event.id, event])) : new Map<string, EventSummary>();
  const tasks: TaskListItem[] = rows.map((row) => {
    const task = toEventTask(row);
    const event = row.eventId ? eventsById.get(row.eventId) : undefined;
    return {
      ...task,
      eventId: row.eventId,
      dueState: taskDueState(task, input.today, soonDays),
      event: event ? { id: event.id, names: eventNames(event.clients, event.name), eventDate: event.eventDate, status: event.status, isDemo: event.isDemo } : null,
    };
  });
  return { tasks, total, filtered: tasks.length, late: tasks.filter((task) => task.dueState?.kind === "late").length, soonDays, todoTotal, todoByWho };
}

// Lot 72c (PAR-10, HUB-03, EVT-06 ; C-14, A7) — la vue « L'agence » d'« Aujourd'hui » : par personne et par
// évènement, dans ce que la personne voit (lot 52, A20), en trois lectures groupées.
export async function listAgencyOverview(input: ListAgencyOverviewInput): Promise<AgencyOverview> {
  assertDate(input.today);
  if (!Number.isInteger(input.horizonDays) || input.horizonDays < 0) throw new RangeError("horizon attendu");
  return findAgencyOverview({ organizationId: input.organizationId, viewer: input.viewer, today: input.today, horizonEnd: addDays(input.today, input.horizonDays) });
}

// Lot 70d (UX-08, C-55) : parmi des évènements de l'organisation, ceux qui n'ont encore aucune tâche (un
// mariage repris dont les tâches sont restées dans l'ancien outil).
export async function eventIdsWithoutTasks(organizationId: string, eventIds: string[]): Promise<string[]> {
  return findEventIdsWithoutTasks(organizationId, eventIds);
}

// Lot 70c (CHR-02 ; D3) : une tâche pour son panneau, d'évènement ou non, avec son état d'échéance et sa
// répétition. Une tâche d'un évènement que la personne ne voit pas (autre organisation, équipe restreinte,
// lot 52) n'est pas trouvée, avec la même réponse qu'une tâche inexistante.
export type TaskDetail = TaskListItem & { recurrence: TaskRecurrenceValue | null };

export async function getTask(organizationId: string, taskId: string, today: string): Promise<TaskDetail | null> {
  assertDate(today);
  const row = await findEventTaskRow(organizationId, taskId);
  if (!row || row.deletedAt) return null;
  const detail = row.eventId ? await getEvent(organizationId, row.eventId) : null;
  if (row.eventId && !detail) return null;
  const task = toEventTask(row);
  return {
    ...task,
    eventId: row.eventId,
    dueState: taskDueState(task, today, await getTaskSoonDays(organizationId)),
    event: detail ? { id: detail.id, names: eventNames(detail.clients, detail.name), eventDate: detail.eventDate, status: detail.status, isDemo: detail.isDemo } : null,
    recurrence: row.recurrence ?? null,
  };
}

// Lot 70a (A19) : ce qu'une notification lit d'une tâche (titre court, état, personne), par son identifiant.
export async function getTaskBrief(organizationId: string, taskId: string): Promise<{ label: string; done: boolean; assigneeUserId: string | null; eventId: string | null } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)) return null;
  const row = await findEventTaskRow(organizationId, taskId);
  return row ? { label: row.label, done: row.doneAt !== null, assigneeUserId: row.assigneeUserId, eventId: row.eventId } : null;
}

// Lot 70a (A4) : les tâches à faire restées au nom d'une personne (par exemple après le retrait de son accès).
export async function countOpenTasksAssignedTo(organizationId: string, userId: string): Promise<number> {
  return countOpenTasksOf(organizationId, userId);
}

export async function removeEventTasks(organizationId: string, taskIds: string[]): Promise<number> {
  return removeTasks(organizationId, taskIds);
}

export async function restoreEventTasksDeletedWith(organizationId: string, taskId: string): Promise<number> {
  return restoreTasksDeletedWith(organizationId, taskId);
}

// Lot 63d (CHR-03, HUB-20) — catégories des tâches (Paramètres des évènements).
export async function listTaskCategories(organizationId: string): Promise<TaskCategory[]> {
  return listCategories(organizationId);
}

export async function addStarterTaskCategories(organizationId: string, categories: StarterTaskCategoryInput[]): Promise<number> {
  return addStarterCategories(organizationId, categories);
}

export async function createTaskCategory(organizationId: string, input: TaskCategoryInput): Promise<TaskCategory> {
  return createCategory(organizationId, input);
}

export async function updateTaskCategory(organizationId: string, categoryId: string, input: TaskCategoryInput): Promise<void> {
  return updateCategory(organizationId, categoryId, input);
}

export async function moveTaskCategory(organizationId: string, categoryId: string, direction: "up" | "down"): Promise<void> {
  return moveCategory(organizationId, categoryId, direction);
}

export async function removeTaskCategory(organizationId: string, categoryId: string): Promise<number> {
  return removeCategory(organizationId, categoryId);
}

export async function countTasksByCategory(organizationId: string): Promise<Record<string, number>> {
  return countByCategory(organizationId);
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
  constructor(readonly reason: "responsible" | "duration" | "moment") {
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
    keyMomentId: input.keyMomentId && UUID_PATTERN.test(input.keyMomentId) ? input.keyMomentId : null,
    ...(input.hiddenFromClients !== undefined ? { hiddenFromClients: input.hiddenFromClients === true } : {}),
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
    keyMomentId: item.keyMomentId,
    hiddenFromClients: item.hiddenFromClients,
    timing: item.timing,
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
    case "moment_not_found":
      throw new KeyMomentNotFoundError();
  }
}

// Lot 51 (EVT-04 ; D1) : nom du temps fort créé de lui-même, dans la langue de l'organisation.
async function mainMomentName(organizationId: string): Promise<string> {
  return starterDayOfSettings(await getOrganizationLanguage(appDatabase(), organizationId)).mainMomentName;
}

export async function getEventProgram(organizationId: string, eventId: string): Promise<EventProgram> {
  const result = await findEventProgram(organizationId, eventId);
  if (!result) throw new EventNotFoundError();
  const items = sortProgramItems(result.items.map(toProgramItem));
  const momentDates = new Map(result.moments.map((moment) => [moment.id, moment.date]));
  return {
    items,
    moments: result.moments,
    // Lot 67d (CHR-06 ; R09) : les clients (par leur rôle) ne sont pas signalés ; chaque jour à part.
    overlaps: findProgramOverlaps(
      items.map((item) => ({ ...item, day: item.keyMomentId ? (momentDates.get(item.keyMomentId) ?? null) : null })),
      planningSoftwareProfile().programExport,
    ),
    updatedAt: result.event.programUpdatedAt?.toISOString() ?? null,
  };
}

// Lot 37b (CHR-07, DAT-14 ; D8, ADR 0071) — « Diffuser le programme » fige une version numérotée,
// sans note interne, avec sa date et son auteur ; refusé si le programme est vide ou déjà diffusé
// tel quel. Clients et prestataires lisent la dernière version diffusée.
export async function publishEventProgram(input: PublishEventProgramInput): Promise<ProgramVersionSummary> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(input.organizationId, input.eventId);
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
    : { recipient, event, version: published, view: { kind: "client", items: clientProgramItems(version.items) } };
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
  // Lot 65d (MSG-01 ; ADR 0110) : quand la planner envoie de sa messagerie, un message est préparé pour
  // chaque personne (le programme est dans son espace, ou en PDF à joindre à la main).
  if (await preparesRelationEmail(organizationId, "program_published")) {
    for (const { row } of letters) {
      await depositPreparedEmail({ organizationId, kind: "program_published", eventId, recipientType: "event_link", recipientId: row.linkId, ref: { version: String(version.number) }, origin: "gesture", sourceKey: `program:${eventId}:${version.number}:${row.linkId}` });
    }
    await recordProgramNotification(organizationId, eventId, version.number, letters.length);
    return { version: version.number, sent: 0, notSent: 0, prepared: letters.length };
  }
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

// Lot 63b (Q44) : un lien de client ne reçoit jamais une séquence cachée des mariés ; un lien de
// prestataire la garde (vendorProgramOf ne lui montre que les siennes en entier).
async function linkPublishedProgram(organizationId: string, linkId: string, eventId: string, audience: "client" | "vendor" = "client"): Promise<{ version: ProgramVersion | null; isNew: boolean }> {
  const [latest, seen] = await Promise.all([findLatestProgramVersion(organizationId, eventId), findLinkProgramSeen(organizationId, linkId)]);
  const version = latest && audience === "client" ? { ...latest, items: clientProgramItems(latest.items) } : latest;
  return { version, isNew: version !== null && seen !== null && version.number > seen };
}

export async function addProgramItem(organizationId: string, eventId: string, item: ProgramItemInput): Promise<ProgramItem> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
  return savedProgramItem(
    await insertProgramItem(
      organizationId,
      eventId,
      normalizeProgramItem(item),
      item.vendorSlotIds,
      cleanLabels(item.freeParticipants),
      await mainMomentName(organizationId),
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

// Lot 62c (UX-13, décision D1) — le programme s'enregistre d'un coup : les séquences modifiées et
// les séquences ajoutées, dans une seule transaction (tout ou rien). Une saisie refusée dit sa
// ligne, pour que l'écran l'ouvre ; rien n'est écrit tant qu'une ligne est refusée.
export const PROGRAM_BATCH_MAX_LINES = 500;

export class ProgramBatchLineError extends Error {
  constructor(
    readonly line: { kind: "update"; itemId: string } | { kind: "addition"; index: number },
    readonly reason: unknown,
  ) {
    super("ligne du programme refusée");
    this.name = "ProgramBatchLineError";
  }
}

export async function saveProgramItems(organizationId: string, eventId: string, input: SaveProgramItemsInput): Promise<ProgramItem[]> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
  const itemIds = input.updates.map((update) => update.itemId);
  if (input.updates.length + input.additions.length > PROGRAM_BATCH_MAX_LINES) throw new RangeError("trop de lignes en un envoi");
  if (new Set(itemIds).size !== itemIds.length || !itemIds.every((itemId) => UUID_PATTERN.test(itemId))) throw new ProgramItemNotFoundError();
  const entryOf = (item: ProgramItemInput, line: ProgramBatchLineError["line"]) => {
    try {
      return { data: normalizeProgramItem(item), vendorSlotIds: item.vendorSlotIds, freeLabels: cleanLabels(item.freeParticipants) };
    } catch (error) {
      throw new ProgramBatchLineError(line, error);
    }
  };
  const updates = input.updates.map(({ itemId, item }) => ({ itemId, ...entryOf(item, { kind: "update", itemId }) }));
  const additions = input.additions.map((item, index) => entryOf(item, { kind: "addition", index }));
  if (updates.length + additions.length === 0) return [];
  const result = await saveProgramItemRows(organizationId, eventId, updates, additions, await mainMomentName(organizationId));
  switch (result.status) {
    case "saved":
      return sortProgramItems(result.items.map(toProgramItem));
    case "event_not_found":
      throw new EventNotFoundError();
    case "item_not_found":
      throw new ProgramItemNotFoundError();
    case "participant_not_found":
      throw new ProgramParticipantNotFoundError();
    case "moment_not_found":
      throw new KeyMomentNotFoundError();
  }
}

export async function removeProgramItem(organizationId: string, itemId: string): Promise<void> {
  await deleteProgramItem(organizationId, itemId);
}

// Lot 30b (CHR-06, décision D8) : décale des séquences de l'événement, début et fin ;
// sert aussi à annuler (décalage opposé). Tout ou rien.
export async function shiftProgramItems(organizationId: string, eventId: string, itemIds: string[], minutes: number): Promise<ProgramItem[]> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(organizationId, eventId);
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
    momentName: row.momentName,
    dayOffset: row.dayOffset,
  };
}

function toProgramTemplate(template: ProgramTemplateRow, items: ProgramTemplateItemRow[]): ProgramTemplate {
  return { id: template.id, name: template.name, items: sortProgramItems(items.map(toProgramTemplateItem)) };
}

function normalizeProgramTemplateItem(item: ProgramTemplateItemInput) {
  // Un modèle n'a pas de note interne : elle est propre à chaque événement.
  const { startTime, endTime, label, location } = normalizeProgramItem({ ...item, vendorSlotIds: [], freeParticipants: [] });
  // Lot 51 (CHR-08, EVT-04) : temps fort nommé (100 caractères) et jour (de la veille à J+6).
  const momentName = optionalText(item.momentName)?.replace(/\s+/g, " ") ?? null;
  const dayOffset = item.dayOffset ?? 0;
  if ((momentName !== null && momentName.length > 100) || !Number.isInteger(dayOffset) || dayOffset < -3 || dayOffset > 6) throw new ProgramItemInvalidError("moment");
  return { startTime, endTime, label, location, participantLabels: cleanLabels(item.participantLabels), momentName, dayOffset };
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
  const result = await applyProgramTemplateRows(organizationId, eventId, templateId, await mainMomentName(organizationId));
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
  constructor(readonly reason: "name" | "email" | "expiry" | "client" | "slot" | "audience" | "vendor" | "phone" | "date") {
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
// Lot 52 (EVT-06, D3) : le lien d'un renfort du jour J ne vaut qu'à partir du matin de la veille de son
// évènement daté (heure de Paris), jusqu'à la fin du lendemain.
function usableLink(context: LinkWithContext, now: Date): boolean {
  if (context.link.revokedAt || isLinkExpired(expiresOnOf(context), now) || context.event.status === "cancelled" || context.event.isDemo) return false;
  if (context.link.audience !== "day_helper") return true;
  return context.event.eventDate !== null && now.getTime() >= dayHelperValidFrom(context.event.eventDate).getTime();
}

// Premier instant où le lien d'un renfort vaut : minuit (Paris) du jour qui précède l'évènement.
export function dayHelperValidFrom(eventDate: string): Date {
  return parisStartOfDay(addDays(eventDate, -starterLinkExpiry().dayHelperDaysBefore));
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
  if (audience === "day_helper") return "day_helper_link";
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
    // Lot 53 (HUB-24, D8) : {{terme_clients}}, le terme réglé pour le type de l'évènement.
    client_term: (await clientTermOf(input.organizationId, input.eventId, input.locale, input.vocabulary)).term,
    ...(input.url ? { link: input.url } : {}),
  };
}

export async function createEventLink(input: CreateEventLinkInput): Promise<EventLinkDelivery> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(input.organizationId, input.eventId);
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

// Les liens du portail et des prestataires ; les renforts du jour J ont leur liste (listDayHelpers).
export async function listEventLinks(organizationId: string, eventId: string): Promise<EventLink[]> {
  const now = new Date();
  return (await findEventLinkRows(organizationId, eventId)).filter((context) => context.link.audience !== "day_helper").map((context) => toEventLink(context, now));
}

export async function updateEventLink(organizationId: string, linkId: string, input: EventLinkInput): Promise<EventLink> {
  const current = await findLinkRow(organizationId, linkId);
  if (!current || current.link.audience === "day_helper") throw new EventLinkNotFoundError();
  const result = await updateLinkRow(organizationId, linkId, validLinkFields(input));
  if (result.status !== "saved") throw linkWriteError(result.status);
  return toEventLink(result.context);
}

// Renouveler : nouveau jeton, l'ancien cesse aussitôt. Un lien expiré est
// prolongé du délai de son public à partir d'aujourd'hui (la planner peut
// choisir une autre date en modifiant le lien).
export async function renewEventLink(input: RenewEventLinkInput): Promise<EventLinkDelivery> {
  const current = await findLinkRow(input.organizationId, input.linkId);
  // Lot 52 : un renfort du jour J reçoit un nouveau lien en étant ajouté de nouveau.
  if (!current || current.link.revokedAt || current.link.audience === "day_helper") throw new EventLinkNotFoundError();
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

// —— Lot 52 (EVT-06 ; D2, D3 ; ADR 0094) : équipe de l'évènement et renfort du jour J ——————————————————

export class EventTeamMemberInvalidError extends Error {
  constructor() {
    super("membre de l'équipe invalide");
    this.name = "EventTeamMemberInvalidError";
  }
}

export async function listEventTeam(organizationId: string, eventId: string): Promise<EventTeamMember[]> {
  return findEventTeam(organizationId, eventId);
}

// Planner principal ou assistant : une personne active de l'équipe de l'organisation (Propriétaire ou
// Planner ; jamais le Comptable).
export async function setEventTeamMember(input: { organizationId: string; eventId: string; userId: string; role: EventTeamRole; byUserId: string }): Promise<void> {
  if (!EVENT_TEAM_ROLES.includes(input.role)) throw new EventTeamMemberInvalidError();
  const team = await listTeam(appDatabase(), input.organizationId);
  const member = team.find((entry) => entry.id === input.userId && !entry.disabledAt);
  if (!member || (member.role !== "owner" && member.role !== "member")) throw new EventTeamMemberInvalidError();
  if ((await upsertEventTeamMember(input)) === "not_found") throw new EventNotFoundError();
}

export async function removeEventTeamMember(input: { organizationId: string; eventId: string; userId: string; byUserId: string }): Promise<boolean> {
  return deleteEventTeamMember(input);
}

export async function makeCreatorLead(organizationId: string, eventId: string, userId: string): Promise<void> {
  await insertLeadIfNone(organizationId, eventId, userId);
}

// HUB-04 : un membre retiré de l'organisation n'est plus dans aucune équipe d'évènement.
export async function removeMemberFromEvents(organizationId: string, userId: string): Promise<number> {
  return deleteMemberFromAllTeams(organizationId, userId);
}

export async function eventTeamRole(organizationId: string, eventId: string, userId: string): Promise<EventTeamRole | null> {
  return findTeamRole(organizationId, eventId, userId);
}

// Lot 53 : le planner principal de chaque évènement, pour lui adresser ses alertes.
export async function listEventLeads(organizationId: string, eventIds: string[]): Promise<Map<string, string>> {
  return findEventLeads(organizationId, eventIds);
}

// D2 : les évènements visibles d'une personne de l'équipe ; null = tous.
export async function visibleEventIds(organizationId: string, viewer: EventViewer): Promise<Set<string> | null> {
  return seesAllEvents(viewer) ? null : findTeamEventIds(organizationId, viewer.userId);
}

export async function canViewEvent(organizationId: string, viewer: EventViewer, eventId: string): Promise<boolean> {
  if (seesAllEvents(viewer)) return true;
  return (await findTeamRole(organizationId, eventId, viewer.userId)) !== null;
}

const PHONE_PATTERN = /^[0-9+()./\s-]{6,40}$/;

function validDayHelper(input: DayHelperInput): LinkFields {
  const personName = input.personName.trim().slice(0, PERSON_NAME_MAX);
  if (!personName) throw new EventLinkInvalidError("name");
  const email = input.email.trim();
  if (!emailSchema.safeParse(email).success) throw new EventLinkInvalidError("email");
  const phone = input.phone?.trim() || null;
  if (phone && !PHONE_PATTERN.test(phone)) throw new EventLinkInvalidError("phone");
  return { personName, email, phone, eventClientId: null, rights: { rubrics: [], budgetScope: "all", sharedSlotIds: [] }, customExpiresOn: null, otpRequired: true, taskReminders: false };
}

function toDayHelper(context: LinkWithContext, now: Date): DayHelper {
  const expiresOn = expiresOnOf(context);
  return {
    linkId: context.link.id,
    personName: context.link.personName,
    email: context.link.email,
    phone: context.link.phone,
    validFrom: context.event.eventDate ? dayHelperValidFrom(context.event.eventDate).toISOString() : "",
    expiresOn,
    status: linkStatus({ revokedAt: context.link.revokedAt, expiresOn }, now),
    lastOpenedAt: context.link.lastOpenedAt?.toISOString() ?? null,
  };
}

export async function listDayHelpers(organizationId: string, eventId: string, now: Date = new Date()): Promise<DayHelper[]> {
  return (await findEventLinkRows(organizationId, eventId)).filter((context) => context.link.audience === "day_helper").map((context) => toDayHelper(context, now));
}

// D3 : le renfort reçoit par e-mail son lien personnel, valable de la veille au lendemain de
// l'évènement daté ; il demande un code à l'ouverture. Un évènement sans date ou d'essai n'en a pas.
export async function createDayHelper(input: { organizationId: string; eventId: string; helper: DayHelperInput; locale: "fr" | "en"; byUserId: string }): Promise<{ helper: DayHelper; url: string }> {
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(input.organizationId, input.eventId);
  const fields = validDayHelper(input.helper);
  const found = await findEventById(input.organizationId, input.eventId);
  if (!found) throw new EventNotFoundError();
  if (found.event.isDemo) throw new DemoEventRestrictionError();
  if (!found.event.eventDate) throw new EventLinkInvalidError("date");
  const vocabulary = (await findEventAudience(input.organizationId, input.eventId)) ?? "couple";
  const base = { organizationId: input.organizationId, eventId: input.eventId, audience: "day_helper" as const, personName: fields.personName, locale: input.locale, vocabulary };
  const validFrom = formatCalendarDate(addDays(found.event.eventDate, -starterLinkExpiry().dayHelperDaysBefore), input.locale);
  await assertOrganizationEmailReady({ organizationId: input.organizationId, kind: "day_helper_link", locale: input.locale, values: { ...(await linkEmailValues({ ...base, expiresOn: null })), valid_from: validFrom } });
  await reserveOrganizationMail(input.organizationId);
  const secret = newLinkSecret();
  const result = await insertLinkRow({ ...fields, organizationId: input.organizationId, eventId: input.eventId, audience: "day_helper", vendorCandidateId: null, locale: input.locale, tokenHash: hashLinkSecret(secret) });
  if (result.status !== "saved") throw linkWriteError(result.status);
  const helper = toDayHelper(result.context, new Date());
  const url = linkUrl(formatLinkToken(input.organizationId, secret));
  await sendOrganizationEmail({
    organizationId: input.organizationId,
    to: helper.email,
    kind: "day_helper_link",
    locale: input.locale,
    values: { ...(await linkEmailValues({ ...base, expiresOn: helper.expiresOn, url })), valid_from: validFrom },
    reserve: false,
  });
  return { helper, url };
}

// Retirer le renfort : son lien et ses sessions cessent aussitôt ; ses actions en file sont refusées.
export async function revokeDayHelper(organizationId: string, eventId: string, linkId: string): Promise<boolean> {
  const current = await findLinkRow(organizationId, linkId);
  if (!current || current.link.audience !== "day_helper" || current.link.eventId !== eventId) return false;
  await revokeLinkRow(organizationId, linkId);
  return true;
}

// L'accès d'un renfort au mode Jour J d'un évènement : sa session de lien, son évènement, ses dates.
// Toute autre combinaison répond null, comme une page inexistante (SEC-13).
export async function dayHelperAccess(sessionToken: string | undefined, eventId: string, now: Date = new Date()): Promise<LinkAccess | null> {
  if (!sessionToken) return null;
  const access = await resolveLinkSession(sessionToken, now);
  if (!access || access.audience !== "day_helper" || access.eventId !== eventId) return null;
  return access;
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
  if (!parsed || (await organizationLinksClosed(parsed.organizationId))) return null;
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
    eventId: context.link.eventId,
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

// Lot 43 (SEC-16 ; D4 ; avenant de l'ADR 0053, ADR 0089) — code à usage unique avant une action
// sensible depuis un lien déjà ouvert (signer) : les mêmes codes que l'ouverture (six chiffres, dix
// minutes, cinq essais, un seul usage, cinq codes par heure), envoyés à l'e-mail du lien, sans ouvrir
// de nouvelle session. Le lien est relu : retiré, expiré ou d'un évènement perdu, rien ne part.
export type LinkActionCodeResult = { sent: boolean; emailHint: string };
export type LinkActionCodeCheck = { outcome: "accepted" } | { outcome: "wrong_code"; attemptsLeft: number } | { outcome: "code_expired" } | { outcome: "invalid" };

export async function sendLinkActionCode(organizationId: string, linkId: string, now: Date = new Date(), locale: "fr" | "en" = "fr"): Promise<LinkActionCodeResult> {
  const context = await findLinkRow(organizationId, linkId);
  if (!context || !usableLink(context, now)) return { sent: false, emailHint: "•••" };
  const { link } = context;
  const emailHint = maskEmail(link.email);
  try {
    await reserveOrganizationMail(organizationId);
  } catch (error) {
    if (error instanceof MailQuotaExceededError) return { sent: false, emailHint };
    throw error;
  }
  const code = newLinkCode();
  const issued = await withActor({ kind: "link", id: link.id }, () =>
    issueLinkCodeRow({ organizationId, linkId: link.id, eventId: link.eventId, codeHash: hashLinkCode(link.id, code), expiresAt: linkCodeExpiresAt(now), now, maxPerHour: LINK_CODES_PER_HOUR }),
  );
  if (issued === "throttled") return { sent: false, emailHint };
  const t = emailTranslator(locale);
  await sendSymbolaEmail({ to: link.email, locale, subject: t("fixed.actionCode.subject", { code }), body: t("fixed.actionCode.body", { name: link.personName, code, minutes: Math.round(LINK_CODE_TTL_MS / 60_000) }), organizationId });
  return { sent: true, emailHint };
}

export async function verifyLinkActionCode(organizationId: string, linkId: string, code: string, now: Date = new Date()): Promise<LinkActionCodeCheck> {
  const context = await findLinkRow(organizationId, linkId);
  if (!context || !usableLink(context, now)) return { outcome: "invalid" };
  const typed = normalizeLinkCode(code);
  const attempt = await withActor({ kind: "link", id: linkId }, () =>
    attemptLinkCodeRow({ organizationId, linkId, eventId: context.link.eventId, codeHash: hashLinkCode(linkId, typed ?? ""), now }),
  );
  if (attempt.status === "expired") return { outcome: "code_expired" };
  if (attempt.status === "wrong") return attempt.attemptsLeft > 0 ? { outcome: "wrong_code", attemptsLeft: attempt.attemptsLeft } : { outcome: "code_expired" };
  return { outcome: "accepted" };
}

// Décision D7 : à chaque requête, la session et son lien sont relus ; une
// session expirée, ou d'un lien qui ne vaut plus, est supprimée.
export async function resolveLinkSession(sessionToken: string, now: Date = new Date()): Promise<LinkAccess | null> {
  const parsed = parseLinkToken(sessionToken);
  if (!parsed || (await organizationLinksClosed(parsed.organizationId))) return null;
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
  const [places, published] = await Promise.all([listEventPlaces(organizationId, access.eventId), linkPublishedProgram(organizationId, linkId, access.eventId, "vendor")]);
  const dayShift = await latestVendorDayShift(organizationId, access.eventId, vendor.vendorSlotId);
  const program: VendorProgramView = {
    version: published.version ? { number: published.version.number, publishedAt: published.version.publishedAt } : null,
    ...vendorProgramOf(published.version?.items ?? [], vendor.vendorSlotId),
    isNew: published.isNew,
    // Présent seulement quand un décalage du jour J concerne la version affichée.
    ...(dayShift && published.version && dayShift.programVersion === published.version.number ? { dayShift: { minutes: dayShift.minutes, validatedAt: dayShift.validatedAt } } : {}),
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
export { TaskCategoryInvalidError, TaskCategoryNotFoundError, TASK_CATEGORY_LABEL_MAX, TASK_CATEGORY_MAX } from "./task-categories";
export { BulkTaskChangeInvalidError, BULK_SHIFT_MAX_DAYS, BULK_TASKS_MAX } from "./task-bulk";

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
    // Lot 70a (§ 3.4) : ni note interne ni personne de l'agence dans un lien.
    tasks: tasks ? tasks.map(toLinkTask) : null,
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
  return toLinkTask(toEventTask(result.task));
}

export async function getLinkNamesByIds(organizationId: string, linkIds: string[]): Promise<Record<string, string>> {
  return findLinkNameRows(organizationId, linkIds);
}

// Lot 27a (CHR-04, décision D7) — rappels des tâches confiées au client, pour
// une organisation : appelé par la tâche horaire de l'app. Un e-mail par
// personne et par jour, regroupant les tâches qui atteignent un seuil (sept
// jours avant, la veille, le lendemain d'un retard), jamais deux fois le même
// rappel ; liens valables seulement ; plafond d'envois de l'organisation.
// Lot 53 (HUB-28, D5) : hooks.notBefore — un rappel dont le palier a commencé avant la remise en route ne
// part pas ; hooks.onRun, la trace de chaque rappel envoyé.
export async function sendClientTaskReminders(organizationId: string, now: Date = new Date(), hooks: AutomationHooks = {}): Promise<number> {
  const policy = starterClientTaskReminders();
  // Lot 66a (D1) : à l'heure d'envoi de l'automatisme (heure de Paris : un rappel regroupe les tâches).
  if (!sendTimeReached(hooks.isSendTime, now)) return 0;
  const today = parisToday(now);
  const candidates = await findReminderCandidateRows(
    organizationId,
    addDays(today, -policy.overdue.within),
    addDays(today, policy.daysBefore.week),
    parisStartOfDay(today),
  );
  let sent = 0;
  // Lot 65d (décision 2 du 22/11 ; ADR 0110) : quand la planner envoie de sa messagerie, le rappel est
  // déposé « À envoyer » ; Symbola n'envoie rien.
  const prepared = await preparesRelationEmail(organizationId, "task_reminder");
  for (const candidate of candidates) {
    if (candidate.sentToday || !usableLink(candidate.context, now)) continue;
    const due: (ReminderTask & { taskId: string })[] = candidate.tasks.flatMap((task) => {
      const threshold = reminderThreshold(task.dueDate, today, policy);
      if (threshold && hooks.notBefore && reminderThresholdStart(task.dueDate, threshold, policy) < hooks.notBefore) return [];
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
    if (prepared) {
      const recorded = await withActor(SYSTEM_ACTOR, () =>
        insertTaskRemindersRow({ organizationId, eventId: link.eventId, linkId: link.id, reminders: due.map(({ taskId, threshold }) => ({ taskId, threshold })), now }),
      );
      if (recorded === 0) continue;
      await depositPreparedEmail({ organizationId, kind: "task_reminder", eventId: link.eventId, recipientType: "event_link", recipientId: link.id, origin: "automation", automationKey: "client_task_reminder", sourceKey: `task-reminder:${link.id}:${today}` });
      sent += 1;
      await hooks.onRun?.({ objectKey: link.id, href: `/events/${link.eventId}?onglet=taches`, result: "sent" });
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
    await hooks.onRun?.({ objectKey: link.id, href: `/events/${link.eventId}?onglet=taches`, result: "sent" });
  }
  return sent;
}

// Lot 27b (POR-03, BUD-07, EVT-09 ; décisions D9 et D10) — décisions demandées
// au client. La planner les demande (contenu figé), le client y répond depuis
// son portail (première réponse), la décision répondue ne se modifie plus : une
// nouvelle la remplace. Une décision n'engage rien d'elle-même (D9), sauf depuis
// le lot 47 (D6, ADR 0085) le choix d'une décision « options », qui engage.

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
    engagedAt: row.engagedAt?.toISOString() ?? null,
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
  // Lot 58 (PAR-09, étape 5) : un évènement archivé est en lecture seule.
  await assertEventWritableRow(input.organizationId, input.eventId);
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
    subject = { subjectId: null, slotId: null, title: "", snapshot: { kind: "program", programUpdatedAt: program.updatedAt, itemCount: clientProgramItems(version.items).length, programVersion: version.number } };
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
  // Lot 55 (POR-11) : les clients qui voient la décision et ont activé le push en sont prévenus.
  await pushDecisionToClients(organizationId, eventId, input.kind).catch((error: unknown) => console.error("push « décision demandée » non envoyé", error instanceof Error ? error.name : "erreur"));
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
    // Lot 73a (P5, P6) : depuis le jour où il a été retenu, plus depuis sa dernière modification ; rien
    // pour un prestataire retenu avant ce lot.
    since: candidate.retainedAt ? parisToday(candidate.retainedAt) : null,
  }));
}

// D6 : la relance d'un prestataire s'inscrit dans l'activité de l'évènement ; le message part de la
// messagerie de la planner (l'appelant), Symbola n'envoie rien. Lot 33b (HUB-10) : jamais depuis un
// évènement fictif, même vers un prestataire réel du carnet ajouté à l'exemple.
// Lot 65d (PRE-02, HUB-08 ; M16) : « Noter une relance » — la planner déclare comment et quand elle a
// relancé (téléphone, e-mail, SMS, de vive voix), et quand y revenir ; sans moyen précisé, un e-mail
// le jour même (geste du lot 32a). Le rappel vient après la relance ; la note va aux notes internes.
export type VendorReminderChannel = "phone" | "email" | "sms" | "in_person";
export const VENDOR_REMINDER_CHANNEL_KEYS: readonly VendorReminderChannel[] = ["phone", "email", "sms", "in_person"];

export async function recordVendorReminder(input: {
  organizationId: string;
  eventId: string;
  candidateId: string;
  userId: string;
  channel?: VendorReminderChannel;
  remindedOn?: string;
  recallOn?: string | null;
  note?: string | null;
  today?: string;
}): Promise<{ reminderId: string; vendorName: string; vendorId: string | null; slotLabel: string }> {
  const today = input.today ?? parisToday(new Date());
  const remindedOn = input.remindedOn ?? today;
  assertDate(remindedOn);
  if (remindedOn > today) throw new RangeError("une relance notée est passée ou du jour");
  const recallOn = input.recallOn ?? null;
  if (recallOn !== null) {
    assertDate(recallOn);
    if (recallOn < remindedOn) throw new RangeError("le rappel vient après la relance");
  }
  const channel = input.channel ?? "email";
  if (!VENDOR_REMINDER_CHANNEL_KEYS.includes(channel)) throw new RangeError("moyen de relance inconnu");
  const note = input.note?.trim() ? input.note.trim().slice(0, 2000) : null;
  const found = await findEventById(input.organizationId, input.eventId);
  if (!found) throw new CandidateNotFoundError();
  if (found.event.isDemo) throw new DemoEventRestrictionError();
  const recorded = await insertVendorReminder({ organizationId: input.organizationId, eventId: input.eventId, candidateId: input.candidateId, userId: input.userId, channel, remindedOn, recallOn, note });
  if (!recorded) throw new CandidateNotFoundError();
  return recorded;
}

// Lot 65d (M16) : la dernière relance notée de chaque prestataire de l'évènement.
export async function listLastVendorReminders(organizationId: string, eventId: string): Promise<Map<string, { remindedOn: string; channel: VendorReminderChannel; recallOn: string | null }>> {
  return (await findLastVendorReminders(organizationId, eventId)) as Map<string, { remindedOn: string; channel: VendorReminderChannel; recallOn: string | null }>;
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
  // Lot 47 (PAR-05, PRE-09 ; D6, ADR 0085) : le choix d'une option engage (Retenu, autres Écartés,
  // tâches de suivi), dans la même transaction que la réponse ; la planner modifie ensuite le prestataire
  // retenu quand elle veut. Remplace, pour les décisions « options » seulement, la règle D9 du lot 28.
  const now = new Date();
  const engaging = row.kind === "option" && input.answer === "approved" && choiceId !== null ? await engagementContext(input.organizationId, row, access.linkId) : null;
  const answered = await withActor({ kind: "link", id: access.linkId }, () =>
    answerDecisionRow({
      organizationId: input.organizationId,
      decisionId: row.id,
      status: input.answer,
      choiceId,
      comment,
      linkId: access.linkId,
      personName: access.personName,
      now,
      engage: engaging && choiceId ? (tx, answeredRow) => engageOptionChoice(tx, { organizationId: input.organizationId, decision: answeredRow, choiceId, linkId: access.linkId, now, ...engaging }) : undefined,
    }),
  );
  if (!answered) throw new DecisionInvalidError("answered");
  const [decision] = await decisionsWithContext(input.organizationId, access.eventId, [answered], await findDecisionRows(input.organizationId, access.eventId));
  // Lot 53 (HUB-15, UX-16) : « Décision du client » mène à l'onglet des clients de l'évènement.
  const found = await findEventById(input.organizationId, access.eventId);
  await notify({ organizationId: input.organizationId, type: "client_decision", eventId: access.eventId, objectKey: row.id, params: { title: decision!.title.slice(0, 200) }, href: `/events/${access.eventId}?onglet=maries`, eventDate: found?.event.eventDate ?? null, isDemo: found?.event.isDemo ?? false, now }).catch((error: unknown) => {
    console.error(`notification de la décision non créée (décision ${row.id})`, error instanceof Error ? error.name : "inconnue");
  });
  return decision!;
}

// Décision D3 : profils de départ d'un lien (ils pré-cochent les rubriques).
export function listLinkProfiles(locale: "fr" | "en", vocabulary: EventTypeAudience): StarterLinkProfile[] {
  return starterLinkProfiles(locale, vocabulary === "clients" ? "clients" : "couple");
}

// Décision D5 : demandes de nouveau lien en attente, pour « Aujourd'hui ».
// Lot 73d (PRE-05 ; spécification du lot 73, § 7) : une demande de pièce se dépose sur le lien du
// prestataire ; sans lien ouvert sur aucun de ses mariages, la fenêtre le dit au lieu de laisser croire
// qu'il est prévenu.
export async function vendorHasOpenLink(organizationId: string, vendorId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(vendorId)) return false;
  return hasOpenVendorLinkRow(organizationId, vendorId);
}

export async function listPendingLinkRenewals(organizationId: string): Promise<{ linkId: string; eventId: string; personName: string; requestedAt: string }[]> {
  return (await findPendingRenewalRows(organizationId)).map((row) => ({ ...row, requestedAt: row.requestedAt.toISOString() }));
}

// Lot 13 (L13-EVT-19) — date (calendrier de Paris) du dernier passage dans
// chaque statut : la frise de la fiche affiche la date de chaque étape.
// Lot 72a (J2, migration 0224) : la date effective d'abord (« Signé le »), sinon le jour du changement
// dans le fuseau de l'évènement.
export async function getEventStatusDates(organizationId: string, eventId: string): Promise<EventStatusDates> {
  const dates: EventStatusDates = {};
  const timeZone = (await readEvent(organizationId, eventId))?.event.timeZone ?? "Europe/Paris";
  for (const change of await findEventStatusChanges(organizationId, eventId)) dates[change.toStatus] = change.effectiveOn ?? dateInTimeZone(change.changedAt, timeZone);
  return dates;
}

// Lot 71f (C-64) : « Signé le » d'un évènement confirmé : la date de son passage à Confirmé, ou « non
// renseigné » quand la reprise ne la connaissait pas (`date_known = false`) ; null s'il n'est pas confirmé.
export async function getEventSignedOn(organizationId: string, eventId: string): Promise<{ known: true; on: string } | { known: false } | null> {
  const timeZone = (await readEvent(organizationId, eventId))?.event.timeZone ?? "Europe/Paris";
  const confirmed = (await findEventStatusChanges(organizationId, eventId)).filter((change) => change.toStatus === "confirmed").at(-1);
  if (!confirmed) return null;
  return confirmed.dateKnown ? { known: true, on: confirmed.effectiveOn ?? dateInTimeZone(confirmed.changedAt, timeZone) } : { known: false };
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
  unchangedImportedEventFields,
} from "./import";

const _contractCheck: EventsServiceContract = {
  listAgencyOverview,
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
  countWorkedWithByVendor,
  getLinkVendorOptions,
  getLinkVendorQuoteFile,
  getLinkSharedRibVendorId,
  listEvents,
  listStaleProspects,
  getEvent,
  createProspect,
  changeEventStatus,
  markContractSigned,
  taskProgressByEvent,
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
  changeEventTasks,
  removeEventTasks,
  restoreEventTasksDeletedWith,
  listTaskCategories,
  addStarterTaskCategories,
  createTaskCategory,
  updateTaskCategory,
  moveTaskCategory,
  removeTaskCategory,
  countTasksByCategory,
  getEventProgram,
  publishEventProgram,
  getEventProgramPublication,
  getEventProgramVersion,
  markLinkProgramSeen,
  listProgramRecipients,
  notifyProgramVersion,
  listCalendarEvents,
  getBusySettings,
  setBusySettings,
  listEventTypeBusyRules,
  setEventTypeBusyRule,
  getEventBusy,
  setEventBusyRule,
  listBusyRanges,
  listEventBusyRanges,
  addProgramItem,
  updateProgramItem,
  removeProgramItem,
  saveProgramItems,
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
export { describeEventsExport, EVENTS_EXPORT_EXCLUSIONS, exportEventsData, eraseEventsData, importEventsData, listDemoEventIds, registerEventsImportIds } from "./export";

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
  return (await readEvents(organizationId, {}))
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
        // Lot 70a (A5) : un lot de tâches se dit par son évènement (« 3 tâches de Léa & Maxime »).
        const named = row.kind === "event" || (row.kind === "task" && row.count !== undefined && row.eventId !== null);
        const event = named ? await getEvent(organizationId, row.kind === "event" ? row.id : row.eventId!) : null;
        const label = named ? (event ? eventNames(event.clients, event.name) : "") : (row.label ?? "");
        return { kind: row.kind, id: row.id, label, eventId: row.eventId, deletedAt: row.deletedAt, deletedBy: row.deletedBy, ...(row.count !== undefined ? { count: row.count } : {}) };
      }),
    ),
  );
}

// Le libellé d'un évènement de la corbeille (bandeau « Annuler », confirmations).
export async function getTrashedEventLabel(organizationId: string, eventId: string): Promise<string | null> {
  const event = await includingDeleted(() => getEvent(organizationId, eventId));
  return event ? eventNames(event.clients, event.name) : null;
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
  return getPipelineOf(organizationId, locale, new Map(options.map((event) => [event.id, eventNames(event.clients, event.name)])));
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

// —— Lot 51 (EVT-04, CHR-08, JRJ-05 à JRJ-09, ARC-09, PAR-08 ; D1 à D8, ADR 0091) : jour J de terrain ——

export { DayChecklistInvalidError, DayChecklistNotFoundError } from "./day-checklists";
export {
  addDayChecklistItem,
  createDayChecklist,
  listDayChecklistTemplates,
  removeDayChecklist,
  removeDayChecklistItem,
  removeDayChecklistTemplate,
  saveDayChecklistTemplate,
} from "./day-checklists";
export { deviceInstant } from "./day-of";

// Réglages de départ du jour J (seuil de retard, photos, rafraîchissement), dans une langue.
export function dayOfSettings(locale: "fr" | "en") {
  return starterDayOfSettings(locale);
}

// CHR-08 : aperçu, puis écriture, d'un chrono importé d'un tableur ou (lot 63b) du PDF de programme
// de l'ancien logiciel, avec le poste choisi pour chacun de ses intervenants.
export async function importEventProgram(input: {
  organizationId: string;
  eventId: string;
  bytes: Uint8Array;
  apply: { skipLines: number[] } | null;
  speakerSlots?: Record<number, string | null>;
  catalogVendors?: { id: string; name: string; city: string | null }[];
}): Promise<ProgramImportResult> {
  // Lot 67d (EVT-04) : la veille et le lendemain portent leur nom, plus celui du jour J.
  const dayOf = starterDayOfSettings(await getOrganizationLanguage(appDatabase(), input.organizationId));
  const result = await importProgram({ ...input, mainMomentName: dayOf.mainMomentName, eveMomentName: dayOf.eveMomentName, nextDayMomentName: dayOf.nextDayMomentName });
  if (!result) throw new EventNotFoundError();
  return result;
}

// JRJ-08 : l'état partagé du jour J (pointages, première heure retenue, décalages, incidents, listes),
// avec le nom affiché (l'adresse du compte) des membres cités.
// Lot 52 (EVT-06, D3) : les auteurs sont les comptes de l'équipe et les renforts du jour J (nommés
// « Hugo, renfort ») ; vu par un renfort, un compte de l'équipe n'est pas nommé (son adresse ne sort
// pas de l'équipe).
export async function getDayState(organizationId: string, eventId: string, options: { forHelper?: boolean } = {}): Promise<DayState | null> {
  const records = await findDayRecords(organizationId, eventId);
  if (!records) return null;
  const cited = new Set<string>([
    ...records.checkpoints.map((checkpoint) => checkpoint.userId),
    ...records.shifts.map((shift) => shift.validatedBy),
    ...records.incidents.map((incident) => incident.userId),
    ...records.checklists.flatMap((list) => list.items.flatMap((item) => (item.checkedBy ? [item.checkedBy] : []))),
  ]);
  const team = cited.size > 0 ? await listTeam(appDatabase(), organizationId) : [];
  const helpers = cited.size > 0 ? (await findEventLinkRows(organizationId, eventId)).filter((context) => context.link.audience === "day_helper") : [];
  return {
    eventId,
    checkpoints: records.checkpoints,
    actuals: actualsOf(records),
    shifts: records.shifts,
    incidents: records.incidents,
    checklists: records.checklists,
    people: [
      ...team.filter((member) => cited.has(member.id)).map((member) => ({ id: member.id, name: options.forHelper ? "" : member.email })),
      ...helpers.filter((helper) => cited.has(helper.link.id)).map((helper) => ({ id: helper.link.id, name: helper.link.personName, helper: true })),
    ],
  };
}

export type DayEventAction = Exclude<DayAction, { kind: "handover" }>;

// Une action de la file (hors remise, tenue par le module budget). Un décalage appliqué diffuse une
// nouvelle version du programme (CHR-07) et prévient les prestataires concernés, une seule fois.
export async function applyDayAction(input: {
  organizationId: string;
  eventId: string;
  userId: string | null;
  // Lot 52 (EVT-06, D3) : l'action vient du lien d'un renfort du jour J.
  linkId?: string | null;
  action: DayEventAction;
  renderDocument: NotifyProgramVersionInput["renderDocument"];
  now?: Date;
}): Promise<DayActionResult> {
  const base = { organizationId: input.organizationId, eventId: input.eventId, userId: input.userId, linkId: input.linkId ?? null, now: input.now ?? new Date() };
  // D3 : un renfort pointe, coche, note et photographie ; il ne valide pas de décalage du programme.
  if (input.linkId && input.action.kind === "shift") return { status: "rejected", reason: "scope" };
  switch (input.action.kind) {
    case "checkpoint":
      return recordDayCheckpoint({ ...base, action: input.action });
    case "incident":
      return recordDayIncident({
        ...base,
        action: input.action,
        // Lot 53 (HUB-15 ; D2, D3) : « Alerte du jour J » aux destinataires, sauf à qui l'a notée.
        notify: async (incident) => {
          // Noté par le planner principal lui-même : la Propriétaire est prévenue.
          let userIds = (await notificationRecipients(input.organizationId, input.eventId)).filter((userId) => userId !== input.userId);
          if (userIds.length === 0) userIds = (await notificationRecipients(input.organizationId)).filter((userId) => userId !== input.userId);
          await notify({ organizationId: input.organizationId, type: "day_of_alert", eventId: input.eventId, objectKey: incident.incidentId, href: `/jour-j/${input.eventId}`, eventDate: incident.eventDate, isDemo: incident.isDemo, userIds, ...(input.now ? { now: input.now } : {}) });
        },
      });
    case "check":
      return recordDayCheck({ ...base, action: input.action });
    case "shift": {
      if (!input.userId) return { status: "rejected", reason: "scope" };
      const recorded = await recordDayShift({ ...base, userId: input.userId, action: input.action });
      if (recorded.status === "applied" && recorded.shiftId) {
        await recordAudit(appDatabase(), { organizationId: input.organizationId, action: "events.day_shift.applied", objectId: input.eventId, details: { minutes: input.action.minutes, items: input.action.itemIds.length } });
        await publishAndNotifyDayShift({ organizationId: input.organizationId, eventId: input.eventId, shiftId: recorded.shiftId, userId: input.userId!, renderDocument: input.renderDocument, now: input.now ?? new Date() });
      }
      return { status: recorded.status, ...(recorded.reason ? { reason: recorded.reason } : {}) };
    }
  }
}

// D3 : après validation, une nouvelle version du programme est diffusée, puis chaque prestataire
// concerné (lien actif d'un poste des séquences décalées, retenu par la planner) reçoit un e-mail avec
// le programme de son poste à jour. Réservé avant l'envoi : un rejeu ne renvoie rien ; la clé de chaque
// e-mail le dédoublonne aussi dans la file des tâches. Un évènement d'essai n'envoie rien.
export async function publishAndNotifyDayShift(input: {
  organizationId: string;
  eventId: string;
  shiftId: string;
  userId: string;
  renderDocument: NotifyProgramVersionInput["renderDocument"];
  now: Date;
}): Promise<{ sent: number; notSent: number }> {
  const { organizationId, eventId } = input;
  const program = await getEventProgram(organizationId, eventId);
  const published = await insertProgramVersion({ organizationId, eventId, userId: input.userId, items: publishedProgramItems(program.items), now: input.now });
  const version = published.status === "published" ? published.version.number : ((await findLatestProgramVersion(organizationId, eventId))?.number ?? null);
  if (version !== null) await setDayShiftVersion(organizationId, input.shiftId, version);
  const found = await findEventById(organizationId, eventId);
  if (!found || found.event.isDemo) return { sent: 0, notSent: 0 };
  const shift = await claimDayShiftNotification(organizationId, input.shiftId, input.now);
  if (!shift) return { sent: 0, notSent: 0 };
  const latest = await findLatestProgramVersion(organizationId, eventId);
  if (!latest) return { sent: 0, notSent: 0 };
  const slots = new Set(shift.vendorSlotIds);
  const rows = (await programRecipientRows(organizationId, eventId, input.now)).filter((row) => row.vendor && slots.has(row.vendor.vendorSlotId));
  const vocabulary = (await findEventAudience(organizationId, eventId)) ?? "couple";
  // Lot 65d (Q45, décision de Julien du 22/11/2026 ; ADR 0110) : le jour J, le programme décalé part
  // toujours de Symbola, quel que soit le réglage « qui envoie » : en plein mariage, la planner n'a pas
  // le temps d'envoyer elle-même un message par prestataire.
  let sent = 0;
  for (const row of rows) {
    try {
      const values: EmailValues = {
        ...(await linkEmailValues({ organizationId, eventId, audience: row.audience, personName: row.name, locale: row.locale, vocabulary, expiresOn: null })),
        version: String(latest.number),
      };
      const pdf = await input.renderDocument(programDocumentOf(row, found, latest));
      await sendOrganizationEmail({
        organizationId,
        to: row.email,
        kind: "program_published",
        locale: row.locale,
        values,
        attachments: [{ filename: pdf.filename, content: Buffer.from(pdf.content), contentType: "application/pdf" }],
        idempotencyKey: `day-shift:${shift.id}:${row.linkId}`,
        dayOfShift: true,
      });
      sent += 1;
    } catch (error) {
      if (error instanceof MailQuotaExceededError) break;
      // Nom de l'erreur seulement au journal : jamais d'adresse (SEC-20).
      console.error("e-mail du décalage non parti", error instanceof Error ? error.name : "erreur");
    }
  }
  await recordDayShiftNotification(organizationId, shift.id, sent);
  return { sent, notSent: rows.length - sent };
}

// Les liens de prestataires qu'un décalage peut prévenir : les postes qui ont un lien actif.
export async function listNotifiableVendorSlots(organizationId: string, eventId: string, now: Date = new Date()): Promise<string[]> {
  return [...new Set((await programRecipientRows(organizationId, eventId, now)).flatMap((row) => (row.vendor ? [row.vendor.vendorSlotId] : [])))];
}

// D3 : l'espace du prestataire affiche en tête le dernier décalage appliqué qui concerne son poste.
export async function latestVendorDayShift(organizationId: string, eventId: string, vendorSlotId: string): Promise<{ minutes: number; validatedAt: string; programVersion: number | null } | null> {
  const records = await findDayRecords(organizationId, eventId);
  const shift = [...(records?.shifts ?? [])].reverse().find((entry) => entry.outcome === "applied" && entry.vendorSlotIds.includes(vendorSlotId));
  return shift ? { minutes: shift.minutes, validatedAt: shift.validatedAt, programVersion: shift.programVersion } : null;
}

// JRJ-06, JRJ-07, JRJ-09 : une photo reçue de la file. Le sujet est vérifié (une case ou un incident
// de cet évènement ; une échéance l'est par le module budget avant l'appel), puis le fichier est
// contrôlé à l'arrivée (taille, type par le contenu, antivirus, ADR 0027) : refusé, il garde une ligne
// sans fichier (l'écran le dit) et l'incident ou la case restent. Une action rejouée est ignorée.
export async function receiveDayPhoto(input: {
  organizationId: string;
  eventId: string;
  userId: string | null;
  // Lot 52 (D3) : la photo vient du lien d'un renfort du jour J.
  linkId?: string | null;
  meta: DayPhotoMeta;
  bytes: Uint8Array | null;
  maxBytes: number;
  now?: Date;
}): Promise<{ status: DayActionStatus; reason?: string; photo?: DayPhoto }> {
  const already = await dayPhotoActionExists(input.organizationId, input.meta.actionId);
  if (already) return { status: "duplicate", photo: already };
  const takenAt = deviceInstant(input.meta.deviceAt, input.now ?? new Date());
  if (!takenAt) return { status: "rejected", reason: "time" };
  const target = await resolveDayPhotoSubject({ organizationId: input.organizationId, eventId: input.eventId, subject: input.meta.subject, subjectId: input.meta.subjectId, subjectActionId: input.meta.subjectActionId });
  if (!target) return { status: "rejected", reason: "subject" };
  let stored: { key: string; contentType: string; sizeBytes: number } | null = null;
  let rejection: DayPhotoRejection | null = null;
  // Dans l'ordre : taille, antivirus, type par le contenu (une image), puis stockage privé.
  if (!input.bytes || input.bytes.length === 0) rejection = "unavailable";
  else if (input.bytes.length > input.maxBytes) rejection = "size";
  else {
    const buffer = Buffer.from(input.bytes);
    const env = parseEnv(process.env);
    const detected = detectFileType(input.bytes);
    if ((await scanBuffer(buffer, { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT })).infected) rejection = "virus";
    else if (!detected || !detected.mime.startsWith("image/")) rejection = "type";
    else {
      const key = `${input.organizationId}/${randomUUID()}.${detected.extension}`;
      await uploadPrivateObject(createStorageClient(), { key, body: buffer, contentType: detected.mime });
      stored = { key, contentType: detected.mime, sizeBytes: buffer.length };
    }
  }
  const { photo, duplicate } = await insertDayPhoto({ organizationId: input.organizationId, eventId: input.eventId, userId: input.userId, linkId: input.linkId ?? null, actionId: input.meta.actionId, takenAt, target, stored, rejection });
  if (duplicate && stored) await deletePrivateObject(createStorageClient(), stored.key).catch(() => undefined);
  return { status: duplicate ? "duplicate" : "applied", photo };
}

// PAR-08, étape 7 : le bilan du lendemain ; la synthèse se garde dès qu'il est prêt.
export async function getDayReport(input: { organizationId: string; eventId: string; handovers: DayReportHandover[]; now?: Date }): Promise<DayReport | null> {
  const now = input.now ?? new Date();
  const [event, records, moments] = await Promise.all([findEventById(input.organizationId, input.eventId), findDayRecords(input.organizationId, input.eventId), listKeyMomentsOf(input.organizationId, input.eventId)]);
  if (!event || !records) return null;
  const program = await getEventProgram(input.organizationId, input.eventId);
  const report = buildDayReport({ eventId: input.eventId, eventDate: event.event.eventDate, timeZone: event.event.timeZone, moments, items: program.items, records, handovers: input.handovers, now });
  if (!report.ready) return report;
  return { ...report, preparedAt: await saveDayReport(input.organizationId, input.eventId, report, now) };
}

// Le fichier d'une photo du jour J de cet évènement, servi par l'app après le contrôle des droits
// (ADR 0027) ; null si elle n'existe pas, a été refusée, ou n'est pas de cet évènement.
// Lot 52 (D3) : withoutHandovers, pour un renfort : le reçu d'une remise d'argent (budget) lui reste fermé.
export async function readDayPhoto(organizationId: string, eventId: string, photoId: string, options: { withoutHandovers?: boolean } = {}): Promise<FileDownload | null> {
  const file = await findDayPhotoFile(organizationId, eventId, photoId, options);
  if (!file) return null;
  try {
    const object = await readPrivateObject(createStorageClient(), file.key);
    return { data: object.data, contentType: file.contentType, fileName: `photo-${photoId}.${file.contentType.split("/")[1] ?? "jpg"}` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) return null;
    throw error;
  }
}
// --- Lot 47 (PAR-05, PRE-03, PRE-04, PRE-09, BUD-05 ; ADR 0085) : prestataires par lien. ---
// Le brief d'un poste envoyé à plusieurs prestataires, leur réponse par leur lien, le comparatif et
// les scénarios, l'avis et le choix du client qui engage, la feuille de route (vendor-coordination.ts).
export {
  answerBrief as answerVendorBrief,
  answerNotices as listVendorAnswerNotices,
  attachInvoiceByLink as attachVendorInvoiceByLink,
  attachQuoteByLink as attachVendorQuoteByLink,
  briefDocumentFile as getLinkVendorBriefDocumentFile,
  comparison as getVendorComparison,
  compareScenarios as compareVendorScenarios,
  confirmRoadmap as confirmVendorRoadmap,
  consultationView as getVendorConsultationView,
  createScenario as createVendorScenario,
  defaultBriefDeadline as getDefaultVendorBriefDeadline,
  engagedChoiceNotices as listEngagedChoiceNotices,
  followUps as listVendorFollowUps,
  getBrief as getVendorBrief,
  getSettings as getVendorCoordinationSettings,
  linkOptionFeedback as listLinkOptionFeedback,
  listScenarios as listVendorScenarios,
  removeScenario as removeVendorScenario,
  renameScenario as renameVendorScenario,
  roadmapAlerts as listVendorRoadmapAlerts,
  roadmapView as getVendorRoadmapView,
  saveBrief as saveVendorBrief,
  saveSettings as saveVendorCoordinationSettings,
  sendBrief as sendVendorBrief,
  sendBriefReminders as sendVendorBriefReminders,
  sendRoadmaps as sendVendorRoadmaps,
  setOptionFeedback as setLinkOptionFeedback,
  setScenarioChoice as setVendorScenarioChoice,
  showScenarioToClients as showVendorScenarioToClients,
  changeRetained as changeRetainedVendor,
  VendorBriefInvalidError,
} from "./vendor-coordination";
export type {
  ScenarioComparison,
  VendorBrief,
  VendorComparison,
  VendorComparisonRow,
  VendorConsultationView,
  VendorCoordinationSettings,
  VendorFollowUpStatus,
  VendorRoadmapView,
  VendorScenario,
} from "@symbola/contracts";
// —— Lot 45 (CRM-05, CRM-06, CRM-07, CRM-09, POR-07, HUB-21 ; ADR 0090) ——————————————————————
// Réponses en un clic, relances des prospects, questionnaires ; références d'un contact fusionné.
export {
  BrochureRejectedError,
  getProspectFollowUp,
  getProspectFollowUpSettings,
  lastPlannerMessages,
  listContactMessages,
  listEventFollowUps,
  listEventMessages,
  listReadyFollowUps,
  noteProspectAnswered,
  prepareDueFollowUps,
  PROSPECT_BODY_MAX,
  PROSPECT_SUBJECT_MAX,
  ProspectMessageInvalidError,
  prospectMessageValues,
  removeProspectBrochure,
  renderProspectText,
  saveProspectBrochure,
  saveProspectFollowUpSettings,
  sendProspectFollowUp,
  sendProspectMessage,
  stopProspectFollowUps,
  withdrawProspectFollowUp,
  type ExternalProspectActivity,
  type FollowUpSendOutcome,
  type ProspectContext,
  type ProspectRecipient,
  type ProspectSendResult,
} from "./prospect-messages";
export { FollowUpSettingsInvalidError, FOLLOW_UP_DAYS_MAX, FOLLOW_UP_DAYS_MIN } from "./follow-up-rules";
export {
  addStarterQuestionnaires,
  createQuestionnaireTemplate,
  deleteQuestionnaireTemplate,
  duplicateQuestionnaireTemplate,
  getQuestionnaireTemplate,
  listEventQuestionnaires,
  listFinishedUnseenQuestionnaires,
  listQuestionnaireTemplates,
  markEventQuestionnairesSeen,
  QUESTIONNAIRE_NAME_MAX,
  QuestionnaireClosedError,
  QuestionnaireNotFoundError,
  QuestionnaireTemplateInvalidError,
  questionnaireTemplatesForEventType,
  saveQuestionnaireTemplate,
  sensitiveQuestionKeys,
  type PortalQuestionnaireView,
} from "./questionnaires";
export { AnswerInvalidError, naturesForField, QuestionInvalidError, type QuestionInput } from "./questionnaire-rules";
export { countEventsContactReferences, repointMergedContact } from "./contact-merge";

// Les destinataires d'un message à un prospect : les clients de l'évènement qui ont une adresse et
// une fiche de contact (la liste demandée, sinon tous).
export async function prospectRecipients(organizationId: string, eventId: string, contactIds?: string[]): Promise<ProspectRecipient[]> {
  const event = await getEvent(organizationId, eventId);
  if (!event) return [];
  const wanted = contactIds ? new Set(contactIds) : null;
  return event.clients.flatMap((client) => (client.contactId && client.email && (!wanted || wanted.has(client.contactId)) ? [{ contactId: client.contactId, firstName: client.firstName, email: client.email }] : []));
}

// Destinataires et valeurs des variables d'un message (CRM-05) ; bookingUrl : la page de réservation
// du module Rendez-vous, s'il est ouvert (donnée par l'appelant, ARC-07).
export async function prospectMessageContext(input: { organizationId: string; eventId: string; locale: "fr" | "en"; contactIds?: string[]; bookingUrl: string | null }): Promise<{ recipients: ProspectRecipient[]; values: EmailValues } | null> {
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) return null;
  const recipients = await prospectRecipients(input.organizationId, input.eventId, input.contactIds);
  const couple = ((await getEventAudience(input.organizationId, input.eventId)) ?? "couple") === "couple";
  const values = await prospectMessageValues({
    organizationId: input.organizationId,
    locale: input.locale,
    couple,
    firstNames: recipients.map((recipient) => recipient.firstName),
    clientNames: event.clients.map((client) => client.firstName),
    eventDate: event.eventDate,
    place: event.venueName,
    bookingUrl: input.bookingUrl,
  });
  return { recipients, values };
}

// —— Questionnaires envoyés par le lien du client (POR-07, CRM-09) ——————————————————————————

// Envoyer un questionnaire à un client de l'évènement : la copie figée du modèle, la rubrique
// « Questionnaires » ouverte sur son lien personnel (créé si besoin ; s'il existe, son jeton est
// renouvelé : le nouveau lien part avec le questionnaire), l'e-mail « Questionnaire envoyé ».
export async function sendEventQuestionnaire(input: { organizationId: string; eventId: string; eventClientId: string; templateId: string; userId: string; locale: "fr" | "en"; now?: Date }): Promise<{ questionnaireId: string; linkId: string; url: string }> {
  const now = input.now ?? new Date();
  const found = await findEventById(input.organizationId, input.eventId);
  if (!found) throw new EventNotFoundError();
  if (found.event.isDemo) throw new DemoEventRestrictionError();
  const event = await getEvent(input.organizationId, input.eventId);
  const client = event?.clients.find((candidate) => candidate.id === input.eventClientId);
  if (!client?.email) throw new EventLinkInvalidError("client");
  const frozen = await freezeQuestionnaireOf(input.organizationId, input.templateId);
  const vocabulary = (await findEventAudience(input.organizationId, input.eventId)) ?? "couple";
  const base = { organizationId: input.organizationId, eventId: input.eventId, audience: "client" as const, personName: client.firstName, locale: input.locale, vocabulary };
  const valuesFor = async (expiresOn: string | null, url?: string): Promise<EmailValues> => ({ ...(await linkEmailValues({ ...base, expiresOn, ...(url ? { url } : {}) })), questionnaire: frozen.name });
  await assertOrganizationEmailReady({ organizationId: input.organizationId, kind: "questionnaire_sent", locale: input.locale, values: await valuesFor(null) });
  // Lot 65d (MSG-01 ; ADR 0110) : quand la planner envoie de sa messagerie, rien ne part : pas de plafond.
  const prepared = await preparesRelationEmail(input.organizationId, "questionnaire_sent");
  if (!prepared) await reserveOrganizationMail(input.organizationId);
  const secret = newLinkSecret();
  const existing = (await findEventLinkRows(input.organizationId, input.eventId)).find((context) => context.link.audience === "client" && context.link.eventClientId === client.id && !context.link.revokedAt);
  let context: LinkWithContext;
  if (existing) {
    await openQuestionnaireRubric(input.organizationId, existing.link.id);
    const extendTo = isLinkExpired(expiresOnOf(existing), now) ? addDays(parisToday(now), starterLinkExpiry().daysAfterEvent.client) : undefined;
    const replaced = await replaceLinkTokenRow(input.organizationId, existing.link.id, hashLinkSecret(secret), extendTo, input.locale);
    if (!replaced) throw new EventLinkNotFoundError();
    context = replaced;
  } else {
    const result = await insertLinkRow({
      personName: [client.firstName, client.lastName].filter(Boolean).join(" ").slice(0, PERSON_NAME_MAX),
      email: client.email,
      eventClientId: client.id,
      rights: { rubrics: ["questionnaires"], budgetScope: "all", sharedSlotIds: [] },
      customExpiresOn: null,
      otpRequired: false,
      taskReminders: true,
      organizationId: input.organizationId,
      eventId: input.eventId,
      audience: "client",
      vendorCandidateId: null,
      locale: input.locale,
      tokenHash: hashLinkSecret(secret),
    });
    if (result.status !== "saved") throw linkWriteError(result.status);
    context = result.context;
  }
  const link = toEventLink(context, now);
  const url = linkUrl(formatLinkToken(input.organizationId, secret));
  const questionnaireId = await insertEventQuestionnaire({ organizationId: input.organizationId, eventId: input.eventId, contactId: client.contactId, linkId: link.id, frozen, now });
  if (prepared) {
    await depositPreparedEmail({ organizationId: input.organizationId, kind: "questionnaire_sent", eventId: input.eventId, recipientType: "event_link", recipientId: link.id, ref: { questionnaireId, locale: input.locale }, origin: "gesture", sourceKey: `questionnaire:${questionnaireId}` });
  } else {
    await sendOrganizationEmail({ organizationId: input.organizationId, to: link.email, kind: "questionnaire_sent", locale: input.locale, values: await valuesFor(link.expiresOn, url), reserve: false });
  }
  await recordQuestionnaireSent({ organizationId: input.organizationId, eventId: input.eventId, contactId: client.contactId, userId: input.userId, name: frozen.name, now });
  return { questionnaireId, linkId: link.id, url };
}

// Lot 65d (MSG-01, HUB-28 ; ADR 0110) — la fenêtre « Préparer l'e-mail » : un message de la relation du
// module Évènements, recomposé à l'ouverture depuis ses références, avec les mêmes valeurs qu'un envoi
// par Symbola. Le lien personnel d'un message qui en porte un (questionnaire, brief, relance, feuille de
// route) reçoit un nouveau jeton à l'ouverture, comme à chaque envoi par Symbola : l'ancien cesse
// (renewedLink). null : le message n'a plus lieu d'être (lien retiré ou expiré, rien à rappeler).
export async function draftEventsRelationEmail(organizationId: string, item: PreparedEmailView, now: Date = new Date()): Promise<RelationDraft | null> {
  if (!item.eventId) return null;
  const eventId = item.eventId;
  switch (item.kind) {
    case "program_published": {
      const row = (await programRecipientRows(organizationId, eventId, now)).find((candidate) => candidate.linkId === item.recipientId);
      if (!row) return null;
      const vocabulary = (await findEventAudience(organizationId, eventId)) ?? "couple";
      const values: EmailValues = { ...(await linkEmailValues({ organizationId, eventId, audience: row.audience, personName: row.name, locale: row.locale, vocabulary, expiresOn: null })), version: item.ref.version ?? "" };
      return { to: row.email, recipientName: row.name, locale: row.locale, values, pdfHref: row.audience === "client" ? `/events/${eventId}/programme/pdf` : null };
    }
    case "task_reminder": {
      const policy = starterClientTaskReminders();
      const today = parisToday(now);
      const candidate = (await findReminderCandidateRows(organizationId, addDays(today, -policy.overdue.within), addDays(today, policy.daysBefore.week), parisStartOfDay(today))).find((row) => row.context.link.id === item.recipientId);
      if (!candidate || !usableLink(candidate.context, now)) return null;
      const due = candidate.tasks.flatMap((task) => {
        const threshold = reminderThreshold(task.dueDate, today, policy);
        return threshold ? [{ label: task.label, dueDate: task.dueDate, threshold }] : [];
      });
      if (due.length === 0) return null;
      const { link } = candidate.context;
      const locale = link.locale === "en" ? "en" : "fr";
      const vocabulary = (await findEventAudience(organizationId, link.eventId)) ?? "couple";
      const values: EmailValues = {
        ...(await linkEmailValues({ organizationId, eventId: link.eventId, audience: "client", personName: link.personName, locale, vocabulary, expiresOn: null })),
        tasks: reminderTaskLines({ locale, tasks: due, today }),
      };
      return { to: link.email, recipientName: link.personName, locale, values };
    }
    case "questionnaire_sent": {
      const questionnaire = (await listQuestionnairesOfEvent(organizationId, eventId)).find((candidate) => candidate.id === item.ref.questionnaireId);
      const context = await findLinkRow(organizationId, item.recipientId);
      if (!questionnaire || !context || context.link.eventId !== eventId || !usableLink(context, now)) return null;
      const locale = item.ref.locale === "en" ? "en" : item.ref.locale === "fr" ? "fr" : context.link.locale === "en" ? "en" : "fr";
      const secret = newLinkSecret();
      const replaced = await replaceLinkTokenRow(organizationId, context.link.id, hashLinkSecret(secret));
      if (!replaced) return null;
      const link = toEventLink(replaced, now);
      const vocabulary = (await findEventAudience(organizationId, eventId)) ?? "couple";
      const values: EmailValues = {
        ...(await linkEmailValues({ organizationId, eventId, audience: "client", personName: link.personName, locale, vocabulary, expiresOn: link.expiresOn, url: linkUrl(formatLinkToken(organizationId, secret)) })),
        questionnaire: questionnaire.name,
      };
      return { to: link.email, recipientName: link.personName, locale, values, renewedLink: true };
    }
    case "vendor_brief":
    case "vendor_brief_reminder":
    case "vendor_roadmap":
      return draftVendorRelationEmail(organizationId, item, now);
    case "prospect_reply":
    case "prospect_follow_up":
      return draftProspectRelationEmail(organizationId, item);
    default:
      return null;
  }
}

// Les champs de l'évènement qu'un questionnaire peut alimenter, tels qu'ils sont (D7).
export async function eventFieldValues(organizationId: string, eventId: string): Promise<EventFieldValues | null> {
  const event = await getEvent(organizationId, eventId);
  if (!event) return null;
  const typeLabel = event.eventTypeId ? ((await listEventTypes(organizationId)).find((type) => type.id === event.eventTypeId)?.label ?? null) : null;
  return {
    event_date: event.eventDate,
    guests: event.guestsEstimated,
    budget: event.wantedBudgetCents,
    venue: event.venueName,
    city: event.venueCity,
    style: event.style,
    event_type: typeLabel,
  };
}

// Écrit une réponse dans le champ de l'évènement ; false : elle ne s'y écrit pas (un type inconnu).
async function writeEventField(organizationId: string, eventId: string, field: QuestionEventField, value: QuestionnaireAnswerValue): Promise<boolean> {
  const event = await getEvent(organizationId, eventId);
  if (!event) return false;
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  switch (field) {
    case "event_date":
      await changeEventDate(organizationId, eventId, text);
      return true;
    case "guests":
      await setEventIdentity(organizationId, eventId, { guestsEstimated: Number(value), guestsConfirmed: event.guestsConfirmed, style: event.style, notes: event.notes });
      return true;
    case "style":
      await setEventIdentity(organizationId, eventId, { guestsEstimated: event.guestsEstimated, guestsConfirmed: event.guestsConfirmed, style: text.slice(0, 2000), notes: event.notes });
      return true;
    case "budget":
      await setEventWantedBudget(organizationId, eventId, Number(value));
      return true;
    case "venue":
      await setEventVenue(organizationId, eventId, { venueName: text.slice(0, 200), venueCity: event.venueCity });
      return true;
    case "city":
      await setEventVenue(organizationId, eventId, { venueName: event.venueName, venueCity: text.slice(0, 200) });
      return true;
    case "event_type": {
      const type = (await listEventTypes(organizationId)).find((candidate) => candidate.label.trim().toLocaleLowerCase("fr") === text.trim().toLocaleLowerCase("fr"));
      if (!type) return false;
      await setEventType(organizationId, eventId, type.id);
      return true;
    }
  }
}

// CRM-09, D7 — après « Terminer » : les champs vides se remplissent, les réponses égales à la fiche
// se règlent d'office ; les écarts restent à la planner.
export async function applyQuestionnairePrefill(organizationId: string, eventId: string): Promise<{ filled: number; differences: PrefillDifference[] }> {
  const values = await eventFieldValues(organizationId, eventId);
  if (!values) throw new EventNotFoundError();
  const state = await eventPrefillState(organizationId, eventId, values);
  let filled = 0;
  for (const fill of state.work.fill) {
    // Une valeur que la fiche refuse (hors bornes) ne bloque pas « Terminer » : la fiche reste.
    const written = await writeEventField(organizationId, eventId, fill.eventField, fill.value).catch((error: unknown) => {
      if (error instanceof RangeError) return false;
      throw error;
    });
    await markAnswersResolved(organizationId, [fill], written ? "filled" : "kept");
    if (written) filled += 1;
  }
  await markAnswersResolved(organizationId, state.work.same, "kept");
  return { filled, differences: (await eventPrefillState(organizationId, eventId, (await eventFieldValues(organizationId, eventId))!)).differences };
}

export async function listQuestionnaireDifferences(organizationId: string, eventId: string): Promise<PrefillDifference[]> {
  const values = await eventFieldValues(organizationId, eventId);
  return values ? (await eventPrefillState(organizationId, eventId, values)).differences : [];
}

// D7 — la planner choisit : la réponse remplace la fiche (« answer »), ou la fiche reste (« event »).
export async function resolveQuestionnaireDifference(input: { organizationId: string; eventId: string; questionnaireId: string; key: string; choice: "answer" | "event" }): Promise<void> {
  const answer = await findResolvableAnswer(input.organizationId, input.questionnaireId, input.key);
  if (!answer || answer.eventId !== input.eventId) throw new QuestionnaireMissingError();
  if (input.choice === "answer" && (await writeEventField(input.organizationId, input.eventId, answer.eventField, answer.value))) {
    await markAnswersResolved(input.organizationId, [{ questionnaireId: input.questionnaireId, key: input.key }], "applied");
    return;
  }
  await markAnswersResolved(input.organizationId, [{ questionnaireId: input.questionnaireId, key: input.key }], "kept");
}

// Côté lien (rubrique « Questionnaires » ouverte) : les questionnaires du lien, un questionnaire,
// une réponse, « Terminer ». Toujours l'évènement et le lien de la session, jamais un autre.
export type LinkQuestionnaireScope = { organizationId: string; eventId: string; linkId: string };

export async function listQuestionnairesOfLink(scope: LinkQuestionnaireScope): Promise<EventQuestionnaire[]> {
  return listLinkQuestionnaires(scope.organizationId, scope.eventId, scope.linkId);
}

export async function getQuestionnaireOfLink(scope: LinkQuestionnaireScope, questionnaireId: string): Promise<PortalQuestionnaireView> {
  const values = await eventFieldValues(scope.organizationId, scope.eventId);
  if (!values) throw new QuestionnaireMissingError();
  return getPortalQuestionnaire({ ...scope, questionnaireId, eventValues: values });
}

export async function answerQuestionnaireOfLink(scope: LinkQuestionnaireScope, questionnaireId: string, key: string, value: string | string[] | null, now?: Date): Promise<QuestionnaireAnswerValue | null> {
  return saveLinkAnswer({ ...scope, questionnaireId, key, value, ...(now ? { now } : {}) });
}

export async function finishQuestionnaireOfLink(scope: LinkQuestionnaireScope, questionnaireId: string, now?: Date): Promise<{ filled: number; differences: number }> {
  await finishLinkQuestionnaire({ ...scope, questionnaireId, ...(now ? { now } : {}) });
  const result = await applyQuestionnairePrefill(scope.organizationId, scope.eventId);
  return { filled: result.filled, differences: result.differences.length };
}

// Lot 48a (DAT-08 ; D5, ADR 0093) : notes d'évènement confidentielles.
export { readEventConfidentialNotes, saveEventNotes, EventNotesForbiddenError, type EventNotesViewer } from "./confidential-notes";

// Lot 48a (PRE-05, PRE-10 ; D3) : fiche du carnet d'un lien de prestataire (pièces demandées, IBAN).
export async function linkVendorRecordId(organizationId: string, linkId: string): Promise<string | null> {
  return /^[0-9a-f-]{36}$/i.test(linkId) ? findLinkVendorRecordId(organizationId, linkId) : null;
}
// Lot 53 (CHR-10, CHR-05, HUB-24 ; D6, D8 ; ADR 0095) : tâches hors évènement et récurrentes, jalons, santé
// du planning qui s'explique, terme des clients par type d'évènement.
export {
  addStandaloneTask,
  clientTermForEvent,
  deleteStandaloneTask,
  getPlanningHealth,
  getPlanningHealthThresholds,
  listEventTypeVocabulary,
  listLatePlannerTasks,
  listStandaloneTasks,
  PlanningInputError,
  setEventTypeClientTerm,
  setPlanningHealthThresholds,
  setStandaloneTaskDone,
  setTaskMilestone,
  spawnDueRecurringTasks,
  suggestedClientTerms,
  updateStandaloneTask,
  // Lot 70a (UX-06, CHR-05 ; M10) : seuil de « Bientôt ».
  getTaskSoonDays,
  setTaskSoonDays,
  getDayOfLeadDays,
  setDayOfLeadDays,
  type LateTask,
} from "./planning";

// Lot 70a (CHR-02 ; A3, A7) : la personne qui s'en charge (refus comme un objet inexistant), la note interne ;
// (UX-06 ; Q47-4) l'état d'échéance, un seul calcul pour tous les écrans ; (UX-07 ; A18) les valeurs d'avant.
export { TaskAssigneeNotFoundError, TaskNoteInvalidError } from "./task-assignment";
export { DEFAULT_SOON_DAYS, dueStateAt, taskDueState } from "./due-state";
// Lot 70c (CHR-03) : les périodes des filtres de l'onglet « Tâches » de la fiche.
export { periodRange } from "./task-filters";
export { purgeTaskChangeSnapshots, TASK_UNDO_MINUTES, type UndoableTaskChange } from "./task-bulk";

// Lot 64 (HUB-29, RDV-02 ; D1 à D6 ; ADR 0109) : plages occupées.
import { getBusySettings, setBusySettings, listEventTypeBusyRules, setEventTypeBusyRule, getEventBusy, setEventBusyRule, listBusyRanges, listEventBusyRanges } from "./busy";
export { BusyRuleInvalidError, getBusySettings, setBusySettings, listEventTypeBusyRules, setEventTypeBusyRule, getEventBusy, setEventBusyRule, listBusyRanges, listEventBusyRanges } from "./busy";
export { busyRuleMinutes, isValidBusyRule, BUSY_DAY_OFFSET_MAX, BUSY_DAY_OFFSET_MIN } from "./busy-ranges";

// —— Lot 58 (PAR-09, EVT-08 ; D4, D5 ; ADR 0097) — clôture, archivage, modèles et duplication ——————————

import { closeEvent as closeEventRow, assertEventWritable as assertEventWritableRow } from "./closing";
import { applyTemplateStructures, readEventStructure } from "./event-templates";
import type { EventTemplateContent } from "./template-rules";
import type { ClosingBudgetSnapshot } from "@symbola/db/schema/events";

export {
  archiveEvent,
  archivedEventIds,
  assertEventWritable,
  ClosingInputError,
  ClosingSettingsError,
  draftReviewRequest,
  EventArchivedError,
  EventNotClosableError,
  getClosingSettings,
  getEventClosing,
  isEventArchived,
  listClosingCandidates,
  listEventClosings,
  ReviewRequestError,
  saveClosingNotes,
  saveClosingSettings,
  sendReviewRequest,
  unarchiveEvent,
  type ClosingDigest,
  type ClosingNotesInput,
  type ClosingSettingsView,
  type ClosingView,
  type ReviewRecipient,
} from "./closing";
export { CLOSING_STEPS, closingChecklist, closingComplete, parseHours, type ClosingFacts, type ClosingItem, type ClosingStep, type ClosingStepStatus } from "./closing-rules";
export { EventTemplateNotFoundError, getEventTemplate, listEventTemplates, removeEventTemplate, saveEventTemplate, type EventTemplateDetail, type EventTemplateSummary } from "./event-templates";
export { EventTemplateInvalidError, eventTemplateContentSchema, findTemplatePersonalData, type EventTemplateContent, type TemplateFinding } from "./template-rules";
export type { ClosingBudgetSnapshot } from "@symbola/db/schema/events";

// Clôturer : « Clôturé » (historisé) s'il ne l'est pas déjà, puis le budget final se fige.
export async function closeEventWithBudget(input: { organizationId: string; eventId: string; userId: string; budget: ClosingBudgetSnapshot; now?: Date }) {
  await assertEventWritableRow(input.organizationId, input.eventId);
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  if (event.status === "confirmed") await changeEventStatus({ organizationId: input.organizationId, eventId: input.eventId, changedByUserId: input.userId, toStatus: "closed" });
  return closeEventRow(input);
}

// Les structures d'un évènement (modèle ou duplication), sans les lignes du budget.
export async function readEventStructureOf(organizationId: string, eventId: string, includeVendors: boolean) {
  return readEventStructure(organizationId, eventId, { includeVendors });
}

// EVT-08 : un évènement neuf, en Option, sans client, invité, devis ni facture, à la date donnée ; les
// structures s'y posent (dates recalculées). Renvoie l'évènement et ses postes (par libellé).
export async function createEventFromStructure(input: { organizationId: string; userId: string; eventDate: string; eventTypeId: string | null; prospectSourceId: string | null; content: EventTemplateContent; locale: "fr" | "en" }): Promise<{ eventId: string; slotIds: Map<string, string> }> {
  assertDate(input.eventDate);
  const sources = await listProspectSources(input.organizationId);
  const prospectSourceId = sources.some((source) => source.id === input.prospectSourceId) ? input.prospectSourceId! : sources[0]?.id;
  if (!prospectSourceId) throw new EventNotFoundError();
  const eventTypeId = input.eventTypeId && (await listEventTypes(input.organizationId)).some((type) => type.id === input.eventTypeId) ? input.eventTypeId : null;
  const { id } = await createProspect({ organizationId: input.organizationId, createdByUserId: input.userId, clients: [], prospectSourceId, eventTypeId, eventDate: input.eventDate });
  const slotIds = await applyTemplateStructures({ organizationId: input.organizationId, eventId: id, eventDate: input.eventDate, content: input.content, locale: input.locale });
  for (const item of input.content.program) {
    await addProgramItem(input.organizationId, id, { startTime: item.startTime, endTime: item.endTime, label: item.label, location: item.location, vendorSlotIds: [], freeParticipants: [] });
  }
  return { eventId: id, slotIds };
}

// --- Lot 55 (MSG-03, POR-06, POR-11 ; D3 ; ADR 0102) — fils de discussion par sujet ---
//
// L'équipe lit tout ; un lien ne lit que les messages partagés des sujets qu'il voit : client dont le
// lien ouvre la rubrique « Messages » (POR-10 : fermée par défaut), ou prestataire ajouté au sujet. Un
// message interne n'a aucun chemin vers l'extérieur : l'équipe l'écrit par sa propre fonction
// (postInternalNote), qui ne prévient personne au-dehors ; aucune fonction d'un lien n'écrit ni ne lit
// un message interne.
import {
  findAttachment as findMessageAttachmentRow,
  findTopic as findMessageTopicRow,
  insertMessage as insertMessageRow,
  insertTopic as insertMessageTopicRow,
  isMessageId,
  listLinkTopics as listLinkMessageTopicRows,
  listMessages as listMessageRows,
  listTopics as listMessageTopicRows,
  MessageInputError,
  MessageNotFoundError,
  readAttachmentFile as readMessageAttachmentFile,
  replaceTopicVendors as replaceMessageTopicVendors,
  topicHasSharedMessage,
  type TopicRow as MessageTopicRow,
} from "./messages";
import { getOrganizationContact, getPushSender } from "@/modules/hub/service";
import { linkPushSubscriptions } from "@symbola/db/schema/events";
import { withOrganization as withMessagesOrganization } from "@symbola/db/with-organization";
import { and as andMessages, eq as eqMessages, inArray as inArrayMessages } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { LinkMessageThread, LinkMessageTopic, MessageFileInput, MessageRecipient, MessageTopicSummary, MessageTopicThread, MessageView, PushMessage } from "@symbola/contracts";

export { MessageInputError, MessageNotFoundError } from "./messages";

async function messageTopicOf(organizationId: string, topicId: string, eventId?: string): Promise<MessageTopicRow> {
  const topic = await findMessageTopicRow(organizationId, topicId);
  if (!topic || (eventId && topic.eventId !== eventId)) throw new MessageNotFoundError();
  return topic;
}

type MessageRecipientRow = MessageRecipient & { email: string; locale: "fr" | "en" };

// Les destinataires d'un message partagé : les clients dont le lien, valable, ouvre la rubrique
// « Messages », et les prestataires du sujet dont le lien est valable.
async function messageRecipientRows(organizationId: string, topic: MessageTopicRow, now: Date = new Date()): Promise<MessageRecipientRow[]> {
  const vendorIds = new Set(topic.vendorLinkIds);
  const rows: MessageRecipientRow[] = [];
  for (const context of await findEventLinkRows(organizationId, topic.eventId)) {
    if (!usableLink(context, now)) continue;
    const base = { linkId: context.link.id, name: context.link.personName, email: context.link.email, locale: context.link.locale === "en" ? ("en" as const) : ("fr" as const) };
    if (context.link.audience === "client" && rightsOf(context).rubrics.includes("messages")) rows.push({ ...base, audience: "client" });
    if (context.link.audience === "vendor" && vendorIds.has(context.link.id)) rows.push({ ...base, audience: "vendor" });
  }
  return rows.sort((a, b) => a.audience.localeCompare(b.audience) || a.name.localeCompare(b.name));
}

// L'empreinte des destinataires nommés sur le bouton (D3) : l'envoi est refusé s'ils ont changé entre
// l'affichage et l'envoi.
export function messageRecipientsDigest(recipients: Pick<MessageRecipient, "linkId">[]): string {
  return createHash("sha256").update(recipients.map((recipient) => recipient.linkId).sort().join(",")).digest("hex");
}

export async function listMessageTopics(organizationId: string, eventId: string): Promise<MessageTopicSummary[]> {
  return listMessageTopicRows(organizationId, eventId);
}

export async function createMessageTopic(input: { organizationId: string; eventId: string; name: string }): Promise<MessageTopicSummary> {
  await assertEventWritableRow(input.organizationId, input.eventId);
  if (!(await findEventById(input.organizationId, input.eventId))) throw new EventNotFoundError();
  return insertMessageTopicRow(input.organizationId, input.eventId, input.name);
}

// eventId : celui de l'écran ; un sujet d'un autre évènement répond comme absent.
export async function getMessageThread(organizationId: string, topicId: string, eventId: string): Promise<MessageTopicThread> {
  const topic = await messageTopicOf(organizationId, topicId, eventId);
  const [summary] = (await listMessageTopicRows(organizationId, topic.eventId)).filter((item) => item.id === topic.id);
  const recipients = await messageRecipientRows(organizationId, topic);
  return {
    ...summary!,
    messages: await listMessageRows(organizationId, topic.id, { sharedOnly: false }),
    recipients: recipients.map(({ linkId, audience, name }) => ({ linkId, audience, name })),
  };
}

// Les prestataires que la planner peut ajouter au sujet : ceux de l'évènement qui ont un lien.
export async function listTopicVendorChoices(organizationId: string, eventId: string): Promise<{ linkId: string; name: string }[]> {
  const now = new Date();
  return (await findEventLinkRows(organizationId, eventId)).filter((context) => context.link.audience === "vendor" && usableLink(context, now)).map((context) => ({ linkId: context.link.id, name: context.link.personName }));
}

export async function setMessageTopicVendors(input: { organizationId: string; eventId: string; topicId: string; vendorLinkIds: string[] }): Promise<void> {
  const topic = await messageTopicOf(input.organizationId, input.topicId, input.eventId);
  await assertEventWritableRow(input.organizationId, topic.eventId);
  const allowed = new Set((await findEventLinkRows(input.organizationId, topic.eventId)).filter((context) => context.link.audience === "vendor").map((context) => context.link.id));
  const wanted = [...new Set(input.vendorLinkIds)];
  if (wanted.some((id) => !allowed.has(id))) throw new MessageNotFoundError();
  await replaceMessageTopicVendors(input.organizationId, topic.id, wanted);
}

async function teamAuthorName(organizationId: string): Promise<string> {
  return (await getOrganizationContact(appDatabase(), organizationId)).name || "—";
}

// Note interne (zone « Note interne ») : l'équipe seulement. Aucun e-mail, aucun push vers un lien.
export async function postInternalNote(input: { organizationId: string; eventId: string; topicId: string; userId: string; body: string; files?: MessageFileInput[] }): Promise<MessageView> {
  const topic = await messageTopicOf(input.organizationId, input.topicId, input.eventId);
  await assertEventWritableRow(input.organizationId, topic.eventId);
  return insertMessageRow({ organizationId: input.organizationId, topic, visibility: "internal", author: { kind: "team", userId: input.userId, name: await teamAuthorName(input.organizationId) }, body: input.body, files: input.files ?? [] });
}

// Message partagé (zone « Message aux clients ») : part aux destinataires nommés sur le bouton, et
// seulement si ce sont toujours eux (recipientsDigest). Chacun reçoit l'e-mail « Nouveau message sur
// <sujet> » (sans le contenu) et, s'il l'a activé, un push.
export async function postSharedMessage(input: { organizationId: string; eventId: string; topicId: string; userId: string; body: string; files?: MessageFileInput[]; recipientsDigest: string; now?: Date }): Promise<{ message: MessageView; notified: number }> {
  const topic = await messageTopicOf(input.organizationId, input.topicId, input.eventId);
  await assertEventWritableRow(input.organizationId, topic.eventId);
  const recipients = await messageRecipientRows(input.organizationId, topic, input.now);
  if (recipients.length === 0) throw new MessageInputError("no_recipients");
  if (messageRecipientsDigest(recipients) !== input.recipientsDigest) throw new MessageInputError("recipients_changed");
  const message = await insertMessageRow({ organizationId: input.organizationId, topic, visibility: "shared", author: { kind: "team", userId: input.userId, name: await teamAuthorName(input.organizationId) }, body: input.body, files: input.files ?? [] });
  const notified = await notifyMessageRecipients(input.organizationId, topic, message, recipients);
  return { message, notified };
}

async function notifyMessageRecipients(organizationId: string, topic: MessageTopicRow, message: MessageView, recipients: MessageRecipientRow[]): Promise<number> {
  const env = parseEnv(process.env);
  const vocabulary = (await findEventAudience(organizationId, topic.eventId)) ?? "couple";
  let notified = 0;
  for (const recipient of recipients) {
    const path = recipient.audience === "client" ? `/portail/messages/${topic.id}` : `/prestataire/messages/${topic.id}`;
    try {
      const values: EmailValues = {
        ...(await linkEmailValues({ organizationId, eventId: topic.eventId, audience: recipient.audience, personName: recipient.name, locale: recipient.locale, vocabulary, expiresOn: null })),
        topic: topic.name,
        link: `${env.APP_PUBLIC_URL}${path}`,
      };
      await sendOrganizationEmail({ organizationId, to: recipient.email, kind: "new_message", locale: recipient.locale, values, eventId: topic.eventId, idempotencyKey: `message:${message.id}:${recipient.linkId}` });
      notified += 1;
    } catch (error) {
      if (error instanceof MailQuotaExceededError) break;
      // Nom de l'erreur seulement : jamais d'adresse (SEC-20).
      console.error("e-mail « nouveau message » non parti", error instanceof Error ? error.name : "erreur");
    }
    if (recipient.audience === "client") await pushToLink(organizationId, recipient.linkId, { kind: "message", url: path, tag: `message-${topic.id}`, locale: recipient.locale });
  }
  return notified;
}

// Pour l'équipe : la pièce d'un message de cet évènement (un évènement hors de vue d'une Planner ne
// s'ouvre pas par l'identifiant d'une de ses pièces).
export async function getMessageAttachmentFile(organizationId: string, attachmentId: string, eventId: string): Promise<FileDownload> {
  const found = await findMessageAttachmentRow(organizationId, attachmentId);
  if (!found || found.row.eventId !== eventId) throw new MessageNotFoundError();
  return readMessageAttachmentFile(found.row);
}

// --- Côté lien (portail du client, espace du prestataire) ---

// Le lien, valable, et ses sujets : client avec la rubrique « Messages », ou prestataire (ses sujets).
async function messagingLinkAccess(organizationId: string, linkId: string): Promise<LinkAccess> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access) throw new LinkAccessDeniedError();
  if (access.audience === "client" && access.rights.rubrics.includes("messages")) return access;
  if (access.audience === "vendor") return access;
  throw new LinkAccessDeniedError();
}

async function linkVisibleTopic(access: LinkAccess, topicId: string): Promise<MessageTopicRow> {
  const topic = await findMessageTopicRow(access.organizationId, topicId);
  // Un sujet d'un autre évènement, un sujet sans message partagé (notes internes seulement) ou un sujet
  // où le prestataire n'est pas répond comme absent.
  if (!topic || topic.eventId !== access.eventId) throw new MessageNotFoundError();
  if (access.audience === "vendor" && !topic.vendorLinkIds.includes(access.linkId)) throw new MessageNotFoundError();
  if (!(await topicHasSharedMessage(access.organizationId, topic.id))) throw new MessageNotFoundError();
  return topic;
}

export async function listLinkMessageTopics(organizationId: string, linkId: string): Promise<LinkMessageTopic[]> {
  const access = await messagingLinkAccess(organizationId, linkId);
  return listLinkMessageTopicRows(organizationId, access.eventId, access.audience === "vendor" ? access.linkId : null);
}

export async function getLinkMessageThread(organizationId: string, linkId: string, topicId: string): Promise<LinkMessageThread> {
  const access = await messagingLinkAccess(organizationId, linkId);
  const topic = await linkVisibleTopic(access, topicId);
  const messagesOfTopic = await listMessageRows(organizationId, topic.id, { sharedOnly: true });
  return { id: topic.id, name: topic.name, messageCount: messagesOfTopic.length, lastMessageAt: messagesOfTopic.at(-1)?.createdAt ?? null, messages: messagesOfTopic };
}

// Réponse d'un lien : toujours partagée (aucun champ ne choisit la visibilité). L'équipe est prévenue
// (notification « message d'un client », lot 53, avec l'e-mail immédiat).
export async function postLinkMessage(input: { organizationId: string; linkId: string; topicId: string; body: string; files?: MessageFileInput[] }): Promise<MessageView> {
  const access = await messagingLinkAccess(input.organizationId, input.linkId);
  const topic = await linkVisibleTopic(access, input.topicId);
  return postLinkMessageTo(access, topic, input.body, input.files ?? []);
}

// Un client ouvre un sujet (« Nouveau sujet ») avec son premier message. Un prestataire n'en ouvre pas :
// il écrit dans les sujets où la planner l'a ajouté.
export async function startLinkMessageTopic(input: { organizationId: string; linkId: string; name: string; body: string; files?: MessageFileInput[] }): Promise<{ topicId: string; message: MessageView }> {
  const access = await messagingLinkAccess(input.organizationId, input.linkId);
  if (access.audience !== "client") throw new LinkAccessDeniedError();
  const summary = await insertMessageTopicRow(input.organizationId, access.eventId, input.name);
  const topic: MessageTopicRow = { id: summary.id, eventId: summary.eventId, name: summary.name, vendorLinkIds: [] };
  return { topicId: topic.id, message: await postLinkMessageTo(access, topic, input.body, input.files ?? []) };
}

async function postLinkMessageTo(access: LinkAccess, topic: MessageTopicRow, body: string, files: MessageFileInput[]): Promise<MessageView> {
  const message = await withActor({ kind: "link", id: access.linkId }, () =>
    insertMessageRow({ organizationId: access.organizationId, topic, visibility: "shared", author: { kind: "link", linkId: access.linkId, name: access.personName }, body, files }),
  );
  const event = await getEvent(access.organizationId, topic.eventId).catch(() => null);
  await notify({
    organizationId: access.organizationId,
    type: "client_message",
    eventId: topic.eventId,
    objectKey: message.id,
    params: { name: access.personName.slice(0, 200), topic: topic.name.slice(0, 200) },
    href: `/events/${topic.eventId}/messages/${topic.id}`,
    eventDate: event?.eventDate ?? null,
  }).catch((error: unknown) => console.error("notification « message d'un client » non créée", error instanceof Error ? error.name : "erreur"));
  return message;
}

// Une pièce jointe ouverte depuis un lien : seulement celle d'un message partagé d'un sujet qu'il voit ;
// toute autre (message interne compris) répond comme absente.
export async function getLinkMessageAttachmentFile(organizationId: string, linkId: string, attachmentId: string): Promise<FileDownload> {
  const access = await messagingLinkAccess(organizationId, linkId);
  const found = await findMessageAttachmentRow(organizationId, attachmentId);
  if (!found || found.visibility !== "shared") throw new MessageNotFoundError();
  await linkVisibleTopic(access, found.topicId);
  return readMessageAttachmentFile(found.row);
}

export function isValidMessageId(value: string): boolean {
  return isMessageId(value);
}

// --- Lot 55 (POR-11) — push du portail, facultatif, désactivé par défaut ---

const linkPushSubscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(80).max(100), auth: z.string().min(16).max(32) }),
});

export async function saveLinkPushSubscription(organizationId: string, linkId: string, input: unknown): Promise<void> {
  const access = await getLinkAccess(organizationId, linkId);
  if (!access || access.audience !== "client") throw new LinkAccessDeniedError();
  const parsed = linkPushSubscriptionSchema.safeParse(input);
  if (!parsed.success) throw new MessageInputError("body");
  await withActor({ kind: "link", id: linkId }, () =>
    withMessagesOrganization(appDatabase(), organizationId, (tx) =>
      tx
        .insert(linkPushSubscriptions)
        .values({ organizationId, linkId, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth })
        .onConflictDoUpdate({ target: [linkPushSubscriptions.organizationId, linkPushSubscriptions.endpoint], set: { linkId, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth } }),
    ),
  );
}

export async function removeLinkPushSubscription(organizationId: string, linkId: string, endpoint: string | null): Promise<void> {
  await withActor({ kind: "link", id: linkId }, () =>
    withMessagesOrganization(appDatabase(), organizationId, (tx) =>
      tx.delete(linkPushSubscriptions).where(endpoint ? andMessages(eqMessages(linkPushSubscriptions.linkId, linkId), eqMessages(linkPushSubscriptions.endpoint, endpoint)) : eqMessages(linkPushSubscriptions.linkId, linkId)),
    ),
  );
}

export async function countLinkPushSubscriptions(organizationId: string, linkId: string): Promise<number> {
  const rows = await withMessagesOrganization(appDatabase(), organizationId, (tx) => tx.select({ id: linkPushSubscriptions.id }).from(linkPushSubscriptions).where(eqMessages(linkPushSubscriptions.linkId, linkId)));
  return rows.length;
}

// Un push aux appareils du lien qui l'ont activé : la sorte seulement, jamais le contenu (SEC-20).
export async function pushToLink(organizationId: string, linkId: string, input: { kind: "message" | "decision"; url: string; tag: string; locale: "fr" | "en" }): Promise<number> {
  const subscriptions = await withMessagesOrganization(appDatabase(), organizationId, (tx) => tx.select().from(linkPushSubscriptions).where(eqMessages(linkPushSubscriptions.linkId, linkId)));
  if (subscriptions.length === 0) return 0;
  // Le texte vient des traductions (« LinkPush ») : la sorte seulement, dans la langue du lien.
  const t = createTranslator({ locale: input.locale, messages: input.locale === "en" ? enMessages : frMessages, namespace: "LinkPush" });
  const message: PushMessage = { title: t(`${input.kind}.title`), body: t(`${input.kind}.body`), url: input.url, tag: input.tag };
  const sender = getPushSender();
  let sent = 0;
  const gone: string[] = [];
  for (const subscription of subscriptions) {
    const outcome = await sender.send({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, message);
    if (outcome === "sent") sent += 1;
    if (outcome === "gone") gone.push(subscription.id);
  }
  const now = new Date();
  await withMessagesOrganization(appDatabase(), organizationId, async (tx) => {
    if (gone.length > 0) await tx.delete(linkPushSubscriptions).where(inArrayMessages(linkPushSubscriptions.id, gone));
    if (sent > 0) await tx.update(linkPushSubscriptions).set({ lastUsedAt: now }).where(andMessages(eqMessages(linkPushSubscriptions.linkId, linkId)));
  });
  return sent;
}

// Lot 55 (POR-11) : une décision demandée, annoncée aux appareils des clients qui la voient (la rubrique
// de sa sorte) et ont activé le push ; la sorte seulement, jamais le sujet.
const DECISION_RUBRIC: Record<DecisionKind, LinkRubric> = { option: "vendor_options", expense: "budget", program: "program" };

async function pushDecisionToClients(organizationId: string, eventId: string, kind: DecisionKind): Promise<number> {
  const now = new Date();
  let sent = 0;
  for (const context of await findEventLinkRows(organizationId, eventId)) {
    if (context.link.audience !== "client" || !usableLink(context, now) || !rightsOf(context).rubrics.includes(DECISION_RUBRIC[kind])) continue;
    sent += await pushToLink(organizationId, context.link.id, { kind: "decision", url: "/portail#decisions", tag: `decision-${eventId}`, locale: context.link.locale === "en" ? "en" : "fr" });
  }
  return sent;
}

// --- Rappel du jour J (lot 66b, JRJ-01, HUB-28, HUB-24 ; D2 à D4 ; ADR 0112) ---

export type DayReminderEvent = { id: string; eventDate: string; timeZone: string };

// Les évènements dont la date tombe entre from et to (inclus), qui peuvent recevoir un rappel : ni
// annulés, ni reportés, ni clos, ni d'essai, avec une date.
export async function listDayReminderEvents(organizationId: string, from: string, to: string): Promise<DayReminderEvent[]> {
  const rows = await findDayReminderEventRows(organizationId, from, to);
  return rows.filter((row) => !row.isDemo && row.eventDate !== null && !["cancelled", "postponed", "closed"].includes(row.status)).map((row) => ({ id: row.id, eventDate: row.eventDate!, timeZone: row.timeZone }));
}

// Les prestataires retenus sans lien d'espace actif : le carnet (module Prestataires) donne leur
// adresse à l'appelant ; ils reçoivent le rappel sans lien (D2).
export async function listDayReminderVendorsWithoutLink(organizationId: string, eventId: string, now: Date = new Date()): Promise<{ candidateId: string; vendorId: string; vendorSlotId: string }[]> {
  const [candidates, links] = await Promise.all([listCandidates(organizationId, eventId), listEventLinks(organizationId, eventId)]);
  const linked = new Set(links.filter((link) => link.audience === "vendor" && link.status === "active" && link.vendorCandidateId).map((link) => link.vendorCandidateId));
  void now;
  return candidates.filter((candidate) => ENGAGED_CANDIDATE_STATUSES.includes(candidate.status) && candidate.vendorId && !linked.has(candidate.id)).map((candidate) => ({ candidateId: candidate.id, vendorId: candidate.vendorId!, vendorSlotId: candidate.vendorSlotId }));
}

type DayReminderRecipient = { key: string; email: string; name: string; locale: "fr" | "en"; vendorSlotId?: string };

function programLines(items: ProgramItem[], vendorSlotId: string | null, locale: "fr" | "en"): string {
  const shown = vendorSlotId ? items.filter((item) => item.participants.some((participant) => participant.vendorSlotId === vendorSlotId)) : items;
  const t = emailTranslator(locale);
  if (shown.length === 0) return t("dayReminder.noProgram");
  return [...shown]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((item) => `- ${item.startTime}${item.endTime ? `–${item.endTime}` : ""} ${item.label}${item.location ? ` — ${item.location}` : ""}`)
    .join("\n");
}

// Compose et envoie le rappel d'un évènement à une cible ; une fois par personne (clé de la file).
// extraVendors : les prestataires retenus sans lien, avec l'adresse du carnet (lot 66b, D2).
export async function sendDayReminder(input: { organizationId: string; eventId: string; target: "planner" | "vendors" | "team" | "clients"; now?: Date; extraVendors?: { candidateId: string; vendorSlotId: string; email: string; name: string }[] }): Promise<number> {
  const { organizationId, eventId, target } = input;
  const now = input.now ?? new Date();
  const found = await findEventById(organizationId, eventId);
  if (!found?.event.eventDate) return 0;
  const organizationLocale = await getOrganizationLanguage(appDatabase(), organizationId);
  const vocabulary = (await findEventAudience(organizationId, eventId)) ?? "couple";
  const [program, contacts, places, slots] = await Promise.all([getEventProgram(organizationId, eventId), listEventDayContacts(organizationId, eventId), listEventPlaces(organizationId, eventId), listEventVendorSlots(organizationId, eventId)]);
  const recipients: DayReminderRecipient[] = [];
  if (target === "planner" || target === "team") {
    // La planner : la personne en charge de l'évènement, sinon la titulaire (comme les alertes) ;
    // l'équipe du jour : les autres membres de l'équipe de l'évènement.
    const planners = await notificationRecipients(organizationId, eventId);
    const team = (await listTeam(appDatabase(), organizationId)).filter((member) => !member.disabledAt);
    const userIds = target === "planner" ? planners : (await listEventTeam(organizationId, eventId)).map((member) => member.userId).filter((userId) => !planners.includes(userId));
    for (const userId of userIds) {
      const member = team.find((candidate) => candidate.id === userId);
      if (!member) continue;
      const contact = await getUserContact(appDatabase(), organizationId, userId);
      const locale = contact?.language ?? organizationLocale;
      // Le prénom : celui de sa signature (lot 66c), sinon « Bonjour à vous ».
      const displayName = (await getMemberSignature(organizationId, userId).catch(() => null))?.displayName?.trim();
      recipients.push({ key: userId, email: contact?.email ?? member.email, name: displayName ? displayName.split(/\s+/)[0]! : emailTranslator(locale)("dayReminder.noName"), locale });
    }
  }
  const links = target === "clients" || target === "vendors" || target === "team" ? await listEventLinks(organizationId, eventId) : [];
  if (target === "team") {
    // Les renforts du jour J (lot 52) : leur lien personnel, reçu à part, ouvre le jour J.
    for (const link of links.filter((candidate) => candidate.audience === "day_helper" && candidate.status === "active")) recipients.push({ key: link.id, email: link.email, name: link.personName, locale: organizationLocale });
  }
  if (target === "clients") {
    for (const link of links.filter((candidate) => candidate.audience === "client" && candidate.status === "active")) recipients.push({ key: link.id, email: link.email, name: link.personName, locale: organizationLocale });
  }
  if (target === "vendors") {
    const candidates = await listCandidates(organizationId, eventId);
    for (const link of links.filter((candidate) => candidate.audience === "vendor" && candidate.status === "active" && candidate.vendorCandidateId)) {
      const candidate = candidates.find((row) => row.id === link.vendorCandidateId);
      if (!candidate || !ENGAGED_CANDIDATE_STATUSES.includes(candidate.status)) continue;
      recipients.push({ key: candidate.id, email: link.email, name: link.personName, locale: organizationLocale, vendorSlotId: candidate.vendorSlotId });
    }
    for (const vendor of input.extraVendors ?? []) recipients.push({ key: vendor.candidateId, email: vendor.email, name: vendor.name, locale: organizationLocale, vendorSlotId: vendor.vendorSlotId });
  }
  const kind = target === "planner" ? "day_reminder_planner" : target === "vendors" ? "day_reminder_vendor" : target === "team" ? "day_reminder_team" : "day_reminder_client";
  const clients = eventNames(found.clients.filter((client) => client.firstName.trim()), found.event.name);
  let sent = 0;
  for (const recipient of recipients) {
    if (!recipient.email) continue;
    const t = emailTranslator(recipient.locale);
    const audience = target === "vendors" ? "vendor" : "client";
    const values: EmailValues = {
      ...(await linkEmailValues({ organizationId, eventId, audience, personName: recipient.name, locale: recipient.locale, vocabulary, expiresOn: null })),
      clients,
      program: programLines(program.items, recipient.vendorSlotId ?? null, recipient.locale),
      day_contacts: contacts.length > 0 ? contacts.map((contact) => `- ${contact.name}${contact.role ? ` (${contact.role})` : ""} : ${contact.phone}`).join("\n") : t("dayReminder.noContacts"),
      place: places[0] ? [places[0].label, places[0].address].filter(Boolean).join(", ") : t("dayReminder.placeUnknown"),
      ...(recipient.vendorSlotId ? { slot: slots.find((slot) => slot.id === recipient.vendorSlotId)?.label ?? "" } : {}),
      ...(target === "planner"
        ? {
            open_items: dayReminderOpenItems(slots, await listEventTasks(organizationId, eventId), found.event.eventDate, recipient.locale),
            link: `${parseEnv(process.env).APP_PUBLIC_URL}/jour-j/${eventId}`,
          }
        : {}),
    };
    try {
      await sendOrganizationEmail({ organizationId, to: recipient.email, kind, locale: recipient.locale, values, idempotencyKey: `day-reminder:${eventId}:${target}:${recipient.key}`, eventId, reserve: false });
      sent += 1;
    } catch (error) {
      console.error(`rappel du jour J non envoyé (évènement ${eventId}, cible ${target})`, error instanceof Error ? error.name : "inconnue");
    }
  }
  void now;
  return sent;
}

const SETTLED_DAY_REMINDER_STATUSES = new Set<string>(["retained", "contract_signed", "paid_off", "not_required"]);

// Ce qui reste ouvert pour la planner : postes sans prestataire retenu, tâches de la planner non faites
// à échéance de l'évènement.
function dayReminderOpenItems(slots: { label: string; status: string }[], tasks: EventTask[], eventDate: string, locale: "fr" | "en"): string {
  const t = emailTranslator(locale);
  const lines = [
    ...slots.filter((slot) => !SETTLED_DAY_REMINDER_STATUSES.has(slot.status)).map((slot) => `- ${t("dayReminder.slotOpen", { slot: slot.label })}`),
    ...tasks.filter((task) => !task.done && task.responsible === "planner" && task.dueDate <= eventDate).map((task) => `- ${task.label}`),
  ];
  return lines.length > 0 ? lines.slice(0, 20).join("\n") : t("dayReminder.nothingOpen");
}

// Lot 70e (A14) : la source et un client de plus, complétés depuis la fiche.
export { addEventClient, EventClientsFullError, InvalidProspectSourceError, setEventProspectSource } from "./event-origin";

// Lot 73a (PRE-02, BUD-01, PRE-05, UX-07 ; spécification du lot 73, § 4.2 ; P7, P12) : ajouter un
// prestataire du carnet à un mariage (« En comparaison », « Retenu », « Remplacer », « Retenir aussi »),
// l'annuler, les évènements proposés, les mariages à venir où une fiche est retenue, « Annuler » une
// relance ; la correspondance calculée entre un poste et un métier.
export { addVendorToEventSlot, listEventsForVendorAddition, listUpcomingRetainedEventsByVendor, undoVendorAddition, undoVendorReminder, VENDOR_UNDO_GRACE_SECONDS } from "./vendor-addition";
export { matchSlotToVendorType, proposeSlotForVendorType, proposeVendorTypeForSlot, type SlotMatchCatalog, type SlotVendorMatch } from "./vendor-slot-match";
export type { TemplatePastDueAnswer } from "./repository";
