// Lot 49 (INV-01 à INV-04, INV-07, RGP-06 à RGP-08, RGP-18 ; ADR 0083) — contrat interne du module
// Invités (ADR 0011) : le futur contrat HTTP /v1/guests si le module est extrait. Les régimes
// nominatifs ne sortent que vers la titulaire (D8) ; ailleurs, des nombres, sous un seuil
// « moins de N ».

export const GUEST_KINDS = ["adult", "child"] as const;
export type GuestKind = (typeof GUEST_KINDS)[number];

// RGP-18 : tranche d'âge d'un enfant, jamais sa date de naissance.
export const GUEST_AGE_RANGES = ["0-2", "3-5", "6-11", "12-17"] as const;
export type GuestAgeRange = (typeof GUEST_AGE_RANGES)[number];

export type GuestLocale = "fr" | "en";

// Côté d'un foyer : un client de l'évènement, ou les deux ; null : non précisé.
export type GuestSide = { kind: "client"; clientId: string } | { kind: "both" } | null;

// Qui lit : la titulaire voit les régimes nominatifs ; un membre de l'équipe et le client au
// portail ne voient que des nombres (D8, RGP-07). Le contrôle est côté serveur.
export type GuestViewer = { kind: "owner" } | { kind: "member" } | { kind: "client"; linkId: string };

export type GuestPersonInput = {
  // Personne existante, quand le foyer est modifié.
  id?: string | undefined;
  kind: GuestKind;
  firstName: string;
  lastName?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  ageRange?: GuestAgeRange | null | undefined;
};

export type HouseholdInput = {
  // Vide : les prénoms des adultes (« Jeanne et Paul Durand »).
  displayName?: string | null | undefined;
  side?: GuestSide | undefined;
  // Groupe, créé à la volée s'il n'existe pas (« Amis du lycée »).
  groupLabel?: string | null | undefined;
  language?: GuestLocale | undefined;
  // null : invité à tous les temps forts (par défaut).
  keyMomentIds?: string[] | null | undefined;
  people: GuestPersonInput[];
  // Rang, dans people, de l'adulte qui répond pour le foyer (D3) ; par défaut le premier adulte.
  respondentIndex?: number | undefined;
};

export type GuestLinkStatus = "none" | "active" | "revoked" | "expired";

export type GuestPersonView = {
  id: string;
  kind: GuestKind;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  ageRange: GuestAgeRange | null;
  // RGP-08 : la personne s'est opposée ; ses coordonnées et ses régimes sont effacés.
  opposed: boolean;
  link: { status: GuestLinkStatus; lastOpenedAt: string | null; sentAt: string | null };
  // Réponse par temps fort (absent : sans réponse).
  answers: { keyMomentId: string; attending: boolean }[];
  // Régimes nominatifs : la titulaire seule (sinon toujours null).
  diet: string[] | null;
};

export type HouseholdView = {
  id: string;
  eventId: string;
  displayName: string;
  side: GuestSide;
  groupId: string | null;
  groupLabel: string | null;
  language: GuestLocale;
  respondentGuestId: string | null;
  keyMomentIds: string[] | null;
  needsAccommodation: boolean | null;
  needsTransport: boolean | null;
  answeredAt: string | null;
  invitedAt: string | null;
  people: GuestPersonView[];
};

export type GuestListFilter = {
  // « both », ou l'identifiant d'un client de l'évènement.
  side?: string | undefined;
  groupId?: string | undefined;
  unanswered?: boolean | undefined;
};

// INV-04 : par temps fort, oui, non, en attente (personnes invitées à ce temps fort).
export type KeyMomentTally = { keyMomentId: string; name: string; date: string; yes: number; no: number; pending: number };

// RGP-07, D8 : un nombre, ou « moins de N » (fewer) pour ne pas dévoiler un régime unique.
export type DietCount = { optionId: string; label: string; kind: "diet" | "allergen"; count: number | null; fewerThan: number | null };
export type DietTally = { keyMomentId: string; name: string; counts: DietCount[] };

export type GuestEventSummary = {
  households: number;
  people: number;
  adults: number;
  children: number;
  answered: number;
  // EVT-03 : invités qui ont dit oui à au moins un temps fort.
  confirmed: number;
  tallies: KeyMomentTally[];
};

export type GuestEventSettings = {
  eventId: string;
  responsesCloseOn: string | null;
  // Proposée : 30 jours avant le premier temps fort (D13).
  suggestedCloseOn: string | null;
  askDiet: boolean;
  askAccommodation: boolean;
  askTransport: boolean;
  reminderDays: number[];
  invitationsSentAt: string | null;
};

export type GuestEventSettingsInput = {
  responsesCloseOn: string | null;
  askDiet: boolean;
  askAccommodation: boolean;
  askTransport: boolean;
  reminderDays: number[];
};

export type DietaryOptionView = { id: string; kind: "diet" | "allergen"; label: string; starterKey: string | null; hidden: boolean };

// Partie G : le module ne s'emploie qu'après la confirmation de l'analyse d'impact.
export type GuestModuleState = { impactAssessmentConfirmedAt: string | null };

// —— Import d'une liste (INV-02, D12) ——————————————————————————————————————————————

export type GuestImportRow = {
  // Numéro de la ligne dans le fichier (1 = première ligne).
  line: number;
  household: string;
  kind: GuestKind;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  ageRange: GuestAgeRange | null;
  side: string | null;
  group: string | null;
  language: GuestLocale;
};

export type GuestImportProblem = "name_missing" | "child_contact_dropped" | "household_without_contact";

// Doublon : même nom et même e-mail, ou même nom et même téléphone (normalisés), dans l'évènement ou
// dans le fichier ; signalé à l'aperçu, rien n'est écrit avant le choix.
export type GuestImportDuplicate = { line: number; with: { kind: "event"; name: string } | { kind: "file"; line: number } };

export type GuestImportPreview = {
  rows: GuestImportRow[];
  households: number;
  duplicates: GuestImportDuplicate[];
  problems: { line: number; problem: GuestImportProblem }[];
  // Colonnes de régime ou d'allergie trouvées, ignorées (seul l'invité donne son régime).
  ignoredDietColumns: string[];
  neutralizedCells: number;
  unknownColumns: string[];
};

export type GuestImportResult =
  | { status: "rejected"; reason: "empty" | "too_large" | "too_many_rows" | "too_many_columns" | "unsupported_format" | "malformed" | "infected" | "no_name_column" }
  | { status: "preview"; preview: GuestImportPreview }
  | { status: "applied"; importId: string; households: number; people: number; skipped: number };

// —— Le RSVP (INV-03, RGP-06) ——————————————————————————————————————————————————————

export type RsvpMember = {
  id: string;
  firstName: string;
  kind: GuestKind;
  ageRange: GuestAgeRange | null;
  // Temps forts auxquels la personne est invitée.
  keyMomentIds: string[];
  answers: Record<string, boolean>;
  // La personne du lien répond pour elle (le répondant répond pour tout le foyer, D3).
  canAnswerPresence: boolean;
  // Soi-même, ou un enfant si l'on se déclare son représentant légal.
  canGiveDiet: boolean;
  isSelf: boolean;
  // Régime coché (identifiants), seulement pour soi et ses enfants, avec accord.
  diet: string[] | null;
  guardianDeclared: boolean;
};

export type RsvpView = {
  status: "open" | "closed";
  organizationName: string;
  clientNames: string;
  vocabulary: "couple" | "clients";
  eventDate: string | null;
  closesOn: string;
  selfId: string;
  selfFirstName: string;
  isRespondent: boolean;
  householdName: string;
  keyMoments: { id: string; name: string; date: string; startTime: string | null; placeLabel: string | null }[];
  members: RsvpMember[];
  questions: { diet: boolean; accommodation: boolean; transport: boolean };
  dietOptions: { id: string; kind: "diet" | "allergen"; label: string }[];
  consented: boolean;
  accommodation: boolean | null;
  transport: boolean | null;
  answeredAt: string | null;
  notice: string;
  consent: { version: string; text: string; guardianTexts: Record<string, string> };
  contact: { name: string; email: string | null; phone: string | null };
};

export type RsvpAnswerInput = {
  presence: { guestId: string; keyMomentId: string; attending: boolean }[];
  // Accord aux régimes (case non précochée) et cases cochées pour soi.
  consent: boolean;
  dietOptionIds: string[];
  // Enfants : la déclaration de représentant légal, puis les cases.
  children: { guestId: string; guardianDeclared: boolean; dietOptionIds: string[] }[];
  accommodation?: boolean | null | undefined;
  transport?: boolean | null | undefined;
};

export type RsvpOutcome = { outcome: "saved"; view: RsvpView } | { outcome: "closed" } | { outcome: "invalid" };

// —— Purge (RGP-08, D9) ————————————————————————————————————————————————————————————

export type GuestPurgeStage = "diets" | "all";

export type GuestPurgeSchedule = {
  eventId: string;
  // Dernier jour de l'évènement (ou jour de l'annulation), Paris.
  baseDate: string | null;
  dietsDueOn: string | null;
  allDueOn: string | null;
  dietsPurgedAt: string | null;
  purgedAt: string | null;
  postponement: { until: string; reason: string; createdAt: string } | null;
  // Report encore possible, et date la plus lointaine admise.
  canPostpone: boolean;
  latestPostponeOn: string | null;
};

export type GuestPurgeNotice = { eventId: string; stage: GuestPurgeStage; dueOn: string };
