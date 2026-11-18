// Lot 38a (MSG-01, MSG-02, HUB-18 ; ADR 0072) — e-mails que l'organisation adresse aux tiers : des
// modèles à variables, par nature et par langue, rendus à son image ; et le garde-fou de tout envoi
// décidé par l'équipe vers plus d'une personne.
export const EMAIL_TEMPLATE_KINDS = [
  "client_link",
  "client_link_renewed",
  "vendor_link",
  "vendor_link_renewed",
  "task_reminder",
  // Lot 46 (RDV-03, D10 ; ADR 0082) : rendez-vous, côté personne qui l'a pris.
  "appointment_confirmed",
  "appointment_reminder",
  "appointment_rescheduled",
  "appointment_cancelled",
  "quote_signature",
  "contract_signature",
  "order_first",
  "signed_copy",
  "program_published",
  // Lot 49 (INV-03, INV-04 ; D4, D10) : invitation à répondre et relance des invités.
  "guest_invitation",
  "guest_reminder",
  // Lot 44 (CRM-01 ; D7) : « Nouvelle demande de contact », à la titulaire, sans le message ni les
  // coordonnées du prospect.
  "prospect_form_received",
] as const;
export type EmailTemplateKind = (typeof EMAIL_TEMPLATE_KINDS)[number];

export const EMAIL_LOCALES = ["fr", "en"] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];

// Les variables, désignées par une clé stable ; chacune s'écrit en français ou en anglais dans un
// modèle (« {{prénom}} », « {{first_name}} »).
// Lot 38b : « place » (le lieu de réception) sert aux modèles de messages de la planner.
// Lot 46 : « appointment » (le type de rendez-vous) et « appointment_date » (jour et heure, à Paris).
export const EMAIL_VARIABLES = ["first_name", "organization", "event", "event_date", "clients", "link", "valid_until", "tasks", "quote_number", "version", "place", "appointment", "appointment_date"] as const;
export type EmailVariable = (typeof EMAIL_VARIABLES)[number];
export type EmailValues = Partial<Record<EmailVariable, string>>;

export type EmailTemplateText = { subject: string; body: string };

export type EmailTemplateView = EmailTemplateText & {
  kind: EmailTemplateKind;
  locale: EmailLocale;
  // false : le texte de départ, jamais réécrit par l'organisation.
  customized: boolean;
};

export type EmailTemplateVariableView = { key: EmailVariable; token: string; required: boolean };

// MSG-02 — les destinataires d'un envoi groupé, tels que l'écran les montre ; l'empreinte prouve au
// serveur que la liste confirmée est celle qu'il calcule au moment de l'envoi.
export type EmailRecipient = { name: string; email: string };
export type RecipientsReview = { count: number; recipients: EmailRecipient[]; digest: string };

// Lot 38b (HUB-21 ; D10 ; ADR 0072) — modèles de messages de la planner : pour tous les évènements
// ou pour un type (eventTypeId), dans une langue, versionnés. « Écrire au client » en remplit les
// variables, puis ouvre sa messagerie (Symbola n'envoie rien).
export const MESSAGE_VARIABLES = ["first_name", "clients", "event", "event_date", "place", "organization"] as const satisfies readonly EmailVariable[];

export type MessageTemplateSummary = {
  id: string;
  name: string;
  eventTypeId: string | null;
  locale: EmailLocale;
  // Numéro de la version en cours.
  version: number;
  updatedAt: string;
};

export type MessageTemplateVersionView = EmailTemplateText & { version: number; createdAt: string };

// Le texte de la version en cours, et toutes les versions, la plus récente d'abord.
export type MessageTemplateDetail = MessageTemplateSummary & EmailTemplateText & { versions: MessageTemplateVersionView[] };
