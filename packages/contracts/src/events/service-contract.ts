// Interface du service.ts d'events (SOC-06) — pensée comme le futur
// contrat HTTP /v1/events si ce module est extrait en app autonome (ADR
// 0011). apps/symbola vérifie que le vrai module satisfait ce type (test
// de contrat, apps/symbola/modules/events/service.contract.test.ts).
import type { FileDownload } from "../file-download";
import type { MonthlyCount } from "../usage";
import type { EventsSearchResults } from "../search";
export type EventStatus = "prospect" | "quote_sent" | "confirmed" | "done" | "lost";

export type EventClient = {
  id: string;
  firstName: string;
  lastName: string | null;
  position: number;
} & EventClientContact;

// Lot 14 (décision I) — coordonnées d'un client de l'événement (données
// personnelles, registre RGPD).
export type EventClientContact = {
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
};

export type EventClientInput = {
  firstName: string;
  lastName?: string | null;
} & Partial<EventClientContact>;

// Lot 13 (L13-EVT-19) — date (AAAA-MM-JJ, Paris) du dernier passage dans chaque statut.
export type EventStatusDates = Partial<Record<EventStatus, string>>;

// Lot 13 (L13-HUB-15) — prospect sans nouvelle, pour le bloc « À traiter ».
export type StaleProspect = { eventId: string; names: string; lastUpdateAt: Date; daysSince: number };

export type EventSummary = {
  id: string;
  status: EventStatus;
  eventDate: string | null;
  venueName: string | null;
  venueCity: string | null;
  clients: EventClient[];
  // AIDE-02 : événement fictif d'un essai guidé.
  isDemo: boolean;
};

export type EventDetail = EventSummary & {
  prospectSourceId: string | null;
  // Lot 16 (ADR 0045) : type de l'événement ; nul pour un événement d'avant le
  // lot 16 (le vocabulaire suit alors le métier de l'organisation).
  eventTypeId: string | null;
  lossReasonId: string | null;
  lossReasonNote: string | null;
  // PRD-EVT-04 : date pour laquelle les échéances ont été calculées.
  tasksScheduledFor: string | null;
  // Lot 5 (IMP-04) : colonnes d'un fichier importé gardées en champ libre.
  importedFields?: Record<string, string>;
  // Lot 14 (décision K) : budget souhaité par les clients, en centimes.
  wantedBudgetCents: number | null;
};

export type ListEventsInput = {
  organizationId: string;
  statusIn?: EventStatus[] | undefined;
  year?: number | undefined;
  search?: string | undefined;
  // PRD-EVT-07 : la source est filtrable dans la liste.
  prospectSourceId?: string | undefined;
};

export type CreateProspectInput = {
  organizationId: string;
  createdByUserId: string;
  clients: EventClientInput[];
  prospectSourceId: string;
  // Lot 16 (ADR 0045) : un type de l'organisation.
  eventTypeId?: string | null | undefined;
  eventDate?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
};

export type CreateProspectResult = {
  id: string;
};

export type ChangeEventStatusInput = {
  organizationId: string;
  eventId: string;
  changedByUserId: string;
  toStatus: EventStatus;
  lossReasonId?: string | null;
  lossReasonNote?: string | null;
};

// Lot 16 (ADR 0045) — type d'un événement (mariage, séminaire…), liste propre
// à l'organisation. Il dit qui sont les clients, et donc le vocabulaire des
// écrans de l'événement : « les mariés » (couple) ou « le client » (clients).
export type EventTypeAudience = "couple" | "clients";

export type EventType = {
  id: string;
  label: string;
  audience: EventTypeAudience;
  position: number;
  starterKey: string | null;
};

export type EventTypeInput = { label: string; audience: EventTypeAudience };

// Types de départ (packages/starter-templates), déjà traduits.
export type StarterEventTypeInput = { key: string; label: string; audience: EventTypeAudience };

export type ProspectSource = {
  id: string;
  label: string;
};

export type LossReason = {
  id: string;
  label: string;
  isFreeText: boolean;
};

// PRD-EVT-03 — postes prestataires.
export type VendorSlotStatus = "to_find" | "quote_requested" | "quote_received" | "booked" | "not_required";

export type DefaultVendorSlot = {
  id: string;
  label: string;
  // Lot 12 (L12-EVT-14/17) : icône de la ligne du budget, ou null (initiales).
  icon: string | null;
  position: number;
};

export type EventVendorSlot = {
  id: string;
  eventId: string;
  label: string;
  status: VendorSlotStatus;
  vendorName: string | null;
  amountCents: number | null;
  currency: "EUR";
  position: number;
  // Lot 5 (IMP-04) : champs libres d'un import.
  importedFields?: Record<string, string>;
  // Lot 11 (L11-EVT-10) : ce que veulent les clients, consulté retenu.
  brief: string | null;
  selectedCandidateId: string | null;
  icon: string | null;
};

// Lot 12 (L12-EVT-15) — lieux d'un événement, saisis une fois.
export type EventPlace = { id: string; eventId: string; label: string; address: string | null; vendorId: string | null };

// Lot 11 (L11-EVT-10 / L11-EVT-11) — prestataires consultés pour un poste.
export type VendorCandidateResponse = "contacted" | "quote_received" | "declined";
export type VendorCandidateNote = { id: string; body: string; visibleToClients: boolean; createdAt: string };
export type VendorCandidate = {
  id: string;
  eventId: string;
  vendorSlotId: string;
  // Fiche du carnet (module vendors), null en saisie libre.
  vendorId: string | null;
  vendorName: string;
  response: VendorCandidateResponse;
  contactedOn: string | null;
  quoteAmountCents: number | null;
  currency: "EUR";
  hasQuoteFile: boolean;
  shownToClients: boolean;
  // Lot 12 (L12-EVT-16) : RIB de la fiche du carnet partagé aux clients.
  shareRibWithClients: boolean;
  // Déduit du poste : retenu, non retenu (un autre l'est), ou null.
  outcome: "selected" | "not_selected" | null;
  notes: VendorCandidateNote[];
};
export type AddVendorCandidateInput = {
  organizationId: string;
  eventId: string;
  vendorSlotId: string;
  vendorName: string;
  vendorId?: string | null;
};
export type UpdateVendorCandidateInput = {
  organizationId: string;
  candidateId: string;
  response?: VendorCandidateResponse;
  contactedOn?: string | null;
  quoteAmountCents?: number | null;
  shownToClients?: boolean;
  shareRibWithClients?: boolean;
};
// L11-PRE-09 — consultations d'une fiche du carnet, pour son historique.
export type VendorConsultation = {
  eventId: string;
  eventNames: string;
  eventDate: string | null;
  slotId: string;
  slotLabel: string;
  outcome: "selected" | "not_selected" | "pending";
  quotedCents: number | null;
};
// L11-EVT-11 — options montrées aux clients, par poste.
export type ClientVendorOption = { candidateId: string; vendorName: string; quoteAmountCents: number | null; hasQuoteFile: boolean; notes: string[]; ribShared: boolean };
export type ClientVendorSlotOptions = { slotLabel: string; options: ClientVendorOption[] };

export type UpdateEventVendorSlotInput = {
  organizationId: string;
  vendorSlotId: string;
  changedByUserId: string;
  status: VendorSlotStatus;
  // Obligatoire quand le statut est « booked » (PRD PRD-EVT-03).
  vendorName?: string | null | undefined;
  amountCents?: number | null | undefined;
};

export type VendorSlotProgress = {
  booked: number;
  required: number;
};

// PRD-EVT-04 — rétroplanning.
export type TaskResponsible = "planner" | "clients";

export type TaskTemplateItem = {
  id: string;
  label: string;
  // Décalage en jours par rapport à la date de l'événement (J-365 = -365).
  offsetDays: number;
  responsible: TaskResponsible;
  position: number;
};

export type TaskTemplate = {
  id: string;
  name: string;
  items: TaskTemplateItem[];
};

export type TaskTemplateItemInput = {
  label: string;
  offsetDays: number;
  responsible: TaskResponsible;
};

export type EventTask = {
  id: string;
  eventId: string;
  label: string;
  dueDate: string;
  responsible: TaskResponsible;
  done: boolean;
  position: number;
  // Lot 5 (IMP-04) : champs libres d'un import.
  importedFields?: Record<string, string>;
};

export type EventTaskInput = {
  label: string;
  dueDate: string;
  responsible: TaskResponsible;
};

// PRD-HUB-02 — tâche vue depuis l'accueil ou l'écran Tâches, avec son événement.
export type OrganizationTask = EventTask & {
  overdue: boolean;
  event: { id: string; names: string; eventDate: string | null; status: EventStatus; isDemo: boolean };
};

export type ListOrganizationTasksInput = {
  organizationId: string;
  // Date du jour (Europe/Paris), « AAAA-MM-JJ » : retards et horizon.
  today: string;
  // Échéance au plus tard dans N jours (retards compris) ; null = sans limite.
  horizonDays: number | null;
  includeDone?: boolean;
};

export type UpdateEventTaskInput = {
  organizationId: string;
  taskId: string;
  label?: string | undefined;
  dueDate?: string | undefined;
  responsible?: TaskResponsible | undefined;
  done?: boolean | undefined;
};

export type TaskRecalculation = {
  pending: boolean;
  // Écart en jours entre l'ancienne et la nouvelle date de l'événement.
  shiftDays: number;
  undoneTasks: number;
};

// PRD-EVT-05 — programme du jour J.
export type ProgramParticipant = {
  // Poste prestataire de l'événement (PRD-EVT-03), ou nul pour un intervenant libre.
  vendorSlotId: string | null;
  label: string;
};

export type ProgramItem = {
  id: string;
  eventId: string;
  // « HH:MM » ; une heure de fin antérieure au début = après minuit.
  startTime: string;
  endTime: string | null;
  label: string;
  location: string | null;
  internalNote: string | null;
  participants: ProgramParticipant[];
};

export type ProgramItemInput = {
  startTime: string;
  endTime?: string | null | undefined;
  label: string;
  location?: string | null | undefined;
  internalNote?: string | null | undefined;
  vendorSlotIds: string[];
  freeParticipants: string[];
};

export type ProgramOverlap = { participant: string; itemIds: [string, string] };

export type EventProgram = {
  items: ProgramItem[];
  overlaps: ProgramOverlap[];
  // Date de version du PDF : dernière modification du programme (ISO 8601).
  updatedAt: string | null;
};

export type ProgramTemplateItem = {
  id: string;
  startTime: string;
  endTime: string | null;
  label: string;
  location: string | null;
  participantLabels: string[];
  position: number;
};

export type ProgramTemplate = { id: string; name: string; items: ProgramTemplateItem[] };

export type ProgramTemplateItemInput = {
  startTime: string;
  endTime?: string | null | undefined;
  label: string;
  location?: string | null | undefined;
  participantLabels: string[];
};

// PRD-EVT-06 — accès des mariés.
export type ClientAccessStatus = "invited" | "active" | "expired" | "revoked";

export type EventClientAccess = {
  id: string;
  eventId: string;
  email: string;
  status: ClientAccessStatus;
  createdAt: string;
};

export type InviteEventClientInput = {
  organizationId: string;
  eventId: string;
  email: string;
  invitedByUserId: string;
  // Langue de l'e-mail d'invitation.
  locale: "fr" | "en";
  // Lot 16 (ADR 0045) : vocabulaire de l'e-mail (« votre mariage » ou « votre
  // événement ») ; à défaut, celui du type de l'événement, sinon les mariés.
  audience?: EventTypeAudience | undefined;
};

export type InviteEventClientResult = {
  access: EventClientAccess;
  // Nul quand l'e-mail a déjà un compte marié dans l'organisation : l'accès
  // est ouvert directement, sans création de compte.
  invitationToken: string | null;
};

export type AcceptClientInvitationResult =
  | { outcome: "invalid_or_expired" }
  | { outcome: "already_accepted" }
  | { outcome: "success"; email: string };

// Vue du marié : jamais de note interne (programme en variante « mariés »).
export type ClientEventView = {
  event: EventSummary;
  tasks: EventTask[];
  program: EventProgram;
};

export type EventActivityKind = "task_done" | "task_undone";

export type EventActivity = {
  id: string;
  kind: EventActivityKind;
  taskLabel: string;
  // E-mail du marié tel qu'invité par la planner (null si l'accès a disparu).
  actorEmail: string | null;
  createdAt: string;
};

// AIDE-02 — essai guidé du module.
export type EventsTrial = { eventId: string; expiresAt: string };

export type StartEventsTrialInput = {
  organizationId: string;
  userId: string;
  locale: "fr" | "en";
  now?: Date | undefined;
};

export interface EventsServiceContract {
  listEvents(input: ListEventsInput): Promise<EventSummary[]>;
  listStaleProspects(organizationId: string, days: number, now?: Date): Promise<StaleProspect[]>;
  getEvent(organizationId: string, eventId: string): Promise<EventDetail | null>;
  createProspect(input: CreateProspectInput): Promise<CreateProspectResult>;
  changeEventStatus(input: ChangeEventStatusInput): Promise<void>;
  listProspectSources(organizationId: string): Promise<ProspectSource[]>;
  // Lot 16 (ADR 0045) — types d'événement.
  listEventTypes(organizationId: string): Promise<EventType[]>;
  // Installe les types de départ qui manquent (par leur clé) ; renvoie le nombre ajouté.
  addStarterEventTypes(organizationId: string, types: StarterEventTypeInput[]): Promise<number>;
  createEventType(organizationId: string, input: EventTypeInput): Promise<EventType>;
  updateEventType(organizationId: string, eventTypeId: string, input: EventTypeInput): Promise<void>;
  // Un type utilisé demande un type de remplacement ; le dernier type ne se supprime pas.
  removeEventType(organizationId: string, eventTypeId: string, moveEventsTo: string | null): Promise<void>;
  countEventsByType(organizationId: string): Promise<Record<string, number>>;
  setEventType(organizationId: string, eventId: string, eventTypeId: string): Promise<void>;
  // Qui sont les clients de cet événement ; nul s'il n'a pas de type.
  getEventAudience(organizationId: string, eventId: string): Promise<EventTypeAudience | null>;
  // Lot 20 : celui de chaque événement de l'organisation (écrans qui en mêlent plusieurs).
  listEventAudiences(organizationId: string): Promise<Map<string, EventTypeAudience | null>>;
  createProspectSource(organizationId: string, label: string): Promise<ProspectSource>;
  listLossReasons(organizationId: string): Promise<LossReason[]>;
  createLossReason(organizationId: string, label: string, isFreeText: boolean): Promise<LossReason>;
  // PRD-EVT-07 — listes de départ : ajout sans doublon, renvoie le nombre ajouté.
  addProspectSources(organizationId: string, labels: string[]): Promise<number>;
  addLossReasons(organizationId: string, reasons: { label: string; isFreeText: boolean }[]): Promise<number>;
  listOrganizationTasks(input: ListOrganizationTasksInput): Promise<OrganizationTask[]>;
  listDefaultVendorSlots(organizationId: string): Promise<DefaultVendorSlot[]>;
  addDefaultVendorSlots(organizationId: string, entries: (string | { label: string; icon?: string | null })[]): Promise<DefaultVendorSlot[]>;
  removeDefaultVendorSlot(organizationId: string, defaultVendorSlotId: string): Promise<void>;
  // Lot 13 (L13-HUB-16) — nouvel ordre : exactement les lignes de l'organisation.
  reorderDefaultVendorSlots(organizationId: string, orderedIds: string[]): Promise<void>;
  listEventVendorSlots(organizationId: string, eventId: string): Promise<EventVendorSlot[]>;
  addEventVendorSlot(organizationId: string, eventId: string, label: string): Promise<EventVendorSlot>;
  updateEventVendorSlot(input: UpdateEventVendorSlotInput): Promise<EventVendorSlot>;
  removeEventVendorSlot(organizationId: string, vendorSlotId: string): Promise<void>;
  setVendorSlotBrief(organizationId: string, vendorSlotId: string, brief: string | null): Promise<void>;
  listEventPlaces(organizationId: string, eventId: string): Promise<EventPlace[]>;
  addEventPlace(organizationId: string, eventId: string, input: { label: string; address?: string | null; vendorId?: string | null }): Promise<EventPlace>;
  removeEventPlace(organizationId: string, eventId: string, placeId: string): Promise<void>;
  listVendorCandidates(organizationId: string, eventId: string): Promise<VendorCandidate[]>;
  addVendorCandidate(input: AddVendorCandidateInput): Promise<VendorCandidate>;
  updateVendorCandidate(input: UpdateVendorCandidateInput): Promise<void>;
  linkVendorCandidate(organizationId: string, candidateId: string, vendorId: string): Promise<void>;
  removeVendorCandidate(organizationId: string, candidateId: string): Promise<void>;
  attachVendorCandidateQuote(input: { organizationId: string; candidateId: string; content: Uint8Array }): Promise<void>;
  getVendorCandidateQuoteFile(organizationId: string, candidateId: string): Promise<FileDownload>;
  addVendorCandidateNote(input: { organizationId: string; candidateId: string; body: string; visibleToClients: boolean; createdByUserId: string }): Promise<void>;
  setVendorCandidateNoteVisibility(organizationId: string, noteId: string, visibleToClients: boolean): Promise<void>;
  removeVendorCandidateNote(organizationId: string, noteId: string): Promise<void>;
  selectVendorCandidate(input: { organizationId: string; candidateId: string; changedByUserId: string }): Promise<void>;
  listVendorConsultations(organizationId: string, vendorId: string): Promise<VendorConsultation[]>;
  listSelectedVendorIds(organizationId: string): Promise<string[]>;
  getClientVendorOptions(organizationId: string, userId: string, eventId: string): Promise<ClientVendorSlotOptions[]>;
  getClientVendorQuoteFile(organizationId: string, userId: string, eventId: string, candidateId: string): Promise<FileDownload>;
  getClientSharedRibVendorId(organizationId: string, userId: string, eventId: string, candidateId: string): Promise<string>;
  listTaskTemplates(organizationId: string): Promise<TaskTemplate[]>;
  createTaskTemplate(organizationId: string, name: string, items: TaskTemplateItemInput[]): Promise<TaskTemplate>;
  addTaskTemplateItem(organizationId: string, templateId: string, item: TaskTemplateItemInput): Promise<TaskTemplateItem>;
  // Lot 21 (L21-EVT-22) : modifier une ligne, renommer un modèle.
  updateTaskTemplateItem(organizationId: string, itemId: string, item: TaskTemplateItemInput): Promise<TaskTemplateItem>;
  renameTaskTemplate(organizationId: string, templateId: string, name: string): Promise<void>;
  removeTaskTemplateItem(organizationId: string, itemId: string): Promise<void>;
  removeTaskTemplate(organizationId: string, templateId: string): Promise<void>;
  changeEventDate(organizationId: string, eventId: string, eventDate: string | null): Promise<TaskRecalculation>;
  getTaskRecalculation(organizationId: string, eventId: string): Promise<TaskRecalculation>;
  resolveTaskRecalculation(organizationId: string, eventId: string, accept: boolean): Promise<void>;
  applyTaskTemplate(organizationId: string, eventId: string, templateId: string): Promise<EventTask[]>;
  listEventTasks(organizationId: string, eventId: string): Promise<EventTask[]>;
  addEventTask(organizationId: string, eventId: string, task: EventTaskInput): Promise<EventTask>;
  updateEventTask(input: UpdateEventTaskInput): Promise<EventTask>;
  moveEventTask(organizationId: string, taskId: string, direction: "up" | "down"): Promise<void>;
  removeEventTask(organizationId: string, taskId: string): Promise<void>;
  getEventProgram(organizationId: string, eventId: string): Promise<EventProgram>;
  addProgramItem(organizationId: string, eventId: string, item: ProgramItemInput): Promise<ProgramItem>;
  updateProgramItem(organizationId: string, itemId: string, item: ProgramItemInput): Promise<ProgramItem>;
  removeProgramItem(organizationId: string, itemId: string): Promise<void>;
  listProgramTemplates(organizationId: string): Promise<ProgramTemplate[]>;
  createProgramTemplate(organizationId: string, name: string, items: ProgramTemplateItemInput[]): Promise<ProgramTemplate>;
  addProgramTemplateItem(
    organizationId: string,
    templateId: string,
    item: ProgramTemplateItemInput,
  ): Promise<ProgramTemplateItem>;
  // Lot 21 (L21-EVT-21) : modifier une ligne, renommer un modèle.
  updateProgramTemplateItem(organizationId: string, itemId: string, item: ProgramTemplateItemInput): Promise<ProgramTemplateItem>;
  renameProgramTemplate(organizationId: string, templateId: string, name: string): Promise<void>;
  removeProgramTemplateItem(organizationId: string, itemId: string): Promise<void>;
  removeProgramTemplate(organizationId: string, templateId: string): Promise<void>;
  applyProgramTemplate(organizationId: string, eventId: string, templateId: string): Promise<ProgramItem[]>;
  inviteEventClient(input: InviteEventClientInput): Promise<InviteEventClientResult>;
  listEventClientAccesses(organizationId: string, eventId: string): Promise<EventClientAccess[]>;
  revokeEventClientAccess(organizationId: string, accessId: string): Promise<void>;
  acceptEventClientInvitation(token: string, password: string): Promise<AcceptClientInvitationResult>;
  listClientEvents(organizationId: string, userId: string): Promise<EventSummary[]>;
  getClientEventView(organizationId: string, userId: string, eventId: string): Promise<ClientEventView>;
  setClientTaskDone(organizationId: string, userId: string, taskId: string, done: boolean): Promise<EventTask>;
  listEventActivity(organizationId: string, eventId: string): Promise<EventActivity[]>;
  getEventStatusDates(organizationId: string, eventId: string): Promise<EventStatusDates>;
  startEventsTrial(input: StartEventsTrialInput): Promise<EventsTrial>;
  getActiveEventsTrial(organizationId: string, now?: Date): Promise<EventsTrial | null>;
  endEventsTrial(organizationId: string, eventId: string): Promise<void>;
  purgeExpiredDemoEvents(organizationId: string, now?: Date): Promise<number>;
  hasRealEvents(organizationId: string): Promise<boolean>;
  // Lot 9 (ADR 0029) — statistiques d'usage pour l'Admin, essais exclus.
  countEventsCreatedByMonth(organizationIds: string[], since: Date): Promise<Record<string, MonthlyCount[]>>;
  // Lot 10 (AIDE-08) — recherche globale, essais exclus.
  searchEvents(organizationId: string, words: string[], limit: number): Promise<EventsSearchResults>;
  getEventNamesByIds(organizationId: string, eventIds: string[]): Promise<Record<string, string>>;
  // Lot 10 (AIDE-06) — événement fictif d'un tutoriel.
  startTutorialEvent(input: StartEventsTrialInput & { tutorialKey: string }): Promise<EventsTrial & { kind: string }>;
  listExpiredDemoEvents(organizationIds: string[], now?: Date): Promise<{ organizationId: string; eventId: string }[]>;
  // Lot 3 (PRD-BUD-04) : vérifie qu'un compte marié a accès à l'événement avant
  // de lui montrer son budget en lecture seule. Extension additive du
  // contrat — la fonction existait déjà côté repository, utilisée en
  // interne par getClientEventView ; seule son exposition est nouvelle.
  hasActiveClientAccess(organizationId: string, userId: string, eventId: string): Promise<boolean>;
}
