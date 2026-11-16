// Lot 38a (MSG-01, MSG-02, HUB-18 ; ADR 0072) — e-mails que l'organisation adresse aux tiers : des
// modèles à variables, par nature et par langue, rendus à son image ; et le garde-fou de tout envoi
// décidé par l'équipe vers plus d'une personne.
export const EMAIL_TEMPLATE_KINDS = [
  "client_link",
  "client_link_renewed",
  "vendor_link",
  "vendor_link_renewed",
  "task_reminder",
  "quote_signature",
  "contract_signature",
  "order_first",
  "signed_copy",
  "program_published",
] as const;
export type EmailTemplateKind = (typeof EMAIL_TEMPLATE_KINDS)[number];

export const EMAIL_LOCALES = ["fr", "en"] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];

// Les variables, désignées par une clé stable ; chacune s'écrit en français ou en anglais dans un
// modèle (« {{prénom}} », « {{first_name}} »).
export const EMAIL_VARIABLES = ["first_name", "organization", "event", "event_date", "clients", "link", "valid_until", "tasks", "quote_number", "version"] as const;
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
