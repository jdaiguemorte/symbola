// Lot 51 (EVT-04, CHR-08, JRJ-05 à JRJ-09, ARC-09 ; D1 à D8, ADR 0091) — le jour J de terrain :
// pointages, décalages validés, main courante, listes de contrôle, photos, état partagé de l'équipe
// et bilan du lendemain. Toute écriture part d'une file sur l'appareil (IndexedDB), même sans
// réseau : chaque action porte un identifiant créé sur le téléphone, l'heure de l'appareil, et le
// serveur ignore une action déjà reçue.

export const DAY_CHECKPOINT_KINDS = ["started", "finished"] as const;
export type DayCheckpointKind = (typeof DAY_CHECKPOINT_KINDS)[number];

export const DAY_INCIDENT_SEVERITIES = ["info", "follow_up", "urgent"] as const;
export type DayIncidentSeverity = (typeof DAY_INCIDENT_SEVERITIES)[number];

export const DAY_CHECKLIST_PHASES = ["setup", "teardown"] as const;
export type DayChecklistPhase = (typeof DAY_CHECKLIST_PHASES)[number];

export const DAY_PHOTO_SUBJECTS = ["incident", "checklist_item", "handover"] as const;
export type DayPhotoSubject = (typeof DAY_PHOTO_SUBJECTS)[number];

export const DAY_PHOTO_REJECTIONS = ["type", "size", "virus", "unavailable"] as const;
export type DayPhotoRejection = (typeof DAY_PHOTO_REJECTIONS)[number];

export const DAY_INCIDENT_MAX = 2000;

// Les actions de la file, telles que le téléphone les envoie (la photo part à part, en fichier).
export type DayActionBase = { actionId: string; deviceAt: string };
export type DayCheckpointAction = DayActionBase & { kind: "checkpoint"; itemId: string; checkpoint: DayCheckpointKind };
export type DayShiftAction = DayActionBase & {
  kind: "shift";
  keyMomentId: string | null;
  lateItemId: string;
  minutes: number;
  itemIds: string[];
  vendorSlotIds: string[];
};
export type DayIncidentAction = DayActionBase & { kind: "incident"; body: string; severity: DayIncidentSeverity | null; keyMomentId: string | null };
export type DayCheckAction = DayActionBase & { kind: "check"; checklistItemId: string };
export type DayHandoverAction = DayActionBase & { kind: "handover"; paymentId: string };
export type DayAction = DayCheckpointAction | DayShiftAction | DayIncidentAction | DayCheckAction | DayHandoverAction;
export type DayActionKind = DayAction["kind"];

// Ce que le serveur répond pour chaque action : « applied » (écrite), « duplicate » (déjà reçue,
// ignorée), « rejected » (refusée pour de bon : séquence supprimée, décalage hors du jour…). Une
// action refusée sort de la file ; l'écran le dit.
export type DayActionStatus = "applied" | "duplicate" | "rejected";
export type DayActionOutcome = { actionId: string; status: DayActionStatus; reason?: string };

// La photo d'une action : son sujet, désigné par son identifiant (case, échéance) ou par l'action
// qui l'a créé (incident encore en file).
export type DayPhotoMeta = DayActionBase & { subject: DayPhotoSubject; subjectId: string | null; subjectActionId: string | null };

export type DayPhoto = {
  id: string;
  subject: DayPhotoSubject;
  subjectId: string;
  state: "stored" | "rejected";
  rejection: DayPhotoRejection | null;
  takenAt: string;
  takenBy: string;
};

// Le premier pointage de chaque nature, l'heure retenue (JRJ-08) ; `count` : tous les pointages.
export type DayItemActual = {
  itemId: string;
  startedAt: string | null;
  startedBy: string | null;
  finishedAt: string | null;
  finishedBy: string | null;
  count: number;
};

export type DayCheckpoint = { id: string; itemId: string; kind: DayCheckpointKind; deviceAt: string; userId: string };

export type DayShift = {
  id: string;
  keyMomentId: string | null;
  lateItemId: string | null;
  minutes: number;
  itemIds: string[];
  vendorSlotIds: string[];
  validatedAt: string;
  validatedBy: string;
  outcome: "applied" | "out_of_day" | "items_missing" | null;
  appliedAt: string | null;
  programVersion: number | null;
  notifiedAt: string | null;
  notifiedCount: number | null;
};

export type DayIncident = {
  id: string;
  actionId: string;
  keyMomentId: string | null;
  body: string;
  severity: DayIncidentSeverity | null;
  deviceAt: string;
  userId: string;
  photos: DayPhoto[];
};

export type DayChecklistItem = { id: string; label: string; position: number; checkedAt: string | null; checkedBy: string | null; photos: DayPhoto[] };
export type DayChecklist = { id: string; keyMomentId: string | null; name: string; phase: DayChecklistPhase; position: number; items: DayChecklistItem[] };

export type DayChecklistTemplate = { id: string; starterKey: string | null; name: string; phase: DayChecklistPhase; items: string[]; position: number };
export type DayChecklistTemplateInput = { name: string; phase: DayChecklistPhase; items: string[] };

// L'état partagé du jour J (JRJ-08) : ce que chaque membre voit, relu toutes les 15 s en ligne.
export type DayState = {
  eventId: string;
  checkpoints: DayCheckpoint[];
  actuals: DayItemActual[];
  shifts: DayShift[];
  incidents: DayIncident[];
  checklists: DayChecklist[];
  // Membres de l'organisation cités (pointages, cases, incidents) : identifiant et nom affiché.
  // Lot 52 (EVT-06, D3) : helper, un renfort du jour J (son lien) ; name vide : une personne de l'équipe
  // qui n'est pas nommée à un renfort.
  people: { id: string; name: string; helper?: boolean }[];
};

// Le bilan du lendemain (PAR-08, étape 7), interne à l'organisation.
export type DayReportSequence = {
  itemId: string;
  keyMomentId: string | null;
  label: string;
  plannedStart: string;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  // Écart du début réel sur le début prévu, en minutes (positif : en retard).
  startGap: number | null;
};

export type DayReportHandover = { paymentId: string; vendorName: string | null; label: string; amountCents: number; method: string | null; handoverBy: string | null; handedOverAt: string | null };

export type DayReport = {
  eventId: string;
  ready: boolean;
  // Jour à partir duquel le bilan est prêt, dans le fuseau de l'évènement.
  readyOn: string;
  preparedAt: string | null;
  sequences: DayReportSequence[];
  shifts: DayShift[];
  incidents: DayIncident[];
  uncheckedItems: { checklistName: string; label: string }[];
  checklistCount: number;
  handovers: DayReportHandover[];
};

// Lot 51 (CHR-08) — import d'un chrono depuis un tableur : l'aperçu avant d'écrire.
export const PROGRAM_IMPORT_FIELDS = ["moment", "start", "end", "label", "location", "responsible", "note"] as const;
export type ProgramImportField = (typeof PROGRAM_IMPORT_FIELDS)[number];
// Lot 63b (CHR-08) : « untimed », une ligne du PDF sans heure (« 00:00 » seul).
export type ProgramImportProblem = "start" | "end" | "label" | "moment_date" | "too_long" | "untimed";
// Lot 63b : un interlocuteur de la séquence, rattaché à un poste prestataire de l'évènement ou
// gardé en texte (témoin, marié, intervenant sans poste).
export type ProgramImportParticipant = { vendorSlotId: string | null; label: string };
export type ProgramImportRow = {
  line: number;
  moment: string | null;
  momentDate: string | null;
  startTime: string;
  endTime: string | null;
  label: string;
  location: string | null;
  responsible: string | null;
  note: string | null;
  // Lot 63b, PDF de l'ancien logiciel : interlocuteurs, repère (aucun interlocuteur), « Caché des
  // mariés », fin le lendemain. Absents pour un tableur.
  participants?: ProgramImportParticipant[];
  marker?: boolean;
  hiddenFromClients?: boolean;
  endsNextDay?: boolean;
};
// Lot 63b : un intervenant de l'en-tête du PDF et le poste de l'évènement qui lui est proposé (ou
// choisi par la planner) ; à défaut, une fiche du carnet au nom proche, pour information.
export type ProgramImportSpeaker = {
  index: number;
  role: string;
  company: string | null;
  contact: string | null;
  phone: string | null;
  // « planner » : la planner elle-même ; « client » : les mariés ; jamais rattachés.
  kind: "vendor" | "planner" | "client";
  proposedSlotId: string | null;
  slotId: string | null;
  chosen: boolean;
  catalogVendor: { id: string; name: string; city: string | null } | null;
};
export type ProgramImportPreview = {
  rows: ProgramImportRow[];
  problems: { line: number; problem: ProgramImportProblem }[];
  // Temps forts du fichier qui n'existent pas encore : l'import les crée.
  newMoments: { name: string; date: string }[];
  unknownColumns: string[];
  neutralizedCells: number;
  // Lot 63b : lu depuis le PDF de l'ancien logiciel (sinon un tableur).
  source?: "spreadsheet" | "program_pdf";
  speakers?: ProgramImportSpeaker[];
  slots?: { id: string; label: string; vendorNames: string[] }[];
};
export type ProgramImportResult =
  | { status: "rejected"; reason: "empty" | "too_large" | "infected" | "no_start_column" | "no_label_column" | "no_date" | string }
  | { status: "preview"; preview: ProgramImportPreview }
  | { status: "applied"; items: number; moments: number; skipped: number };
