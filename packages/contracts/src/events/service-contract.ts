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

// Lot 28a (PRE-02, décisions Q9 et D3, ADR 0054) — statut d'un prestataire
// rattaché à un événement, dans l'ordre de son avancée, plus « Écarté » (il a
// décliné, ou un autre a été retenu).
export const VENDOR_CANDIDATE_STATUSES = ["shortlisted", "contacted", "quote_received", "retained", "contract_signed", "paid_off", "dismissed"] as const;
export type VendorCandidateStatus = (typeof VENDOR_CANDIDATE_STATUSES)[number];
// « Retenu » et la suite engagent la ligne de budget liée.
export const ENGAGED_CANDIDATE_STATUSES: readonly VendorCandidateStatus[] = ["retained", "contract_signed", "paid_off"];

// PRD-EVT-03 — postes prestataires. Lot 28a : le poste n'a plus de statut à lui ;
// il affiche le plus avancé de ses prestataires (« Écarté » ne compte pas),
// « À trouver » sans prestataire, ou « Non requis ».
export type VendorSlotStatus = "to_find" | "not_required" | Exclude<VendorCandidateStatus, "dismissed">;

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
  // Déduit de ses prestataires (lot 28a).
  status: VendorSlotStatus;
  notRequired: boolean;
  // Lot 28b (PRE-02, décisions D10 et D14) : ses prestataires retenus (Retenu,
  // Contrat signé ou Soldé), dans leur ordre ; le poste n'en porte plus un seul.
  retainedVendors: RetainedVendor[];
  position: number;
  // Lot 5 (IMP-04) : champs libres d'un import.
  importedFields?: Record<string, string>;
  // Lot 11 (L11-EVT-10) : ce que veulent les clients.
  brief: string | null;
  icon: string | null;
};

export type RetainedVendor = { candidateId: string; vendorName: string; quoteAmountCents: number | null };

// Lot 12 (L12-EVT-15) — lieux d'un événement, saisis une fois.
// Lot 29b (JRJ-04, décision D8) — documents de l'événement (plan de table, plans,
// plan B) et documents embarqués pour le jour J, choisis pour l'événement parmi
// ceux-là et les pièces des autres modules (devis signés, pièces du budget, devis
// des prestataires retenus). Les fichiers du carnet (plaquettes, RIB) n'en sont pas.
export const DAY_DOCUMENT_SOURCES = ["event_document", "signed_quote", "budget_attachment", "candidate_quote"] as const;
export type DayDocumentSource = (typeof DAY_DOCUMENT_SOURCES)[number];
export type DayDocumentChoice = { source: DayDocumentSource; sourceId: string };
export type EventDocument = { id: string; eventId: string; label: string; mime: string; sizeBytes: number; createdAt: string };
export type AttachEventDocumentInput = { organizationId: string; eventId: string; label: string; content: Uint8Array; uploadedByUserId: string };
export type SetDayDocumentEmbeddedInput = { organizationId: string; eventId: string; source: DayDocumentSource; sourceId: string; embedded: boolean };

export type EventPlace = { id: string; eventId: string; label: string; address: string | null; vendorId: string | null };

// Lot 11 (L11-EVT-10 / L11-EVT-11) — prestataires consultés pour un poste.
export type VendorCandidateNote = { id: string; body: string; visibleToClients: boolean; createdAt: string };
export type VendorCandidate = {
  id: string;
  eventId: string;
  vendorSlotId: string;
  // Fiche du carnet (module vendors), null en saisie libre.
  vendorId: string | null;
  vendorName: string;
  status: VendorCandidateStatus;
  contactedOn: string | null;
  quoteAmountCents: number | null;
  currency: "EUR";
  hasQuoteFile: boolean;
  // Lot 29b (JRJ-04) : taille du devis joint, pour les documents embarqués.
  quoteSizeBytes: number | null;
  shownToClients: boolean;
  // Lot 12 (L12-EVT-16) : RIB de la fiche du carnet partagé aux clients.
  shareRibWithClients: boolean;
  // Déduit du statut (lot 28b) : retenu (ou au-delà), écarté, ou en lice (null).
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
  status?: VendorCandidateStatus;
  // Auteur d'un passage à « Retenu » (événement interne pour le budget).
  changedByUserId?: string;
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
  // Lot 28a : « Non requis », la seule chose propre au poste.
  notRequired?: boolean;
  // Raccourci du formulaire du poste : un nom retient ce prestataire (créé au
  // besoin parmi les prestataires rattachés), au montant donné.
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

// Lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15 ; ADR 0053) — liens personnels
// des tiers : une personne, un événement, des droits ; ni compte ni mot de passe.
export const LINK_AUDIENCES = ["client", "vendor", "guest"] as const;
export type LinkAudience = (typeof LINK_AUDIENCES)[number];

// Rubriques du portail qu'un lien peut ouvrir (POR-10 : rien par défaut).
export const LINK_RUBRICS = ["tasks", "program", "vendor_options", "budget", "quotes"] as const;
export type LinkRubric = (typeof LINK_RUBRICS)[number];

// Budget entier, ou seulement les catégories choisies (sans total général).
export const LINK_BUDGET_SCOPES = ["all", "selected"] as const;
export type LinkBudgetScope = (typeof LINK_BUDGET_SCOPES)[number];

export type EventLinkRights = {
  rubrics: LinkRubric[];
  budgetScope: LinkBudgetScope;
  // Catégories (postes de l'événement) partagées en « catégories choisies ».
  sharedSlotIds: string[];
};

export type EventLinkStatus = "active" | "expired" | "revoked";

export type EventLink = {
  id: string;
  eventId: string;
  audience: LinkAudience;
  personName: string;
  email: string;
  eventClientId: string | null;
  rights: EventLinkRights;
  // SEC-15 : dernier jour valable choisi par la planner, sinon null.
  customExpiresOn: string | null;
  // Dernier jour valable (AAAA-MM-JJ, heure de Paris), calculé ou choisi.
  expiresOn: string;
  status: EventLinkStatus;
  // Lot 26b (D9) : prestataire consulté que désigne un lien « vendor ».
  vendorCandidateId: string | null;
  // Lot 26b (POR-01, D6) : un code à usage unique est demandé à l'ouverture.
  otpRequired: boolean;
  // Lot 27a (CHR-04, D7) : rappels par e-mail des tâches de la personne.
  taskReminders: boolean;
  lastOpenedAt: string | null;
  renewalRequestedAt: string | null;
  createdAt: string;
};

export type EventLinkInput = {
  personName: string;
  email: string;
  eventClientId?: string | null | undefined;
  rights: EventLinkRights;
  customExpiresOn?: string | null | undefined;
  // Lot 26b (POR-01, D6) : demander un code à l'ouverture (non par défaut).
  otpRequired?: boolean | undefined;
  // Lot 27a (CHR-04, D7) : rappels par e-mail (oui par défaut).
  taskReminders?: boolean | undefined;
};

export type CreateEventLinkInput = {
  organizationId: string;
  eventId: string;
  createdByUserId: string;
  audience: LinkAudience;
  link: EventLinkInput;
  // Lot 26b (D9) : obligatoire pour un lien « vendor » : un prestataire
  // consulté de l'événement. Un tel lien n'ouvre aucune rubrique du portail.
  vendorCandidateId?: string | null | undefined;
  // Langue de l'e-mail.
  locale: "fr" | "en";
  // Vocabulaire de l'e-mail (« votre mariage » ou « votre événement ») ; à
  // défaut, celui du type de l'événement, sinon les mariés.
  vocabulary?: EventTypeAudience | undefined;
};

export type RenewEventLinkInput = {
  organizationId: string;
  linkId: string;
  renewedByUserId: string;
  locale: "fr" | "en";
  vocabulary?: EventTypeAudience | undefined;
};

// Le lien n'est montré qu'une fois (D10) : seul son haché reste en base.
export type EventLinkDelivery = { link: EventLink; url: string };

// Accès d'un lien, relu en base à chaque requête : retiré, expiré, événement
// perdu ou fictif, il n'y en a plus.
export type LinkAccess = {
  organizationId: string;
  linkId: string;
  eventId: string;
  audience: LinkAudience;
  personName: string;
  email: string;
  rights: EventLinkRights;
  // Dernier jour valable (AAAA-MM-JJ, heure de Paris).
  expiresOn: string;
  // Lot 26b : prestataire consulté d'un lien « vendor », sinon null.
  vendorCandidateId: string | null;
};

export type OpenEventLinkResult =
  | { outcome: "opened"; sessionToken: string; maxAgeSeconds: number; audience: LinkAudience }
  // Lot 26b (POR-01, D6) : le lien demande un code, envoyé à son e-mail
  // (montré masqué) ; codeSent faux si trop de codes ont été demandés.
  | { outcome: "code_required"; emailHint: string; codeSent: boolean }
  | { outcome: "invalid" };

// Lot 26b : réponse à un code saisi. Un code vaut dix minutes, cinq essais,
// un seul usage ; « code_expired » invite à en demander un nouveau.
export type VerifyLinkCodeResult =
  | Extract<OpenEventLinkResult, { outcome: "opened" }>
  | { outcome: "wrong_code"; attemptsLeft: number }
  | { outcome: "code_expired" }
  | { outcome: "invalid" };

// Lot 26b (D9) — espace minimal du prestataire : l'événement, les lieux, les
// lignes du programme où figure son poste (sans note interne ni autre
// intervenant). Ni prix, ni budget, ni autre prestataire.
export type VendorLinkView = {
  vendorName: string;
  slotLabel: string;
  clientFirstNames: string[];
  eventDate: string | null;
  places: { id: string; label: string; address: string | null }[];
  programItems: { id: string; startTime: string; endTime: string | null; label: string; location: string | null }[];
};

// Vue du tiers : jamais de note interne (programme en variante « mariés ») ;
// une rubrique fermée vaut null.
export type ClientEventView = {
  event: EventSummary;
  tasks: EventTask[] | null;
  program: EventProgram | null;
};

export type EventActivityKind = "task_done" | "task_undone" | "decision_made";

// Lot 27b (POR-03, BUD-07, EVT-09 ; décisions D9 et D10) — décision demandée au
// client : choisir entre des options d'un poste, valider une dépense, approuver
// le programme. Contenu figé à la demande ; une décision répondue ne se modifie
// plus, une nouvelle la remplace.
export const DECISION_KINDS = ["option", "expense", "program"] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];
export type DecisionStatus = "pending" | "approved" | "declined" | "withdrawn";
export type DecisionOption = { candidateId: string; vendorName: string; quoteAmountCents: number | null };
export type DecisionSnapshot =
  | { kind: "option"; slotLabel: string; options: DecisionOption[] }
  | { kind: "expense"; slotLabel: string; label: string; vendorName: string | null; amountCents: number }
  | { kind: "program"; programUpdatedAt: string | null; itemCount: number };

export type EventDecision = {
  id: string;
  eventId: string;
  kind: DecisionKind;
  // Poste (options), ligne du budget (dépense) ; null pour le programme.
  subjectId: string | null;
  slotId: string | null;
  title: string;
  note: string | null;
  snapshot: DecisionSnapshot;
  dueOn: string | null;
  status: DecisionStatus;
  choiceId: string | null;
  comment: string | null;
  decidedByName: string | null;
  decidedByLinkId: string | null;
  decidedAt: string | null;
  replacesDecisionId: string | null;
  // La décision qui remplace celle-ci, s'il y en a une.
  replacedById: string | null;
  requestedAt: string;
  // Programme approuvé puis modifié depuis la réponse.
  programChanged: boolean;
};

type RequestDecisionBase = {
  organizationId: string;
  eventId: string;
  requestedByUserId: string;
  note?: string | null | undefined;
  dueOn?: string | null | undefined;
  // Remplacer une décision répondue (EVT-09).
  replacesDecisionId?: string | null | undefined;
};
export type RequestDecisionInput =
  | (RequestDecisionBase & { kind: "option"; slotId: string })
  // La dépense est lue au module budget par l'appelant : ligne, poste, montant.
  | (RequestDecisionBase & { kind: "expense"; slotId: string; lineId: string; slotLabel: string; label: string; vendorName: string | null; amountCents: number })
  | (RequestDecisionBase & { kind: "program" });

export type AnswerDecisionInput = {
  organizationId: string;
  linkId: string;
  decisionId: string;
  answer: "approved" | "declined";
  // Option choisie (décision « options »).
  choiceId?: string | null | undefined;
  comment?: string | null | undefined;
};

export type EventActivity = {
  id: string;
  kind: EventActivityKind;
  taskLabel: string;
  // Lot 26a : nom de la personne du lien qui a coché (null si le lien a été
  // effacé, ou pour une ancienne coche d'un compte de marié).
  actorName: string | null;
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
  updateEventVendorSlot(input: UpdateEventVendorSlotInput): Promise<void>;
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
  // Lot 28b (BUD-01) : un prestataire rattaché, lu par le module Budget.
  getVendorCandidate(organizationId: string, candidateId: string): Promise<VendorCandidate | null>;
  listVendorConsultations(organizationId: string, vendorId: string): Promise<VendorConsultation[]>;
  listSelectedVendorIds(organizationId: string): Promise<string[]>;
  // Lot 26a : par le lien personnel (rubrique « Options de prestataires »).
  getLinkVendorOptions(organizationId: string, linkId: string): Promise<ClientVendorSlotOptions[]>;
  getLinkVendorQuoteFile(organizationId: string, linkId: string, candidateId: string): Promise<FileDownload>;
  getLinkSharedRibVendorId(organizationId: string, linkId: string, candidateId: string): Promise<string>;
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
  // Lot 26a (ADR 0053) — liens personnels des tiers.
  createEventLink(input: CreateEventLinkInput): Promise<EventLinkDelivery>;
  listEventLinks(organizationId: string, eventId: string): Promise<EventLink[]>;
  updateEventLink(organizationId: string, linkId: string, input: EventLinkInput): Promise<EventLink>;
  renewEventLink(input: RenewEventLinkInput): Promise<EventLinkDelivery>;
  revokeEventLink(organizationId: string, linkId: string): Promise<void>;
  openEventLink(token: string, now?: Date, locale?: "fr" | "en"): Promise<OpenEventLinkResult>;
  // Lot 26b (POR-01, D6) : code à usage unique saisi après l'ouverture.
  verifyLinkCode(token: string, code: string, now?: Date): Promise<VerifyLinkCodeResult>;
  getVendorLinkView(organizationId: string, linkId: string): Promise<VendorLinkView>;
  // Lot 27a (CHR-04) : rappels des tâches du client, par la tâche horaire.
  sendClientTaskReminders(organizationId: string, now?: Date): Promise<number>;
  // Lot 27b (POR-03, BUD-07, EVT-09) : décisions demandées au client.
  requestDecision(input: RequestDecisionInput): Promise<EventDecision>;
  withdrawDecision(organizationId: string, decisionId: string): Promise<void>;
  listEventDecisions(organizationId: string, eventId: string): Promise<EventDecision[]>;
  // Lot 29b (JRJ-04, décision D8).
  listEventDocuments(organizationId: string, eventId: string): Promise<EventDocument[]>;
  attachEventDocument(input: AttachEventDocumentInput): Promise<EventDocument>;
  renameEventDocument(organizationId: string, documentId: string, label: string): Promise<void>;
  removeEventDocument(organizationId: string, documentId: string): Promise<void>;
  getEventDocumentFile(organizationId: string, documentId: string): Promise<FileDownload>;
  listDayDocumentChoices(organizationId: string, eventId: string): Promise<DayDocumentChoice[]>;
  setDayDocumentEmbedded(input: SetDayDocumentEmbeddedInput): Promise<void>;
  listLinkDecisions(organizationId: string, linkId: string): Promise<EventDecision[]>;
  answerLinkDecision(input: AnswerDecisionInput): Promise<EventDecision>;
  resolveLinkSession(sessionToken: string, now?: Date): Promise<LinkAccess | null>;
  closeLinkSession(sessionToken: string): Promise<void>;
  requestLinkRenewal(token: string, now?: Date): Promise<void>;
  getLinkAccess(organizationId: string, linkId: string, now?: Date): Promise<LinkAccess | null>;
  getLinkEventView(organizationId: string, linkId: string): Promise<ClientEventView>;
  setLinkTaskDone(organizationId: string, linkId: string, taskId: string, done: boolean): Promise<EventTask>;
  getLinkNamesByIds(organizationId: string, linkIds: string[]): Promise<Record<string, string>>;
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
}
