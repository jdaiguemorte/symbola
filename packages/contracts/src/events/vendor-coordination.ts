// Lot 47 (PAR-05, PRE-03, PRE-04, PRE-09, BUD-05 ; D1 à D10 ; ADR 0085) — contrat interne des
// prestataires par lien : brief par poste envoyé à plusieurs prestataires, réponse du prestataire
// par son lien, comparatif et scénarios, avis et choix du client qui engage, feuille de route.
// Montants : entiers en centimes, EUR, TTC (ce que paie le client). Dates : « AAAA-MM-JJ ».
import { z } from "zod";

export const VENDOR_AVAILABILITIES = ["available", "unavailable"] as const;
export type VendorAvailability = (typeof VENDOR_AVAILABILITIES)[number];

// Motif d'un prestataire écarté : il s'est dit indisponible, ou un autre a été choisi.
export type VendorDismissalReason = "unavailable" | "other_chosen";

// D1, D10 : le brief d'un poste ; le budget indicatif n'est montré au prestataire que si showBudget.
export type VendorBrief = {
  id: string;
  eventId: string;
  vendorSlotId: string;
  need: string;
  guestCount: number | null;
  indicativeBudgetCents: number | null;
  showBudget: boolean;
  deadline: string;
  sentAt: string | null;
  // Inspirations : documents de l'évènement, choisis un par un.
  documentIds: string[];
};

export type SaveVendorBriefInput = {
  organizationId: string;
  eventId: string;
  vendorSlotId: string;
  need: string;
  guestCount: number | null;
  indicativeBudgetCents: number | null;
  showBudget: boolean;
  deadline: string;
  documentIds: string[];
};

// Un destinataire du brief : un prestataire consulté du poste et l'adresse où lui écrire.
export type VendorBriefRecipient = { candidateId: string; name: string; email: string };

export type SendVendorBriefInput = {
  organizationId: string;
  eventId: string;
  vendorSlotId: string;
  sentByUserId: string;
  recipients: VendorBriefRecipient[];
  // MSG-02 : l'empreinte de la liste confirmée sur l'écran de contrôle des destinataires.
  confirmedDigest: string | null;
  locale: "fr" | "en";
  now?: Date | undefined;
};

export type VendorBriefDelivery = { sent: number; deferred: number };

// Partie F : réglages de l'organisation (titulaire).
export type VendorFollowUpTaskSetting = { label: string; dueInDays: number };
export type VendorCoordinationSettings = {
  briefDeadlineDays: number;
  briefReminder: boolean;
  roadmapMonth: boolean;
  roadmapWeek: boolean;
  roadmapAlertDays: number;
  // Liste de l'organisation (HUB-20) ; à défaut, la liste de départ dans sa langue et son métier.
  followUpTasks: VendorFollowUpTaskSetting[];
  followUpTasksCustomized: boolean;
};
export type SaveVendorCoordinationSettingsInput = {
  organizationId: string;
  briefDeadlineDays: number;
  briefReminder: boolean;
  roadmapMonth: boolean;
  roadmapWeek: boolean;
  roadmapAlertDays: number;
  // null : revenir à la liste de départ.
  followUpTasks: VendorFollowUpTaskSetting[] | null;
};

// --- Ce que voit le prestataire par son lien (PRE-04 ; D3) ---

// consultation : le brief et une action ; declined : « un autre choix a été fait » (ou il a dit
// non) ; retained : l'espace complet ; none : pas de brief et pas retenu (lien d'avant le lot 47).
export type VendorLinkStage = "consultation" | "declined" | "retained" | "none";

export type VendorConsultationView = {
  stage: VendorLinkStage;
  vendorName: string;
  slotLabel: string;
  clientFirstNames: string[];
  eventDate: string | null;
  // Lieux de l'évènement : intitulé et ville seulement en consultation.
  places: { id: string; label: string; city: string | null }[];
  brief: {
    need: string;
    guestCount: number | null;
    // null quand la planner ne le montre pas (D10).
    budgetCents: number | null;
    deadline: string;
    documents: { id: string; label: string; mime: string }[];
  } | null;
  answer: {
    availability: VendorAvailability | null;
    answeredAt: string | null;
    message: string | null;
    quoteAmountCents: number | null;
    hasQuoteFile: boolean;
  };
  // Le prestataire peut encore répondre ou changer d'avis (la planner n'a pas tranché).
  canAnswer: boolean;
};

export type AnswerVendorBriefInput = {
  organizationId: string;
  linkId: string;
  availability: VendorAvailability;
  message?: string | null | undefined;
  quoteAmountCents?: number | null | undefined;
  now?: Date | undefined;
};

// --- Comparatif (PRE-03, BUD-05) ---

export type VendorOptionFeedbackView = { opinion: "like" | "dislike" | null; comment: string | null; personName: string | null; updatedAt: string };

export type VendorComparisonRow = {
  candidateId: string;
  vendorId: string | null;
  vendorName: string;
  status: string;
  availability: VendorAvailability | null;
  dismissalReason: VendorDismissalReason | null;
  quoteAmountCents: number | null;
  hasQuoteFile: boolean;
  answerMessage: string | null;
  answeredAt: string | null;
  remindedAt: string | null;
  shownToClients: boolean;
  internalNotes: string[];
  // D7 : avis des clients sur cette option (décisions « options » du poste).
  feedback: VendorOptionFeedbackView[];
  hasInvoice: boolean;
};

export type VendorComparison = {
  slot: { id: string; label: string };
  brief: VendorBrief | null;
  // Triées par montant (les devis sans montant à la fin).
  rows: VendorComparisonRow[];
};

// --- Scénarios (BUD-05 ; D5) ---

export type VendorScenario = { id: string; eventId: string; name: string; position: number; choices: { vendorSlotId: string; candidateId: string }[] };

export type ScenarioLine = { vendorSlotId: string; candidateId: string | null; vendorName: string | null; amountCents: number | null };
export type ScenarioColumn = {
  scenario: VendorScenario;
  lines: ScenarioLine[];
  totalCents: number;
  // Prestataires choisis dont le devis n'a pas de montant : « à préciser ».
  pendingCount: number;
};
export type ScenarioComparison = { slots: { id: string; label: string }[]; columns: ScenarioColumn[] };

// --- Choix du client (PRE-09 ; D6, D7) ---

export type SetOptionFeedbackInput = {
  organizationId: string;
  linkId: string;
  decisionId: string;
  candidateId: string;
  opinion: "like" | "dislike" | null;
  comment: string | null;
};

// D6 : la planner modifie le prestataire retenu d'un poste à tout moment : un autre prestataire
// consulté du poste, ou personne (null).
export type ChangeRetainedVendorInput = { organizationId: string; eventId: string; vendorSlotId: string; candidateId: string | null; userId: string; now?: Date | undefined };

// --- Feuille de route (PAR-05 étapes 5 et 6 ; D8) ---

export const VENDOR_ROADMAP_STAGES = ["j30", "j7"] as const;
export type VendorRoadmapStage = (typeof VENDOR_ROADMAP_STAGES)[number];

export type VendorRoadmapStatus = { stage: VendorRoadmapStage; sentAt: string; confirmedAt: string | null; programVersion: number | null };

export type VendorRoadmapView = {
  sent: VendorRoadmapStatus[];
  // La dernière feuille envoyée attend une confirmation.
  awaitingConfirmation: boolean;
  dayContacts: { name: string; role: string | null; phone: string }[];
  invoice: { documentId: string; uploadedAt: string } | null;
};

// Pour la fiche : feuille de route et facture de chaque prestataire retenu.
export type VendorFollowUpStatus = { candidateId: string; roadmaps: VendorRoadmapStatus[]; invoiceDocumentId: string | null; hasLink: boolean };

// « Aujourd'hui » de la planner : réponse d'un prestataire, feuille de route non confirmée, choix
// du client engagé (annulable).
export type VendorAnswerNotice = { candidateId: string; eventId: string; vendorSlotId: string; vendorName: string; slotLabel: string; availability: VendorAvailability; hasQuote: boolean; answeredAt: string };
export type VendorRoadmapAlert = { candidateId: string; eventId: string; vendorName: string; sentAt: string };
export type EngagedChoiceNotice = { decisionId: string; eventId: string; vendorSlotId: string; vendorName: string; slotLabel: string; engagedAt: string };

// --- Événements internes (ARC-05, ADR 0014) ---

// Un prestataire a répondu à un brief par son lien (disponibilité, devis). Ni nom ni montant :
// le journal des événements n'est pas un registre de données personnelles.
export const EVT_VENDOR_ANSWERED = "events.vendor.answered";
export const EVT_VENDOR_ANSWERED_VERSION = 1;
export const vendorAnsweredPayloadSchema = z.object({
  eventId: z.string().uuid(),
  vendorSlotId: z.string().uuid(),
  candidateId: z.string().uuid(),
  availability: z.enum(VENDOR_AVAILABILITIES),
  withQuote: z.boolean(),
  linkId: z.string().uuid(),
});
export type VendorAnsweredPayload = z.infer<typeof vendorAnsweredPayloadSchema>;

// D6 : le client a choisi une option ; le choix engage (Retenu, autres Écartés, tâches de suivi).
export const EVT_VENDOR_OPTION_CHOSEN = "events.vendor_option.chosen";
export const EVT_VENDOR_OPTION_CHOSEN_VERSION = 1;
export const vendorOptionChosenPayloadSchema = z.object({
  eventId: z.string().uuid(),
  vendorSlotId: z.string().uuid(),
  decisionId: z.string().uuid(),
  candidateId: z.string().uuid(),
  dismissedCandidateIds: z.array(z.string().uuid()),
  taskIds: z.array(z.string().uuid()),
  linkId: z.string().uuid(),
});
export type VendorOptionChosenPayload = z.infer<typeof vendorOptionChosenPayloadSchema>;

// D6 : un prestataire cesse d'être retenu par le choix de la planner (un autre retenu à sa place, ou
// personne). Le module Budget libère l'engagé des lignes de ce prestataire, s'il vaut encore ce que
// la retenue avait engagé (amountCents : son devis à cet instant). Ni nom ni montant du client.
export const EVT_VENDOR_RETENTION_RELEASED = "events.vendor_retention.released";
export const EVT_VENDOR_RETENTION_RELEASED_VERSION = 1;
export const vendorRetentionReleasedPayloadSchema = z.object({
  eventId: z.string().uuid(),
  vendorSlotId: z.string().uuid(),
  candidateId: z.string().uuid(),
  amountCents: z.number().int().nonnegative().nullable(),
  releasedByUserId: z.string().uuid(),
});
export type VendorRetentionReleasedPayload = z.infer<typeof vendorRetentionReleasedPayloadSchema>;
