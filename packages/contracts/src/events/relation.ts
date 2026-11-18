// Lot 45 (CRM-05, CRM-06, CRM-09, POR-07, HUB-21 ; D1 à D8 ; ADR 0090) — la relation avec le
// prospect dans le module events : messages rangés dans l'historique du contact, relances préparées,
// réglage des relances, questionnaires et leurs réponses. Types échangés avec les écrans.

// —— Messages (CRM-05, CRM-03) ————————————————————————————————————————————————————————

export const EVENT_MESSAGE_KINDS = ["reply", "follow_up", "questionnaire", "answered", "stop"] as const;
export type EventMessageKind = (typeof EVENT_MESSAGE_KINDS)[number];
// « sent » : parti de Symbola ; « prepared » : ouvert dans la messagerie de la planner ; « noted » :
// un fait noté d'un geste (« a répondu », « ne plus relancer »).
export type EventMessageDelivery = "sent" | "prepared" | "noted";

export type EventMessage = {
  id: string;
  eventId: string;
  contactId: string | null;
  kind: EventMessageKind;
  delivery: EventMessageDelivery;
  subject: string | null;
  body: string | null;
  // Lien de la brochure joint au message : sa date d'expiration.
  brochureExpiresAt: string | null;
  sentByUserId: string | null;
  occurredAt: string;
};

// Le message relu et modifié par la planner, prêt à partir.
export type ProspectMessageDraft = {
  eventId: string;
  contactIds: string[];
  templateId: string | null;
  subject: string;
  body: string;
};

// —— Relances (CRM-06) ———————————————————————————————————————————————————————————————

export const FOLLOW_UP_STEPS_MAX = 3;
export type FollowUpStep = { days: number; messageTemplateId: string | null };

export type ProspectFollowUpSettings = {
  enabled: boolean;
  // D2 : désactivé par défaut ; la planner relit et envoie chaque relance.
  autoSend: boolean;
  steps: FollowUpStep[];
  brochure: { fileName: string; sizeBytes: number } | null;
};

export const FOLLOW_UP_STOP_REASONS = ["answered", "stage_changed", "confirmed", "lost", "prospect_action", "new_message", "stopped", "withdrawn", "no_recipient"] as const;
export type FollowUpStopReason = (typeof FOLLOW_UP_STOP_REASONS)[number];

export type ProspectFollowUp = {
  id: string;
  eventId: string;
  contactId: string | null;
  rank: number;
  readyAt: string;
  subject: string;
  body: string;
  sentAt: string | null;
  stoppedAt: string | null;
  stopReason: FollowUpStopReason | null;
};

// « Aujourd'hui » : une relance prête, à relire.
export type ReadyFollowUp = ProspectFollowUp & { names: string };

// —— Questionnaires (POR-07, CRM-09, HUB-21) ——————————————————————————————————————————

export const QUESTION_NATURES = ["short_text", "long_text", "single_choice", "multiple_choice", "date", "number", "amount"] as const;
export type QuestionNature = (typeof QUESTION_NATURES)[number];
// Les champs de l'évènement qu'une question peut alimenter (D7).
export const QUESTION_EVENT_FIELDS = ["event_date", "guests", "budget", "venue", "city", "style", "event_type"] as const;
export type QuestionEventField = (typeof QUESTION_EVENT_FIELDS)[number];
export const QUESTIONS_MAX = 100;
export const QUESTION_CHOICES_MAX = 30;

export type QuestionnaireQuestion = {
  key: string;
  label: string;
  help: string | null;
  nature: QuestionNature;
  choices: string[];
  eventField: QuestionEventField | null;
};

export type QuestionnaireTemplateSummary = {
  id: string;
  name: string;
  eventTypeId: string | null;
  locale: "fr" | "en";
  starterKey: string | null;
  version: number;
  questionCount: number;
  updatedAt: string;
};

export type QuestionnaireTemplateDetail = QuestionnaireTemplateSummary & { questions: QuestionnaireQuestion[]; versions: number[] };

// Une réponse : un texte, une date (AAAA-MM-JJ), un choix, plusieurs choix, un nombre, un montant
// (en centimes).
export type QuestionnaireAnswerValue = string | string[] | number;

export type QuestionnaireAnswer = { value: QuestionnaireAnswerValue; answeredAt: string };

export type EventQuestionnaire = {
  id: string;
  eventId: string;
  contactId: string | null;
  name: string;
  locale: "fr" | "en";
  templateId: string | null;
  templateVersion: number;
  questions: QuestionnaireQuestion[];
  answers: Record<string, QuestionnaireAnswer>;
  sentAt: string;
  finishedAt: string | null;
};

// Une question telle que la personne la voit : déjà connue (« known », proposée pré-remplie à
// confirmer), déjà répondue ailleurs (« answeredElsewhere », pas reposée), ou à répondre.
export type PortalQuestion = QuestionnaireQuestion & {
  answer: QuestionnaireAnswerValue | null;
  suggestion: QuestionnaireAnswerValue | null;
  answeredElsewhere: boolean;
};

// D7 — une réponse qui contredit la fiche : la planner choisit.
export type PrefillDifference = {
  questionnaireId: string;
  key: string;
  label: string;
  eventField: QuestionEventField;
  answer: QuestionnaireAnswerValue;
  current: QuestionnaireAnswerValue;
};
