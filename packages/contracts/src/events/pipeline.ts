// Lot 44 (CRM-01, CRM-02 ; ADR 0084) — formulaire de contact public et pipeline en colonnes du module
// events : types échangés avec les écrans, et événement interne d'une demande reçue.
import { z } from "zod";

// —— Formulaire de contact (CRM-01) ——————————————————————————————————————————————————

// Champs facultatifs que la planner peut masquer (D3). Le nom, l'e-mail et le message de base ne se
// masquent pas ; l'e-mail ou le téléphone est obligatoire.
export const CONTACT_FORM_FIELDS = ["phone", "date", "place", "budget", "guests", "eventType", "source", "message"] as const;
export type ContactFormField = (typeof CONTACT_FORM_FIELDS)[number];

export type ContactFormSettings = {
  active: boolean;
  slug: string;
  hiddenFields: ContactFormField[];
  privacyPolicyUrl: string | null;
  // Sites de la planner qui peuvent encadrer le formulaire (D1) : origines https, cinq au plus.
  allowedOrigins: string[];
  // « Nouvelle demande de contact » à la titulaire (D7).
  notifyOwner: boolean;
  locale: "fr" | "en";
};

// Ce que la page publique montre : rien de personnel, seulement les listes de l'organisation.
export type PublicContactForm = {
  organizationId: string;
  slug: string;
  organizationName: string;
  hiddenFields: ContactFormField[];
  privacyPolicyUrl: string;
  allowedOrigins: string[];
  eventTypes: { id: string; label: string }[];
  sources: { id: string; label: string }[];
};

export type ContactSubmission = {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  eventDate: string | null;
  period: string | null;
  place: string | null;
  budgetCents: number | null;
  budgetRange: string | null;
  guests: number | null;
  eventTypeId: string | null;
  sourceId: string | null;
  message: string | null;
};

// Issue d'un envoi : « created » (prospect créé), « to_review » (mis de côté) ; « ignored » (robot,
// débit, délai) ne se distingue pas d'un succès côté prospect (D4).
export type ContactSubmissionOutcome = { kind: "created"; eventId: string } | { kind: "to_review"; requestId: string } | { kind: "ignored" };

// Une demande « à vérifier » (D4), telle que la planner la relit avant de l'accepter ou de l'effacer.
export type ProspectRequestToReview = {
  id: string;
  receivedAt: string;
  name: string;
  email: string | null;
  phone: string | null;
  eventDate: string | null;
  period: string | null;
  message: string | null;
};

// La demande rattachée à un évènement : message et période, affichés tels quels.
export type EventProspectRequest = {
  id: string;
  receivedAt: string;
  message: string | null;
  period: string | null;
  budgetRange: string | null;
};

// —— Pipeline (CRM-02) ————————————————————————————————————————————————————————————————

export type PipelineStage = { id: string; label: string; position: number; cardCount: number };

export type PipelineCard = {
  eventId: string;
  names: string;
  eventDate: string | null;
  period: string | null;
  guestsEstimated: number | null;
  wantedBudgetCents: number | null;
  budgetRange: string | null;
  sourceLabel: string | null;
  // Étape de la carte (une option sans étape est à la première).
  stageId: string;
  // Entrée dans l'étape (dernier passage, ou création) et dernière activité (ordre des cartes, D11).
  stageSince: string;
  lastActivityAt: string;
  // Date déjà prise par un autre évènement en cours (CRM-04).
  dateTaken: boolean;
  isDemo: boolean;
};

export type Pipeline = { stages: PipelineStage[]; cards: PipelineCard[] };

// —— Événement interne ———————————————————————————————————————————————————————————————

// Une demande reçue par le formulaire de contact. Aucune donnée personnelle : des identifiants et
// l'état (SEC-20, D5) ; eventId est nul pour une demande mise de côté.
export const EVT_PROSPECT_RECEIVED = "events.prospect.received";
export const EVT_PROSPECT_RECEIVED_VERSION = 1;

export const prospectReceivedPayloadSchema = z.object({
  requestId: z.string().uuid(),
  eventId: z.string().uuid().nullable(),
  state: z.enum(["received", "to_review"]),
});

export type ProspectReceivedPayload = z.infer<typeof prospectReceivedPayloadSchema>;
