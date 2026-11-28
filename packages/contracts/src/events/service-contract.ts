// Interface du service.ts d'events (SOC-06) — pensée comme le futur
// contrat HTTP /v1/events si ce module est extrait en app autonome (ADR
// 0011). apps/symbola vérifie que le vrai module satisfait ce type (test
// de contrat, apps/symbola/modules/events/service.contract.test.ts).
import type { FileDownload } from "../file-download";
import type { MonthlyCount } from "../usage";
import type { EventsSearchResults } from "../search";
import type { TaskDueState } from "./planning";
// Lot 34a (EVT-05, ADR 0055) : statuts stockés ; EventPhase ajoute « Jour J », qui s'applique de
// lui-même le jour de l'événement, dans son fuseau (décision D3). Lot 72a (J1, ADR 0121) : « En
// préparation » est retiré ; un évènement signé est « Confirmé » (« Signé, en préparation » à l'écran).
export type EventStatus = "option" | "confirmed" | "closed" | "postponed" | "cancelled";
export type EventPhase = EventStatus | "day_of";

// Lot 72a (EVT-05 ; E1, J1) : les quatre étapes de la frise. Reporté et Annulé ne sont pas des étapes :
// la frise laisse alors place à une ligne d'état.
export const EVENT_DISPLAY_STEPS = ["request", "signed", "day_of", "closed"] as const;
export type EventDisplayStep = (typeof EVENT_DISPLAY_STEPS)[number];

// Lot 72a (EVT-05, J2) : les tâches faites d'un évènement, et celles en retard (état d'échéance unique
// du lot 70a), hors tâches supprimées.
export type EventTaskProgress = { done: number; total: number; late: number };

// Lot 72c (PAR-10, HUB-03, EVT-06 ; C-14, A7) — la vue « L'agence » d'« Aujourd'hui » : les tâches à faire
// par personne (`member:<id>`, `clients`, `vendors`, `nobody`, les mêmes clés que `todoByWho` de « Tâches »),
// et l'avancement des évènements en cours, dans ce que la personne voit (lot 52, A20). « D'ici N jours »
// compte, comme le compte d'« Aujourd'hui », les retards et le jour même. Hors évènements de démonstration,
// archivés, annulés ou clôturés.
export type AgencyWhoCounts = { who: string; late: number; today: number; horizon: number };
export type AgencyEventCounts = EventTaskProgress & { eventId: string; oldestLate: { label: string; dueDate: string } | null };
export type AgencyOverview = { byWho: AgencyWhoCounts[]; byEvent: AgencyEventCounts[]; followedBy: Record<string, number> };
export type ListAgencyOverviewInput = { organizationId: string; viewer: TaskListViewer; today: string; horizonDays: number };

export type EventClient = {
  id: string;
  // Lot 36a (CRM-03, ADR 0069) : le contact du hub qui porte le nom et les coordonnées ; nul quand
  // le RGPD a retiré la personne de l'évènement (nom « [anonymisé] »).
  contactId: string | null;
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

// Lot 36a (UX-02, DAT-12) : un contact existant (contactId), ou un nouveau, créé dans le hub — une
// adresse e-mail déjà connue reprend le contact qui la porte.
export type EventClientInput = {
  contactId?: string | null;
  firstName: string;
  lastName?: string | null;
} & Partial<EventClientContact>;

// Lot 13 (L13-EVT-19) — date (AAAA-MM-JJ, Paris) du dernier passage dans chaque statut.
// Lot 72a (E2, J2) : la date d'une étape est sa date effective (« Signé le », posée par « Le contrat est
// signé… », et le jour d'une annulation) ; à défaut, le jour du changement dans le fuseau de l'évènement.
export type EventStatusDates = Partial<Record<EventStatus, string>>;

// Lot 13 (L13-HUB-15) — prospect sans nouvelle, pour le bloc « À traiter ».
export type StaleProspect = { eventId: string; names: string; lastUpdateAt: Date; daysSince: number };

export type EventSummary = {
  id: string;
  status: EventStatus;
  // Lot 34a (EVT-05, D3) : le statut affiché, « Jour J » compris (le jour de l'événement, dans
  // son fuseau, pour un événement confirmé ou en préparation).
  phase: EventPhase;
  eventDate: string | null;
  // Lot 34a (ARC-17, D9) : fuseau IANA de l'événement.
  timeZone: string;
  // Lot 34b (EVT-03, D10) : le lieu de réception est le premier lieu de la liste (son intitulé et
  // sa ville) ; il se modifie par la liste des lieux.
  venueName: string | null;
  venueCity: string | null;
  clients: EventClient[];
  // AIDE-02 : événement fictif d'un essai guidé.
  isDemo: boolean;
  // Lot 63c (EVT-01) : son type, dont le nom tient lieu de nom pour un évènement sans client.
  eventTypeId?: string | null;
  // Lot 63c (EVT-01 ; Q43, migration 0196) : nom facultatif ; rempli, il remplace le nom tiré des clients.
  name?: string | null;
  // Lot 58 (PAR-09 ; ADR 0097) : archivé (lecture seule, hors des listes courantes) ; absent : non archivé.
  archivedAt?: string | null;
  // Lot 72a (EVT-07, UX-01) : les tâches faites et en retard ; rendu par listEvents quand on le demande
  // (withTaskProgress), absent ailleurs.
  taskProgress?: EventTaskProgress;
  // Lot 71f (P-06 ; migration 0220 du 71a) : créé dans Symbola, ou repris d'un ancien outil (la marque
  // « Repris » et le filtre « Origine » de la liste). Rendu par le service ; absent des objets d'essai.
  origin?: EventOrigin;
};

export const EVENT_ORIGINS_LIST = ["created", "takeover"] as const;
export type EventOrigin = (typeof EVENT_ORIGINS_LIST)[number];

// Lot 38b (HUB-29 ; D11, D12) — un évènement du flux de calendrier de l'équipe : daté, ni essai, ni
// perdu ou annulé ; avec son type, pour l'intitulé (« Mariage — Léa & Maxime »).
export type CalendarEvent = EventSummary & { eventTypeId: string | null };

// Lot 64 (HUB-29, RDV-02 ; D1 à D6 ; ADR 0109) — plages occupées. Début et fin : un jour relatif à la
// date de l'évènement (-7 à 7) et une heure locale « HH:MM » (fuseau de l'évènement).
export type BusyRule = { startDayOffset: number; startTime: string; endDayOffset: number; endTime: string };
export type BusyRuleSource = "event" | "type" | "fallback";
export type BusySettingsView = { optionsBlock: boolean; fallback: BusyRule; isStarter: boolean };
export type EventTypeBusyRule = { eventTypeId: string; label: string; rule: BusyRule; isStarter: boolean };
export type EventBusyView = {
  rule: BusyRule;
  source: BusyRuleSource;
  typeLabel: string | null;
  // Dates locales de début et de fin ; nulles sans date.
  startDate: string | null;
  endDate: string | null;
  // Les mêmes, en instants UTC (ISO 8601) ; nuls sans date.
  startsAt: string | null;
  endsAt: string | null;
  timeZone: string;
  blocking: boolean;
  status: EventStatus;
  // D3 : les comptes dont l'agenda est bloqué ; vide = toute l'organisation (évènement sans équipe).
  teamUserIds: string[];
};
export type BusyRangeItem = { eventId: string; start: Date; end: Date; blocking: boolean };

export type EventDetail = EventSummary & {
  prospectSourceId: string | null;
  // Lot 16 (ADR 0045) : type de l'événement ; nul pour un événement d'avant le
  // lot 16 (le vocabulaire suit alors le métier de l'organisation).
  eventTypeId: string | null;
  lossReasonId: string | null;
  lossReasonNote: string | null;
  // PRD-EVT-04 : date pour laquelle les échéances ont été calculées.
  tasksScheduledFor: string | null;
  // Lot 34a (EVT-05, D4) : report en cours — date et statut d'avant.
  postponedFromDate: string | null;
  postponedFromStatus: EventStatus | null;
  // Lot 5 (IMP-04) : colonnes d'un fichier importé gardées en champ libre.
  importedFields?: Record<string, string>;
  // Lot 14 (décision K) : budget souhaité par les clients, en centimes.
  wantedBudgetCents: number | null;
  // Lot 34b (EVT-03, D11) : invités estimés et confirmés (saisis à la main jusqu'au module
  // Invités), style et notes.
  guestsEstimated: number | null;
  guestsConfirmed: number | null;
  style: string | null;
  notes: string | null;
  // Lot 48a (DAT-08, ADR 0093) : notes confidentielles (chiffrées ; notes est alors null), lues par
  // readEventConfidentialNotes pour la titulaire et leur auteur seuls.
  notesConfidential?: { authorUserId: string } | null;
};

// Lot 34b (EVT-03, D11) : fiche d'identité de l'événement.
export type EventIdentityInput = {
  guestsEstimated: number | null;
  guestsConfirmed: number | null;
  style: string | null;
  notes: string | null;
};

export type ListEventsInput = {
  organizationId: string;
  statusIn?: EventStatus[] | undefined;
  year?: number | undefined;
  search?: string | undefined;
  // PRD-EVT-07 : la source est filtrable dans la liste.
  prospectSourceId?: string | undefined;
  // Lot 58 (PAR-09 ; ADR 0097) : « exclude » (les listes courantes), « only » (filtre « Archivés »),
  // « include » (par défaut : recherche, calendrier, fiche d'un contact).
  archived?: "exclude" | "only" | "include" | undefined;
  // Lot 72a : joindre à chaque évènement le compte de ses tâches (une requête groupée).
  withTaskProgress?: boolean | undefined;
  // Lot 71f (P-06) : le filtre « Origine » de la liste, lu en SQL sur `events.origin`.
  origin?: EventOrigin | undefined;
};

// Lot 72a (EVT-05 ; E2, J2) : « Le contrat est signé… » ; la date de signature, au plus aujourd'hui (dans
// le fuseau de l'évènement) et au plus tôt un an avant la création de l'évènement.
export type MarkContractSignedInput = { organizationId: string; eventId: string; changedByUserId: string; signedOn: string; now?: Date };

export type CreateProspectInput = {
  organizationId: string;
  createdByUserId: string;
  clients: EventClientInput[];
  // Lot 63c (EVT-01 ; Q43) : nom facultatif de l'évènement (« Shooting Roux »).
  name?: string | null;
  // Lot 63c (EVT-01) : facultative pour un évènement confirmé (un shooting photo sans demande à suivre).
  prospectSourceId: string | null;
  // Lot 16 (ADR 0045) : un type de l'organisation.
  eventTypeId?: string | null | undefined;
  eventDate?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  // Lot 63c (EVT-01, CHR-01 ; ADR 0106, qui remplace D8 du lot 34a) : aucun rétroplanning d'office ;
  // seulement le modèle choisi à la création (case cochée), daté depuis la date de l'évènement.
  taskTemplateId?: string | null;
  // Lot 71b (HUB-14, C-67 ; maquette 06) : un mariage saisi sur la page de reprise. Il est « Signé, en
  // préparation » (Confirmé), d'origine « reprise », à une date de signature que la planner n'a pas
  // dite ; aucun modèle de rétroplanning ne s'applique (ses tâches viendront de sa liste).
  takeover?: boolean;
  // Lot 74b (B7, L74-D2) : les réponses de l'étape « Les échéances déjà passées » de « Nouvel évènement »,
  // une par tâche du modèle (son identifiant) et la répartition des tâches à faire ; une tâche passée sans
  // réponse est créée « à dater ». `now` : l'horloge (simulée dans les tests).
  pastDue?: { tasks: Readonly<Record<string, "done" | "todo">>; spread: "2w" | "4w" | "8w" | "undated" };
  now?: Date;
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

export type RetainedVendor = {
  candidateId: string;
  vendorName: string;
  quoteAmountCents: number | null;
  // Lot 71f (C-53, § 0 du lot 71) : le contrat, dit en mots sous le nom du prestataire repris. « signed »
  // dès que le statut le dit ; sinon ce que la planner a déclaré à la reprise ; null hors reprise.
  takeoverContract?: "signed" | "unsigned" | "unknown" | null;
};

// Lot 12 (L12-EVT-15) — lieux d'un événement, saisis une fois.
// Lot 29b (JRJ-04, décision D8) — documents de l'événement (plan de table, plans,
// plan B) et documents embarqués pour le jour J, choisis pour l'événement parmi
// ceux-là et les pièces des autres modules (devis signés, pièces du budget, devis
// des prestataires retenus). Les fichiers du carnet (plaquettes, RIB) n'en sont pas.
export const DAY_DOCUMENT_SOURCES = ["event_document", "signed_quote", "budget_attachment", "candidate_quote"] as const;
export type DayDocumentSource = (typeof DAY_DOCUMENT_SOURCES)[number];
export type DayDocumentChoice = { source: DayDocumentSource; sourceId: string };
// Lot 37a (DOC-01, POR-10 ; D3, D4, D6) : un dossier (null : « Divers »), le numéro de la dernière
// version, et le partage avec les clients et les prestataires de l'évènement (rien par défaut).
export type EventDocument = {
  id: string;
  eventId: string;
  label: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  folderId: string | null;
  version: number;
  sharedWithClients: boolean;
  sharedWithVendors: boolean;
};
export type AttachEventDocumentInput = { organizationId: string; eventId: string; label: string; content: Uint8Array; uploadedByUserId: string; folderId?: string | null | undefined };
export type EventDocumentFolder = { id: string; eventId: string; name: string };
export type EventDocumentVersion = { id: string; documentId: string; version: number; mime: string; sizeBytes: number; createdAt: string };
// Lot 37a (DOC-04, D7) : lien de partage d'un document, à durée limitée ; le jeton n'est montré
// qu'une fois, à la création.
export type EventDocumentShareLink = { id: string; documentId: string; expiresAt: string; revokedAt: string | null; openCount: number; lastOpenedAt: string | null; createdAt: string };
export type AddEventDocumentVersionInput = { organizationId: string; documentId: string; content: Uint8Array; uploadedByUserId: string };
export type CreateEventDocumentLinkInput = { organizationId: string; documentId: string; days: number; createdByUserId: string; now?: Date | undefined };
// Un lien de partage ouvert : le document seulement, jamais l'évènement ; le fichier est lu à la demande.
export type OpenedEventDocumentLink = { label: string; mime: string; sizeBytes: number; file: () => Promise<FileDownload> };
export type SetDayDocumentEmbeddedInput = { organizationId: string; eventId: string; source: DayDocumentSource; sourceId: string; embedded: boolean };

// Lot 30a (JRJ-03, décision D4) — contacts du jour J saisis pour l'événement
// (régisseur du domaine, taxi, pharmacie de garde), dans l'annuaire du jour J.
export type EventDayContact = { id: string; eventId: string; name: string; role: string | null; phone: string; position: number };
export type EventDayContactInput = { name: string; role?: string | null; phone: string };

// Lot 34b (EVT-03, D10) : chaque lieu porte son adresse, sa ville, ses horaires (« HH:MM », début
// et fin facultatifs) et son contact ; le premier de la liste est le lieu de réception.
export type EventPlace = {
  id: string;
  eventId: string;
  label: string;
  address: string | null;
  city: string | null;
  startTime: string | null;
  endTime: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  vendorId: string | null;
};

export type EventPlaceInput = {
  label: string;
  address?: string | null;
  city?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  vendorId?: string | null;
};

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
  // Lot 73a (migration 0235) : depuis quand il est retenu (« retenu le … ») ; null hors des statuts retenus,
  // et pour un prestataire retenu avant ce lot (rien n'est reconstruit, P6).
  retainedAt: string | null;
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
  // Lot 73a (P9) : le prestataire rattaché et son statut (« Soldé » : le montant est le total réglé).
  candidateId: string;
  status: VendorCandidateStatus;
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

// PRD-EVT-04 — rétroplanning. Lot 34b (CHR-02, D12) : une tâche peut être confiée à un
// prestataire retenu sur l'événement (responsable « vendor ») ; un modèle n'en a pas.
export type TaskResponsible = "planner" | "clients" | "vendor";
// Lot 63d (CHR-03, HUB-20) : priorité d'une tâche (deux niveaux) et catégories de l'organisation.
export type TaskPriority = "high" | "normal";
export type TaskCategory = { id: string; label: string; color: string; position: number; starterKey: string | null };
export type TaskCategoryInput = { label: string; color: string };
export type StarterTaskCategoryInput = { key: string; label: string; color: string };
export type TemplateTaskResponsible = Exclude<TaskResponsible, "vendor">;

export type TaskTemplateItem = {
  id: string;
  label: string;
  // Décalage en jours par rapport à la date de l'événement (J-365 = -365).
  offsetDays: number;
  responsible: TemplateTaskResponsible;
  position: number;
};

export type TaskTemplate = {
  id: string;
  name: string;
  // Lot 34a (EVT-01, D8) : type d'événement auquel le modèle est rattaché.
  eventTypeId: string | null;
  items: TaskTemplateItem[];
};

export type TaskTemplateItemInput = {
  label: string;
  offsetDays: number;
  responsible: TemplateTaskResponsible;
};

export type EventTask = {
  id: string;
  eventId: string;
  label: string;
  dueDate: string;
  responsible: TaskResponsible;
  // Lot 34b (CHR-02, D12) : le prestataire retenu à qui la tâche est confiée ; nul s'il a été
  // retiré de l'événement.
  vendorCandidateId: string | null;
  done: boolean;
  position: number;
  // Lot 34a (DAT-07) : écart avec la date de l'événement (J-90 = -90), et tâche fixée (déplacée à
  // la main : le report ne la bouge plus).
  offsetDays: number | null;
  fixed: boolean;
  // Lot 5 (IMP-04) : champs libres d'un import.
  importedFields?: Record<string, string>;
  // Lot 53 (CHR-05) : jalon du rétroplanning (pèse plus sur la santé du planning).
  isMilestone?: boolean;
  // Lot 63d (CHR-03) : catégorie (nulle : sans catégorie) et priorité.
  categoryId: string | null;
  priority: TaskPriority;
  // Lot 70a (CHR-02 ; A1 à A4) : le membre de l'équipe qui s'en charge (responsable « planner »
  // seulement ; « planner » veut dire « quelqu'un de l'agence »). Nul : personne de nommé.
  assigneeUserId: string | null;
  // Lot 70a (CHR-04 ; D1, A9) : quand et par qui la tâche a été cochée (qui a coché, pas qui s'en
  // chargeait) ; nul pour une tâche à faire, ou quand l'auteur n'est pas connu (tâches d'avant le lot).
  doneAt: string | null;
  doneBy: TaskDoneBy | null;
  // Lot 70a (A7) : note interne à l'agence, jamais montrée aux mariés ni aux prestataires.
  note: string | null;
  // Lot 70a (UX-06, CHR-05 ; Q47-4) : état d'échéance, calculé là où le jour est connu (listes) ;
  // null pour une tâche faite.
  dueState?: TaskDueState | null;
  // Lot 74b (B7, L74-D3) : faux pour une tâche « à dater » (dueDate est alors la date de l'évènement, une
  // date technique) ; absent : une vraie échéance.
  dueDateKnown?: boolean;
};

// Lot 70a (D1, A9) : qui a coché — un membre (et lequel), les clients par leur lien, un prestataire
// par le sien. userId n'est rempli que pour un membre ; jamais l'identifiant d'un lien.
export const TASK_DONE_BY_KINDS = ["member", "clients", "vendor"] as const;
export type TaskDoneByKind = (typeof TASK_DONE_BY_KINDS)[number];
export type TaskDoneBy = { kind: TaskDoneByKind; userId: string | null };

// Lot 70a (A7) : 2 000 caractères au plus.
export const TASK_NOTE_MAX = 2000;

export type EventTaskInput = {
  label: string;
  dueDate: string;
  responsible: TaskResponsible;
  vendorCandidateId?: string | null;
  categoryId?: string | null;
  priority?: TaskPriority;
  // Lot 70a (A3) : sans valeur, la tâche « planner » est à la personne qui la crée.
  assigneeUserId?: string | null;
  note?: string | null;
};

// Lot 63d (CHR-02, UX-07) : actions groupées sur des tâches choisies dans un tableau.
// Lot 70a (§ 3.3) : « Fait », « Confier à un membre » et « Toutes au <date> ».
export type BulkTaskChange =
  | { kind: "shift"; days: number }
  | { kind: "responsible"; responsible: Exclude<TaskResponsible, "vendor"> }
  | { kind: "category"; categoryId: string | null }
  | { kind: "priority"; priority: TaskPriority }
  | { kind: "done" }
  | { kind: "assign"; userId: string }
  | { kind: "setDate"; date: string };

// Lot 34b (CHR-02, D13) : pièces jointes et fil de commentaires d'une tâche, réservés à l'équipe.
export type EventTaskAttachment = { id: string; taskId: string; eventId: string; label: string; mime: string; sizeBytes: number; createdAt: string };
export type AttachTaskFileInput = { organizationId: string; taskId: string; label: string; content: Uint8Array; uploadedByUserId: string };
export type EventTaskComment = { id: string; taskId: string; authorUserId: string | null; body: string; createdAt: string };

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

// —— Lot 70a (CHR-02, CHR-03, CHR-10 ; § 3.3) : une seule liste des tâches de l'organisation ——————————
// Les tâches d'évènement et hors évènement ensemble, filtrées dans la base, avec le total et le nombre
// filtré (« 8 tâches à faire sur 42 »). Une tâche d'un évènement annulé ou clôturé n'y est pas.

export const TASK_LIST_STATES = ["todo", "done", "all"] as const;
export type TaskListState = (typeof TASK_LIST_STATES)[number];

export type TaskListEventFilter = { kind: "event"; eventId: string } | { kind: "none" };
// « Vous », un membre, les clients, les prestataires ; absent : tout le monde.
export type TaskListAssigneeFilter = { kind: "me" } | { kind: "member"; userId: string } | { kind: "clients" } | { kind: "vendors" };
// En retard ; cette semaine (lundi à dimanche) ; les quinze prochains jours, retards compris ; ce mois-ci ;
// entre deux dates (comprises).
export type TaskListPeriod = { kind: "late" } | { kind: "week" } | { kind: "fortnight" } | { kind: "month" } | { kind: "between"; from: string; to: string };

export type TaskListFilters = {
  event?: TaskListEventFilter;
  assignee?: TaskListAssigneeFilter;
  period?: TaskListPeriod;
  categoryId?: string;
  // « À faire » par défaut.
  state?: TaskListState;
};

// Ce que voit la personne (lot 52, A20) : la Propriétaire et, si le réglage est ouvert, toute Planner
// voient tout ; une Planner restreinte voit les tâches des évènements de son équipe et, hors évènement,
// celles qui lui sont confiées, qu'elle a créées ou qui n'ont personne.
export type TaskListViewer = { userId: string; role: "owner" | "member"; allPlannersSeeAll: boolean };

export type ListTasksInput = {
  organizationId: string;
  today: string;
  viewer: TaskListViewer;
  filters?: TaskListFilters;
};

export type TaskListItem = Omit<EventTask, "eventId" | "dueState"> & {
  eventId: string | null;
  dueState: TaskDueState | null;
  event: { id: string; names: string; eventDate: string | null; status: EventStatus; isDemo: boolean } | null;
};

export type TaskList = {
  tasks: TaskListItem[];
  // Toutes les tâches que la personne voit, faites comprises, sans filtre.
  total: number;
  // Celles qui répondent aux filtres (tasks.length).
  filtered: number;
  // Parmi elles, celles en retard.
  late: number;
  // Lot 74b (B7) : parmi elles, celles « à dater » (comptées à part, jamais en retard).
  undated?: number;
  // Seuil de « Bientôt » de l'organisation (M10).
  soonDays: number;
  // Lot 70d (CHR-03 crit. 3, PAR-10) : toutes les tâches à faire que la personne voit, sans filtre (« 4 tâches
  // sur 11 à faire » ; à faire + faites = total), et leur nombre par personne (« Bastien · 6 à faire ») :
  // `member:<id>`, `clients`, `vendors`, `nobody`.
  todoTotal: number;
  todoByWho: Record<string, number>;
};

export type UpdateEventTaskInput = {
  organizationId: string;
  taskId: string;
  label?: string | undefined;
  dueDate?: string | undefined;
  responsible?: TaskResponsible | undefined;
  vendorCandidateId?: string | null | undefined;
  done?: boolean | undefined;
  categoryId?: string | null | undefined;
  priority?: TaskPriority | undefined;
  assigneeUserId?: string | null | undefined;
  note?: string | null | undefined;
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
  // Lot 30b (CHR-06, décision D6) : responsable de la séquence, texte court.
  responsible: string | null;
  participants: ProgramParticipant[];
  // Lot 51 (EVT-04 ; D1) : le temps fort de la séquence, donc son jour (null : évènement sans date).
  keyMomentId: string | null;
  // Lot 63b (CHR-08 ; Q44) : cachée des mariés (leur espace, le programme diffusé, le PDF « mariés ») ;
  // visible de l'équipe et des prestataires qu'elle concerne.
  hiddenFromClients: boolean;
  // Lot 71a (R12 ; migration 0222) : un début et une fin (« span »), ponctuel (« point »), un repère
  // (« marker ») ; seul un « span » sans fin est une heure de fin à compléter (lot 71f).
  timing?: "span" | "point" | "marker";
};

export type ProgramItemInput = {
  startTime: string;
  endTime?: string | null | undefined;
  // Lot 30b (CHR-06, décision D7) : sans heure de fin, la durée la donne.
  durationMinutes?: number | null | undefined;
  label: string;
  location?: string | null | undefined;
  internalNote?: string | null | undefined;
  responsible?: string | null | undefined;
  vendorSlotIds: string[];
  freeParticipants: string[];
  // Lot 51 (EVT-04) : absent ou null, la séquence rejoint le premier temps fort du jour de
  // l'évènement (créé de lui-même s'il n'y en a pas).
  keyMomentId?: string | null | undefined;
  // Lot 63b (Q44) : absent, la séquence reste visible des mariés (ou garde son réglage).
  hiddenFromClients?: boolean | undefined;
};

// Lot 62c (UX-13, décision D1) : le programme s'enregistre d'un coup, séquences modifiées et
// séquences ajoutées dans une seule transaction (tout ou rien).
export type SaveProgramItemsInput = {
  updates: { itemId: string; item: ProgramItemInput }[];
  additions: ProgramItemInput[];
};

// Lot 30b (CHR-06, décision D8) : décaler les séquences suivantes d'autant que la
// séquence modifiée, proposé après le changement de son heure de début ; `outOfDay`
// quand l'une d'elles sortirait du jour J (elle se déplace alors à la main).
export type ProgramShiftProposal = { minutes: number; itemIds: string[]; outOfDay: boolean };

export type ProgramOverlap = { participant: string; itemIds: [string, string] };

export type EventProgram = {
  items: ProgramItem[];
  // Lot 67d (EVT-04, CHR-07) : les temps forts de l'évènement (un jour chacun), pour séparer les
  // jours d'un programme de plusieurs jours (PDF). Absent : un seul jour.
  moments?: { id: string; name: string; date: string }[];
  overlaps: ProgramOverlap[];
  // Date de version du PDF : dernière modification du programme (ISO 8601).
  updatedAt: string | null;
};

// Lot 37b (CHR-07, DAT-14 ; D8, ADR 0071) — une séquence d'une version diffusée : la copie figée,
// jamais de note interne.
// Lot 71e (R13) : `endPending`, une fin attendue d'un programme repris : les destinataires lisent « heure de
// fin à venir » (jamais une fin déduite).
export type PublishedProgramItem = Omit<ProgramItem, "eventId" | "internalNote" | "keyMomentId"> & { endPending?: true };

export type ProgramVersionSummary = {
  number: number;
  publishedAt: string;
  // null : la version 1 reprise à la migration du lot 37b, sans auteur.
  publishedByUserId: string | null;
  // Lot 38a (D9) : quand la version a été envoyée par e-mail, et à combien de personnes (null : pas encore).
  notifiedAt: string | null;
  notifiedCount: number | null;
};

export type ProgramVersion = ProgramVersionSummary & { items: PublishedProgramItem[] };

// Ce qui a changé depuis la dernière diffusion : intitulés des séquences ajoutées, modifiées
// (heure, intitulé, lieu, responsable, intervenants) et retirées. Une note interne n'y compte pas.
export type ProgramChanges = { added: string[]; changed: string[]; removed: string[] };

// Lot 37b (D8) — la diffusion vue de la fiche : la dernière version, la liste des versions (la plus
// récente d'abord), ce qui a changé depuis, et si une diffusion est possible (programme non vide et
// différent de la dernière version).
export type ProgramPublication = {
  latest: ProgramVersionSummary | null;
  versions: ProgramVersionSummary[];
  changes: ProgramChanges;
  canPublish: boolean;
};

// Lot 37b (D10, D11) — le programme d'un client : la dernière version diffusée (version nulle et
// aucune séquence tant que rien n'est diffusé) ; `isNew` quand elle est plus récente que la dernière
// vue par son lien.
export type PublishedProgramView = {
  version: { number: number; publishedAt: string } | null;
  items: PublishedProgramItem[];
  isNew: boolean;
};

// Lot 37b (D9, D11) — le programme d'un prestataire, dans la dernière version diffusée : ses
// séquences en entier (sans autre intervenant) et le déroulé du jour en titres et horaires.
export type VendorProgramView = {
  version: { number: number; publishedAt: string } | null;
  ownItems: { id: string; startTime: string; endTime: string | null; label: string; location: string | null; responsible: string | null; endPending?: true }[];
  outline: { id: string; startTime: string; endTime: string | null; label: string; own: boolean; endPending?: true }[];
  isNew: boolean;
  // Lot 51 (JRJ-05 ; D3) : le dernier décalage du jour J validé qui concerne ce poste, affiché en tête.
  dayShift?: { minutes: number; validatedAt: string } | null;
};

export type PublishEventProgramInput = { organizationId: string; eventId: string; userId: string; now?: Date | undefined };

// Lot 38a (D9 ; MSG-02, D8) — « Prévenir par e-mail » après une diffusion : les liens actifs des
// clients (rubrique Programme) et des prestataires. Chacun reçoit son programme en PDF : la version
// des clients, ou la vue de son poste pour un prestataire (ni note interne ni séquence détaillée
// d'un autre). Le lien lui-même ne se renvoie pas : Symbola n'en garde que l'empreinte.
export type ProgramRecipient = { linkId: string; audience: "client" | "vendor"; name: string; email: string; locale: "fr" | "en" };

export type ProgramRecipientDocument = {
  recipient: ProgramRecipient;
  event: { clientFirstNames: string[]; eventDate: string | null };
  version: { number: number; publishedAt: string };
  view: { kind: "client"; items: PublishedProgramItem[] } | { kind: "vendor"; slotLabel: string; ownItems: VendorProgramView["ownItems"]; outline: VendorProgramView["outline"] };
};

export type NotifyProgramVersionInput = {
  organizationId: string;
  eventId: string;
  // Empreinte de la liste revue sur l'écran du garde-fou (MSG-02).
  confirmedRecipients?: string | null | undefined;
  renderDocument: (document: ProgramRecipientDocument) => Promise<{ filename: string; content: Uint8Array }>;
  now?: Date | undefined;
};

// notSent : e-mails non partis (plafond d'envois atteint, messagerie en panne).
// Lot 65d (ADR 0110) : prepared, les messages préparés pour la messagerie de la planner (rien n'est parti).
export type ProgramNotification = { version: number; sent: number; notSent: number; prepared?: number };

export type ProgramTemplateItem = {
  id: string;
  startTime: string;
  endTime: string | null;
  label: string;
  location: string | null;
  participantLabels: string[];
  position: number;
  // Lot 51 (CHR-08, EVT-04) : temps fort de la ligne (null : celui du jour de l'évènement) et son
  // jour, compté depuis le jour de l'évènement.
  momentName: string | null;
  dayOffset: number;
};

export type ProgramTemplate = { id: string; name: string; items: ProgramTemplateItem[] };

export type ProgramTemplateItemInput = {
  startTime: string;
  endTime?: string | null | undefined;
  label: string;
  location?: string | null | undefined;
  participantLabels: string[];
  momentName?: string | null | undefined;
  dayOffset?: number | undefined;
};

// Lot 26a (UX-11, POR-01, POR-10, SEC-14, SEC-15 ; ADR 0053) — liens personnels
// des tiers : une personne, un événement, des droits ; ni compte ni mot de passe.
// Lot 52 (EVT-06, D3 ; ADR 0094) : « day_helper », le renfort du jour J ; son lien n'ouvre que le mode
// Jour J de son évènement, de la veille au lendemain, avec un code à usage unique.
export const LINK_AUDIENCES = ["client", "vendor", "guest", "day_helper"] as const;
export type LinkAudience = (typeof LINK_AUDIENCES)[number];

// Rubriques du portail qu'un lien peut ouvrir (POR-10 : rien par défaut).
// Lot 49 (INV-02, D5) : « guests », la liste des invités et le suivi des réponses (module Invités).
// Lot 45 (POR-07, D6) : « questionnaires », ouverte à l'envoi d'un questionnaire.
// Lot 60 (L60-PLA-05) : « floorplan », le plan de salle partagé.
// Lot 55 (POR-06, MSG-03) : « messages », les sujets partagés de l'évènement et leurs fils.
export const LINK_RUBRICS = ["tasks", "program", "vendor_options", "budget", "quotes", "guests", "questionnaires", "floorplan", "messages"] as const;
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

// Lot 52 (EVT-06, D2 ; ADR 0094) — équipe d'un évènement : planner principal (un seul) et assistants.
export const EVENT_TEAM_ROLES = ["lead", "assistant"] as const;
export type EventTeamRole = (typeof EVENT_TEAM_ROLES)[number];
export type EventTeamMember = { userId: string; role: EventTeamRole };

// Lot 52 (EVT-06, D3) — renfort du jour J : nom, e-mail (pour le code à l'ouverture), téléphone facultatif.
export type DayHelperInput = { personName: string; email: string; phone?: string | null | undefined };
export type DayHelper = { linkId: string; personName: string; email: string; phone: string | null; validFrom: string; expiresOn: string; status: EventLinkStatus; lastOpenedAt: string | null };

export type OpenEventLinkResult =
  | { outcome: "opened"; sessionToken: string; maxAgeSeconds: number; audience: LinkAudience; eventId: string }
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
  places: { id: string; label: string; address: string | null; city: string | null; startTime: string | null; endTime: string | null }[];
  // Lot 37b (CHR-07, D9) : la dernière version diffusée du programme, vue du prestataire.
  program: VendorProgramView;
  // Lot 34b (CHR-02, D12) : les tâches qui lui sont confiées, qu'il coche.
  tasks: { id: string; label: string; dueDate: string; done: boolean }[];
};

// Vue du tiers : jamais de note interne ; une rubrique fermée vaut null. Lot 37b (D10) : le
// programme est la dernière version diffusée, pas le programme en cours de modification.
export type ClientEventView = {
  event: EventSummary;
  tasks: EventTask[] | null;
  program: PublishedProgramView | null;
};

// Lot 32a (D6) : « vendor_reminded », un prestataire relancé depuis le cockpit (taskLabel : son nom).
// Lot 37a (DOC-04, D7) : « document_link_opened », un lien de partage ouvert (taskLabel : l'intitulé
// du document à l'ouverture).
// Lot 44 (CRM-02) : « stage_changed », passage à une autre étape du pipeline (taskLabel : l'étape).
// Lot 47 (PAR-05, PRE-04) : réponse à un brief, facture déposée, feuille de route confirmée.
export type EventActivityKind =
  | "task_done"
  | "task_undone"
  | "decision_made"
  | "vendor_reminded"
  | "document_link_opened"
  | "stage_changed"
  | "vendor_answered"
  | "vendor_invoice_received"
  | "vendor_roadmap_confirmed";

// Lot 32a (HUB-08, UX-06) — décision du client sans réponse, pour la liste des urgences.
export type PendingDecision = { id: string; eventId: string; kind: DecisionKind; title: string; dueOn: string | null; requestedAt: string };

// Lot 32a (UX-06, D6) — prestataire retenu sans contrat signé, sur un évènement en cours.
// Lot 73a (P5, P6 ; migration 0235) : « Retenu, contrat non signé », daté du jour où il a été retenu
// (retained_at) ; null pour un prestataire retenu avant ce lot : rien n'est écrit.
export type UncontractedVendor = { candidateId: string; eventId: string; vendorId: string | null; vendorName: string; slotLabel: string; since: string | null };

// Lot 73a (PRE-02, BUD-01 ; spécification du lot 73, § 4.2, P12) — « Ajouter à un mariage… » et « Créer et
// ajouter » : « compare » met en comparaison (sans doublon), « retain » retient sur un poste libre,
// « replace » retient à la place du retenu (qui repasse en comparaison), « retain_also » retient un second
// prestataire sur le même poste. Le poste existe (slotId) ou se crée dans la même opération (newSlotLabel).
export const VENDOR_ADDITION_MODES = ["compare", "retain", "replace", "retain_also"] as const;
export type VendorAdditionMode = (typeof VENDOR_ADDITION_MODES)[number];
export type AddVendorToEventSlotInput = {
  organizationId: string;
  userId: string;
  eventId: string;
  slotId?: string;
  newSlotLabel?: string;
  // Les fiches du carnet, déjà vérifiées dans l'organisation par l'appelant (module vendors) ; le nom reste
  // en clair sur le poste, comme aujourd'hui.
  vendors: { vendorId: string; vendorName: string }[];
  mode: VendorAdditionMode;
  // Lot 52 (EVT-06) : une Planner qui ne voit que les évènements de son équipe.
  viewer?: { userId: string; role: "owner" | "member"; allPlannersSeeAll: boolean };
  now?: Date;
};
export type VendorAdditionResult =
  // Poste déjà pourvu et « retain » sans choix : rien n'est écrit, la fenêtre propose « Remplacer {nom} »
  // ou « Retenir aussi ».
  | { status: "choice_required"; retained: { candidateId: string; vendorName: string }[] }
  | {
      status: "added";
      eventId: string;
      slotId: string;
      slotLabel: string;
      slotCreated: boolean;
      mode: VendorAdditionMode;
      candidateIds: string[];
      // Les prestataires en comparaison sur le poste après l'ajout (« 3 en comparaison »).
      comparingCount: number;
      // « Remplacer » : celui qui repasse en comparaison.
      replaced: { candidateId: string; vendorName: string } | null;
      // Pour « Annuler » : valable dix secondes, par la même personne, dans la même organisation.
      undoId: string;
    };
// « Ajouter à un mariage… » : les évènements à venir (demandes comprises), le plus proche d'abord, avec
// leurs postes ; le nombre en comparaison et les retenus de chaque poste.
export type VendorAdditionEvent = {
  eventId: string;
  eventDate: string | null;
  status: EventStatus;
  isDemo: boolean;
  slots: { id: string; label: string; comparingCount: number; retained: { candidateId: string; vendorName: string; vendorId: string | null }[] }[];
};

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
  // Lot 37b (D10) : la version diffusée que le client approuve (absente avant le lot 37b).
  | { kind: "program"; programUpdatedAt: string | null; itemCount: number; programVersion?: number | undefined };

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
  // Programme approuvé puis modifié depuis la réponse (lot 37b : une version plus récente diffusée).
  programChanged: boolean;
  // Lot 47 (D6) : le choix d'une décision « options » a engagé (Retenu, autres Écartés, tâches).
  engagedAt: string | null;
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
  markContractSigned(input: MarkContractSignedInput): Promise<void>;
  taskProgressByEvent(organizationId: string, eventIds: string[], today: string): Promise<Map<string, EventTaskProgress>>;
  listAgencyOverview(input: ListAgencyOverviewInput): Promise<AgencyOverview>;
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
  // Lot 65b : nombre d'évènements (hors démonstration) où chaque fiche du carnet a été retenue.
  countWorkedWithByVendor(organizationId: string): Promise<Map<string, number>>;
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
  // Lot 63d (CHR-02, CHR-03, UX-07) : actions groupées (tâches de l'organisation seulement ; renvoie le
  // nombre de tâches changées), suppression groupée annulable, catégories des tâches.
  changeEventTasks(organizationId: string, taskIds: string[], change: BulkTaskChange): Promise<number>;
  removeEventTasks(organizationId: string, taskIds: string[]): Promise<number>;
  restoreEventTasksDeletedWith(organizationId: string, taskId: string): Promise<number>;
  listTaskCategories(organizationId: string): Promise<TaskCategory[]>;
  addStarterTaskCategories(organizationId: string, categories: StarterTaskCategoryInput[]): Promise<number>;
  createTaskCategory(organizationId: string, input: TaskCategoryInput): Promise<TaskCategory>;
  updateTaskCategory(organizationId: string, categoryId: string, input: TaskCategoryInput): Promise<void>;
  moveTaskCategory(organizationId: string, categoryId: string, direction: "up" | "down"): Promise<void>;
  removeTaskCategory(organizationId: string, categoryId: string): Promise<number>;
  countTasksByCategory(organizationId: string): Promise<Record<string, number>>;
  getEventProgram(organizationId: string, eventId: string): Promise<EventProgram>;
  // Lot 37b (CHR-07, DAT-14 ; D8, D11).
  publishEventProgram(input: PublishEventProgramInput): Promise<ProgramVersionSummary>;
  getEventProgramPublication(organizationId: string, eventId: string): Promise<ProgramPublication>;
  getEventProgramVersion(organizationId: string, eventId: string, number: number): Promise<ProgramVersion | null>;
  markLinkProgramSeen(organizationId: string, linkId: string, number: number): Promise<void>;
  // Lot 38a (D9).
  listProgramRecipients(organizationId: string, eventId: string): Promise<ProgramRecipient[]>;
  // Lot 38b (HUB-29, D11).
  listCalendarEvents(organizationId: string): Promise<CalendarEvent[]>;
  // Lot 64 (HUB-29, RDV-02 ; D1 à D6).
  getBusySettings(organizationId: string): Promise<BusySettingsView>;
  setBusySettings(organizationId: string, input: { optionsBlock?: boolean; fallback?: unknown }): Promise<BusySettingsView>;
  listEventTypeBusyRules(organizationId: string): Promise<EventTypeBusyRule[]>;
  setEventTypeBusyRule(organizationId: string, eventTypeId: string, rule: unknown | null): Promise<void>;
  getEventBusy(organizationId: string, eventId: string): Promise<EventBusyView | null>;
  setEventBusyRule(organizationId: string, eventId: string, rule: unknown | null): Promise<void>;
  listBusyRanges(organizationId: string, window: { from: Date; to: Date }, options?: { userId?: string }): Promise<BusyRangeItem[]>;
  listEventBusyRanges(organizationId: string, options?: { userId?: string }): Promise<Map<string, BusyRangeItem>>;
  notifyProgramVersion(input: NotifyProgramVersionInput): Promise<ProgramNotification>;
  addProgramItem(organizationId: string, eventId: string, item: ProgramItemInput): Promise<ProgramItem>;
  updateProgramItem(organizationId: string, itemId: string, item: ProgramItemInput): Promise<ProgramItem>;
  removeProgramItem(organizationId: string, itemId: string): Promise<void>;
  // Lot 62c (UX-13, D1) : plusieurs séquences en une transaction.
  saveProgramItems(organizationId: string, eventId: string, input: SaveProgramItemsInput): Promise<ProgramItem[]>;
  // Lot 30b (CHR-06, décision D8) : décaler des séquences de l'événement, début et fin.
  shiftProgramItems(organizationId: string, eventId: string, itemIds: string[], minutes: number): Promise<ProgramItem[]>;
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
  // Lot 37a (DOC-01, DOC-04, POR-10 ; D3, D4, D6, D7).
  listEventTaskAttachments(organizationId: string, eventId: string): Promise<EventTaskAttachment[]>;
  listEventDocumentFolders(organizationId: string, eventId: string): Promise<EventDocumentFolder[]>;
  createEventDocumentFolder(organizationId: string, eventId: string, name: string): Promise<EventDocumentFolder>;
  renameEventDocumentFolder(organizationId: string, folderId: string, name: string): Promise<void>;
  removeEventDocumentFolder(organizationId: string, folderId: string): Promise<void>;
  moveEventDocument(organizationId: string, documentId: string, folderId: string | null): Promise<void>;
  addEventDocumentVersion(input: AddEventDocumentVersionInput): Promise<EventDocument>;
  listEventDocumentVersions(organizationId: string, documentId: string): Promise<EventDocumentVersion[]>;
  getEventDocumentVersionFile(organizationId: string, documentId: string, version: number): Promise<FileDownload>;
  setEventDocumentSharing(organizationId: string, documentId: string, sharing: { clients: boolean; vendors: boolean }): Promise<void>;
  listLinkSharedDocuments(organizationId: string, linkId: string): Promise<EventDocument[]>;
  getLinkSharedDocumentFile(organizationId: string, linkId: string, documentId: string): Promise<FileDownload>;
  createEventDocumentLink(input: CreateEventDocumentLinkInput): Promise<{ link: EventDocumentShareLink; token: string; url: string }>;
  listEventDocumentLinks(organizationId: string, documentId: string): Promise<EventDocumentShareLink[]>;
  listEventDocumentVersionsOfEvent(organizationId: string, eventId: string): Promise<EventDocumentVersion[]>;
  listEventDocumentLinksOfEvent(organizationId: string, eventId: string): Promise<EventDocumentShareLink[]>;
  revokeEventDocumentLink(organizationId: string, linkId: string, now?: Date): Promise<void>;
  describeEventDocumentLink(token: string, now?: Date): Promise<{ label: string; mime: string; sizeBytes: number } | null>;
  openEventDocumentLink(token: string, now?: Date): Promise<OpenedEventDocumentLink | null>;
  listDayDocumentChoices(organizationId: string, eventId: string): Promise<DayDocumentChoice[]>;
  setDayDocumentEmbedded(input: SetDayDocumentEmbeddedInput): Promise<void>;
  // Lot 30a (JRJ-03, décision D4).
  listEventDayContacts(organizationId: string, eventId: string): Promise<EventDayContact[]>;
  addEventDayContact(organizationId: string, eventId: string, input: EventDayContactInput): Promise<EventDayContact>;
  removeEventDayContact(organizationId: string, contactId: string): Promise<void>;
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

// Lot 49 (EVT-04 premier pas, INV-03 ; D2) — temps forts d'un évènement (cérémonie, dîner, brunch) :
// le RSVP demande la présence par temps fort. Date sans heure, heure de début facultative (dans le
// fuseau de l'évènement), lieu facultatif parmi les lieux de l'évènement.
export type KeyMoment = {
  id: string;
  eventId: string;
  name: string;
  date: string;
  startTime: string | null;
  placeId: string | null;
  placeLabel: string | null;
  position: number;
  // Lot 51 (EVT-04 ; D1) : créé de lui-même pour porter le chrono, pas encore proposé aux invités.
  autoCreated: boolean;
};

export type KeyMomentInput = {
  name: string;
  date: string;
  startTime?: string | null | undefined;
  placeId?: string | null | undefined;
};

// Ce que le module Invités lit d'un évènement (ADR 0011 : par le service) : ses clients (le côté
// d'un foyer), ses dates (clôture proposée, purge), son statut (annulation), ses temps forts.
export type GuestEventContext = {
  eventId: string;
  isDemo: boolean;
  status: EventStatus;
  eventDate: string | null;
  timeZone: string;
  // Jour (Paris) de la dernière annulation, si l'évènement est annulé.
  cancelledOn: string | null;
  clients: { id: string; firstName: string; lastName: string | null }[];
  vocabulary: EventTypeAudience;
  keyMoments: KeyMoment[];
};
