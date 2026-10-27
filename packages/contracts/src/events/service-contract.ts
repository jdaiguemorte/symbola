// Interface du service.ts d'events (SOC-06) — pensée comme le futur
// contrat HTTP /v1/events si ce module est extrait en app autonome (ADR
// 0011). apps/symbola vérifie que le vrai module satisfait ce type (test
// de contrat, apps/symbola/modules/events/service.contract.test.ts).
export type EventStatus = "prospect" | "quote_sent" | "confirmed" | "done" | "lost";

export type EventClient = {
  id: string;
  firstName: string;
  lastName: string | null;
  position: number;
};

export type EventClientInput = {
  firstName: string;
  lastName?: string | null;
};

export type EventSummary = {
  id: string;
  status: EventStatus;
  eventDate: string | null;
  venueName: string | null;
  venueCity: string | null;
  clients: EventClient[];
};

export type EventDetail = EventSummary & {
  prospectSourceId: string | null;
  lossReasonId: string | null;
  lossReasonNote: string | null;
  // EVT-04 : date pour laquelle les échéances ont été calculées.
  tasksScheduledFor: string | null;
};

export type ListEventsInput = {
  organizationId: string;
  statusIn?: EventStatus[] | undefined;
  year?: number | undefined;
  search?: string | undefined;
  // EVT-07 : la source est filtrable dans la liste.
  prospectSourceId?: string | undefined;
};

export type CreateProspectInput = {
  organizationId: string;
  createdByUserId: string;
  clients: EventClientInput[];
  prospectSourceId: string;
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

export type ProspectSource = {
  id: string;
  label: string;
};

export type LossReason = {
  id: string;
  label: string;
  isFreeText: boolean;
};

// EVT-03 — postes prestataires.
export type VendorSlotStatus = "to_find" | "quote_requested" | "quote_received" | "booked" | "not_required";

export type DefaultVendorSlot = {
  id: string;
  label: string;
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
};

export type UpdateEventVendorSlotInput = {
  organizationId: string;
  vendorSlotId: string;
  changedByUserId: string;
  status: VendorSlotStatus;
  // Obligatoire quand le statut est « booked » (PRD EVT-03).
  vendorName?: string | null | undefined;
  amountCents?: number | null | undefined;
};

export type VendorSlotProgress = {
  booked: number;
  required: number;
};

// EVT-04 — rétroplanning.
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
};

export type EventTaskInput = {
  label: string;
  dueDate: string;
  responsible: TaskResponsible;
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

// EVT-05 — programme du jour J.
export type ProgramParticipant = {
  // Poste prestataire de l'événement (EVT-03), ou nul pour un intervenant libre.
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

// EVT-06 — accès des mariés.
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

export interface EventsServiceContract {
  listEvents(input: ListEventsInput): Promise<EventSummary[]>;
  getEvent(organizationId: string, eventId: string): Promise<EventDetail | null>;
  createProspect(input: CreateProspectInput): Promise<CreateProspectResult>;
  changeEventStatus(input: ChangeEventStatusInput): Promise<void>;
  listProspectSources(organizationId: string): Promise<ProspectSource[]>;
  createProspectSource(organizationId: string, label: string): Promise<ProspectSource>;
  listLossReasons(organizationId: string): Promise<LossReason[]>;
  createLossReason(organizationId: string, label: string, isFreeText: boolean): Promise<LossReason>;
  listDefaultVendorSlots(organizationId: string): Promise<DefaultVendorSlot[]>;
  addDefaultVendorSlots(organizationId: string, labels: string[]): Promise<DefaultVendorSlot[]>;
  removeDefaultVendorSlot(organizationId: string, defaultVendorSlotId: string): Promise<void>;
  listEventVendorSlots(organizationId: string, eventId: string): Promise<EventVendorSlot[]>;
  addEventVendorSlot(organizationId: string, eventId: string, label: string): Promise<EventVendorSlot>;
  updateEventVendorSlot(input: UpdateEventVendorSlotInput): Promise<EventVendorSlot>;
  removeEventVendorSlot(organizationId: string, vendorSlotId: string): Promise<void>;
  listTaskTemplates(organizationId: string): Promise<TaskTemplate[]>;
  createTaskTemplate(organizationId: string, name: string, items: TaskTemplateItemInput[]): Promise<TaskTemplate>;
  addTaskTemplateItem(organizationId: string, templateId: string, item: TaskTemplateItemInput): Promise<TaskTemplateItem>;
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
}
