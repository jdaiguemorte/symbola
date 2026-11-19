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
  // Lot 47 (PRE-03, PAR-05 ; D2, D4, D8, D9 ; ADR 0085) : brief à un prestataire, sa relance la veille
  // de la date limite, feuille de route à J-30 et J-7.
  "vendor_brief",
  "vendor_brief_reminder",
  "vendor_roadmap",
  // Lot 43 (FAC-02, FAC-08, FAC-09, FAC-15 ; D10 ; ADR 0089) : proposition envoyée, relance avant
  // l'expiration, RIB et référence du virement (8e jour hors établissement), relance d'impayé.
  "proposal_sent",
  "proposal_expiry_reminder",
  "payment_details",
  "invoice_reminder",
  // Lot 45 (CRM-05, CRM-06, POR-07 ; D9 ; ADR 0090) : réponse de la planner à un prospect et relance
  // (le texte relu et modifié par la planner, à l'image de l'organisation) ; questionnaire envoyé (le
  // lien personnel devient « Répondre »).
  "prospect_reply",
  "prospect_follow_up",
  "questionnaire_sent",
  // Lot 52 (HUB-04, EVT-06, SEC-08 ; D1, D3, D6 ; ADR 0094) : connexion depuis un nouvel appareil (« Ce
  // n'est pas moi »), changement d'adresse ou de facteur (à l'ancienne adresse), confirmation du transfert
  // de propriété, lien du renfort du jour J.
  "new_device_login",
  "identity_changed",
  "ownership_transfer",
  "day_helper_link",
  // Lot 53 (HUB-15, UX-16, HUB-28 ; D1, D5 ; ADR 0095) : récapitulatif du matin et alerte immédiate, à
  // l'équipe (la sorte en objet, rien de personnel) ; rappel au payeur sept jours avant l'échéance.
  "daily_digest",
  "payment_due_reminder",
  "notification_alert",
] as const;
export type EmailTemplateKind = (typeof EMAIL_TEMPLATE_KINDS)[number];

export const EMAIL_LOCALES = ["fr", "en"] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];

// Les variables, désignées par une clé stable ; chacune s'écrit en français ou en anglais dans un
// modèle (« {{prénom}} », « {{first_name}} »).
// Lot 38b : « place » (le lieu de réception) sert aux modèles de messages de la planner.
// Lot 46 : « appointment » (le type de rendez-vous) et « appointment_date » (jour et heure, à Paris).
// Lot 47 (PRE-03 ; D4) : « slot » (le poste), « deadline » (date limite du brief), et deux liens qui
// deviennent les boutons « Je suis disponible » et « Je ne suis pas disponible ».
// Lot 43 : « amount » (montant de l'échéance), « due_date » (son échéance), « reference » (référence du
// virement), « iban » et « bic » (RIB de l'organisation), « penalties » (phrase des pénalités de retard,
// toujours renseignée : texte de départ de payment-reminders.json quand il n'y en a pas).
// Lot 45 : « brochure » (le lien sécurisé de la brochure de l'organisation, valable 30 jours),
// « booking_link » (la page de réservation des rendez-vous, ou des créneaux à compléter sans elle) et
// « questionnaire » (le nom du questionnaire envoyé).
// Lot 52 : « valid_from » (premier jour du lien du renfort), « device » (l'appareil de la connexion),
// « date_time » (jour et heure, à Paris) et « change » (ce qui a changé dans le compte).
// Lot 53 (HUB-24, HUB-15) : « client_term » (le terme qui désigne les clients du type d'évènement),
// « digest » (les lignes du récapitulatif) et « alert » (la phrase d'une alerte).
export const EMAIL_VARIABLES = ["first_name", "organization", "event", "event_date", "clients", "link", "valid_until", "tasks", "quote_number", "version", "place", "appointment", "appointment_date", "slot", "deadline", "link_available", "link_unavailable", "amount", "due_date", "reference", "iban", "bic", "penalties", "brochure", "booking_link", "questionnaire", "valid_from", "device", "date_time", "change", "client_term", "digest", "alert"] as const;
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
// Lot 45 (CRM-05) : « brochure » (remplie à l'envoi : son lien n'existe qu'une fois le message envoyé ou
// préparé) et « booking_link » (la page de réservation, ou des créneaux à compléter dans le texte).
export const MESSAGE_VARIABLES = ["first_name", "clients", "event", "event_date", "place", "organization", "brochure", "booking_link"] as const satisfies readonly EmailVariable[];
// Les variables qu'un message garde telles quelles jusqu'à l'envoi.
export const MESSAGE_SEND_TIME_VARIABLES = ["brochure"] as const satisfies readonly EmailVariable[];

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
