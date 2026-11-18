// Lot 38a (MSG-01, MSG-02 ; D5, D6, D8 ; ADR 0072) — règles pures des modèles d'e-mails. Chaque
// nature d'e-mail a ses variables, dont certaines indispensables ; une variable s'écrit en
// français ou en anglais (« {{prénom}} », « {{first_name}} »). Le rendu remplace les variables,
// découpe le texte en paragraphes (un paragraphe fait du seul lien devient un bouton) et nomme
// chaque variable employée sans valeur : un tel e-mail ne part pas.
import { createHash } from "node:crypto";
import { MESSAGE_VARIABLES, type EmailLocale, type EmailRecipient, type EmailTemplateKind, type EmailTemplateText, type EmailTemplateVariableView, type EmailValues, type EmailVariable, type RecipientsReview } from "@symbola/contracts";

export const EMAIL_SUBJECT_MAX = 200;
export const EMAIL_BODY_MAX = 5000;

const TOKENS: Record<EmailVariable, Record<EmailLocale, string>> = {
  first_name: { fr: "prénom", en: "first_name" },
  organization: { fr: "organisation", en: "organization" },
  event: { fr: "évènement", en: "event" },
  event_date: { fr: "date_évènement", en: "event_date" },
  clients: { fr: "clients", en: "clients" },
  link: { fr: "lien", en: "link" },
  valid_until: { fr: "valable_jusqu_au", en: "valid_until" },
  tasks: { fr: "tâches", en: "tasks" },
  quote_number: { fr: "numéro_devis", en: "quote_number" },
  version: { fr: "version", en: "version" },
  place: { fr: "lieu", en: "place" },
  slot: { fr: "poste", en: "slot" },
  deadline: { fr: "date_limite", en: "deadline" },
  link_available: { fr: "lien_disponible", en: "link_available" },
  link_unavailable: { fr: "lien_indisponible", en: "link_unavailable" },
  appointment: { fr: "rendez_vous", en: "appointment" },
  appointment_date: { fr: "date_rendez_vous", en: "appointment_date" },
  // Lot 43 (FAC-08, FAC-09 ; D10).
  amount: { fr: "montant", en: "amount" },
  due_date: { fr: "échéance", en: "due_date" },
  reference: { fr: "référence", en: "reference" },
  iban: { fr: "iban", en: "iban" },
  bic: { fr: "bic", en: "bic" },
  penalties: { fr: "pénalités", en: "penalties" },
  // Lot 45 (CRM-05, POR-07) : brochure, page de réservation, nom du questionnaire.
  brochure: { fr: "brochure", en: "brochure" },
  booking_link: { fr: "lien_rendez_vous", en: "booking_link" },
  questionnaire: { fr: "questionnaire", en: "questionnaire" },
};

// Variables dont la valeur est une adresse : seules dans leur paragraphe, elles deviennent un bouton.
const LINK_VARIABLES: ReadonlySet<EmailVariable> = new Set(["link", "link_available", "link_unavailable"]);

const BY_TOKEN = new Map<string, EmailVariable>(
  (Object.entries(TOKENS) as [EmailVariable, Record<EmailLocale, string>][]).flatMap(([key, names]) => [
    [names.fr, key],
    [names.en, key],
  ]),
);

type KindRules = { variables: EmailVariable[]; required: EmailVariable[]; button: "space" | "sign" | "answer" | "manage" | "request" | "roadmap" | "questionnaire" | null };

export const EMAIL_TEMPLATE_RULES: Record<EmailTemplateKind, KindRules> = {
  client_link: { variables: ["first_name", "organization", "event", "link", "valid_until"], required: ["link"], button: "space" },
  client_link_renewed: { variables: ["first_name", "organization", "event", "link", "valid_until"], required: ["link"], button: "space" },
  vendor_link: { variables: ["first_name", "organization", "event", "clients", "event_date", "link", "valid_until"], required: ["link"], button: "space" },
  vendor_link_renewed: { variables: ["first_name", "organization", "event", "clients", "event_date", "link", "valid_until"], required: ["link"], button: "space" },
  task_reminder: { variables: ["first_name", "organization", "event", "event_date", "tasks"], required: ["tasks"], button: null },
  // Lot 46 (RDV-03, D10) : le lien de gestion du rendez-vous (report, annulation, sans compte).
  appointment_confirmed: { variables: ["first_name", "organization", "appointment", "appointment_date", "place", "link"], required: ["link"], button: "manage" },
  appointment_reminder: { variables: ["first_name", "organization", "appointment", "appointment_date", "place", "link"], required: ["link"], button: "manage" },
  appointment_rescheduled: { variables: ["first_name", "organization", "appointment", "appointment_date", "place", "link"], required: ["link"], button: "manage" },
  appointment_cancelled: { variables: ["first_name", "organization", "appointment", "appointment_date"], required: [], button: null },
  quote_signature: { variables: ["first_name", "organization", "quote_number", "link"], required: ["link"], button: "sign" },
  contract_signature: { variables: ["first_name", "organization", "quote_number", "link"], required: ["link"], button: "sign" },
  order_first: { variables: ["first_name", "organization", "quote_number"], required: [], button: null },
  signed_copy: { variables: ["first_name", "organization", "quote_number"], required: [], button: null },
  program_published: { variables: ["first_name", "organization", "event", "event_date", "clients", "version"], required: ["version"], button: null },
  // Lot 49 (INV-03, INV-04 ; D4, D10) : le lien personnel de l'invité devient le bouton « Répondre ».
  guest_invitation: { variables: ["first_name", "organization", "event", "event_date", "clients", "link", "valid_until"], required: ["link"], button: "answer" },
  guest_reminder: { variables: ["first_name", "organization", "event", "event_date", "clients", "link", "valid_until"], required: ["link"], button: "answer" },
  // Lot 44 (CRM-01 ; D7) : à la titulaire, le lien vers la fiche du prospect devient « Voir la demande » ;
  // ni le nom, ni les coordonnées, ni le message du prospect (SEC-20).
  prospect_form_received: { variables: ["organization", "event_date", "link"], required: ["link"], button: "request" },
  // Lot 47 (PRE-03, PAR-05 ; D2, D4, D8) : le brief et sa relance portent deux boutons, « Je suis
  // disponible » et « Je ne suis pas disponible », qui ouvrent la page avec le choix présélectionné ;
  // la feuille de route, un bouton vers la page où le prestataire confirme l'avoir reçue.
  vendor_brief: { variables: ["first_name", "organization", "event", "clients", "event_date", "slot", "deadline", "link", "link_available", "link_unavailable"], required: ["link_available", "link_unavailable"], button: "space" },
  vendor_brief_reminder: { variables: ["first_name", "organization", "event", "clients", "event_date", "slot", "deadline", "link", "link_available", "link_unavailable"], required: ["link_available", "link_unavailable"], button: "space" },
  vendor_roadmap: { variables: ["first_name", "organization", "event", "clients", "event_date", "link"], required: ["link"], button: "roadmap" },
  // Lot 43 (FAC-02, FAC-08, FAC-09, FAC-15 ; D10) : la proposition se lit dans l'espace du client (son
  // lien personnel n'est gardé que haché : pas de bouton) ; le RIB et la relance portent le montant et
  // la référence du virement, jamais de donnée de carte (ADR 0087).
  proposal_sent: { variables: ["first_name", "organization", "quote_number", "valid_until"], required: ["quote_number"], button: null },
  proposal_expiry_reminder: { variables: ["first_name", "organization", "quote_number", "valid_until"], required: ["valid_until"], button: null },
  payment_details: { variables: ["first_name", "organization", "quote_number", "amount", "reference", "iban", "bic"], required: ["amount", "reference", "iban"], button: null },
  invoice_reminder: { variables: ["first_name", "organization", "quote_number", "amount", "due_date", "reference", "iban", "penalties"], required: ["amount", "due_date", "reference"], button: null },
  // Lot 45 (CRM-05, CRM-06 ; D1, D2) : le texte de la planner (un modèle de message relu et modifié),
  // à l'image de l'organisation ; la brochure et la page de réservation sont des liens dans le texte.
  prospect_reply: { variables: ["first_name", "organization", "event", "event_date", "clients", "place", "brochure", "booking_link"], required: [], button: null },
  prospect_follow_up: { variables: ["first_name", "organization", "event", "event_date", "clients", "place", "brochure", "booking_link"], required: [], button: null },
  // Lot 45 (POR-07, CRM-09) : le lien personnel devient « Répondre au questionnaire ».
  questionnaire_sent: { variables: ["first_name", "organization", "event", "questionnaire", "link", "valid_until"], required: ["link"], button: "questionnaire" },
};

const TOKEN_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g;

function tokensOf(text: string): string[] {
  return [...text.matchAll(TOKEN_PATTERN)].map((match) => match[1]!);
}

// Une variable telle qu'elle s'écrit dans un modèle de cette langue ; une variable inconnue garde
// le nom trouvé dans le texte.
export function variableToken(key: string, locale: EmailLocale): string {
  const known = (TOKENS as Record<string, Record<EmailLocale, string>>)[key];
  return `{{${known ? known[locale] : key}}}`;
}

export function emailTemplateVariables(kind: EmailTemplateKind, locale: EmailLocale): EmailTemplateVariableView[] {
  const rules = EMAIL_TEMPLATE_RULES[kind];
  return rules.variables.map((key) => ({ key, token: `{{${TOKENS[key][locale]}}}`, required: rules.required.includes(key) }));
}

export type EmailTemplateProblems = { unknown: string[]; missingRequired: EmailVariable[]; tooLong: ("subject" | "body")[] };

// À l'enregistrement : variables inconnues ou étrangères à ce modèle, variables indispensables
// absentes du texte, longueurs.
export function validateEmailTemplate(kind: EmailTemplateKind, text: EmailTemplateText): EmailTemplateProblems {
  const allowed = new Set(EMAIL_TEMPLATE_RULES[kind].variables);
  const unknown: string[] = [];
  for (const token of [...tokensOf(text.subject), ...tokensOf(text.body)]) {
    const key = BY_TOKEN.get(token);
    if ((!key || !allowed.has(key)) && !unknown.includes(token)) unknown.push(token);
  }
  const inBody = new Set(tokensOf(text.body).map((token) => BY_TOKEN.get(token)));
  const missingRequired = EMAIL_TEMPLATE_RULES[kind].required.filter((key) => !inBody.has(key));
  const tooLong: ("subject" | "body")[] = [];
  if (text.subject.length > EMAIL_SUBJECT_MAX) tooLong.push("subject");
  if (text.body.length > EMAIL_BODY_MAX) tooLong.push("body");
  return { unknown, missingRequired, tooLong };
}

// variable : celle dont vient le bouton (son libellé en dépend).
export type EmailBlock = { kind: "paragraph"; text: string } | { kind: "button"; url: string; variable: EmailVariable };
export type RenderedEmail = { subject: string; blocks: EmailBlock[]; text: string; missing: EmailVariable[] };

// Remplace chaque variable permise par sa valeur ; une variable sans valeur, ou étrangère, reste
// telle quelle et s'ajoute à « missing ».
function filler(allowed: ReadonlySet<EmailVariable>, values: EmailValues, missing: EmailVariable[]) {
  return (text: string) =>
    text.replace(TOKEN_PATTERN, (whole, token: string) => {
      const key = BY_TOKEN.get(token);
      const value = key && allowed.has(key) ? values[key]?.trim() : undefined;
      if (!value) {
        const named = key ?? (token as EmailVariable);
        if (!missing.includes(named)) missing.push(named);
        return whole;
      }
      return value;
    });
}

// Au rendu : chaque variable employée doit avoir une valeur (MSG-01). Une variable étrangère à ce
// modèle compte comme vide : l'e-mail ne part pas.
export function renderEmailTemplate(kind: EmailTemplateKind, template: EmailTemplateText, values: EmailValues): RenderedEmail {
  const allowed = new Set(EMAIL_TEMPLATE_RULES[kind].variables);
  const missing: EmailVariable[] = [];
  const fill = filler(allowed, values, missing);
  const subject = fill(template.subject).replace(/\s+/g, " ").trim();
  const blocks: EmailBlock[] = template.body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph): EmailBlock => {
      const only = /^\{\{\s*([^{}\s]+)\s*\}\}$/.exec(paragraph);
      const variable = only ? BY_TOKEN.get(only[1]!) : undefined;
      if (variable && LINK_VARIABLES.has(variable)) {
        const url = fill(paragraph);
        return /^https?:\/\//.test(url) ? { kind: "button", url, variable } : { kind: "paragraph", text: url };
      }
      return { kind: "paragraph", text: fill(paragraph) };
    });
  const text = blocks.map((block) => (block.kind === "button" ? block.url : block.text)).join("\n\n");
  return { subject, blocks, text, missing };
}

// Lot 38b (HUB-21 ; D10) — les modèles de messages de la planner : les mêmes variables écrites en
// français ou en anglais, sans variable indispensable ; le texte reste brut (il part de sa propre
// messagerie). Aucune variable vide : « missing » nomme celles qui manquent.
const MESSAGE_ALLOWED = new Set<EmailVariable>(MESSAGE_VARIABLES);

export function messageTemplateVariables(locale: EmailLocale): EmailTemplateVariableView[] {
  return MESSAGE_VARIABLES.map((key) => ({ key, token: `{{${TOKENS[key][locale]}}}`, required: false }));
}

export function validateMessageTemplate(text: EmailTemplateText): EmailTemplateProblems {
  const unknown: string[] = [];
  for (const token of [...tokensOf(text.subject), ...tokensOf(text.body)]) {
    const key = BY_TOKEN.get(token);
    if ((!key || !MESSAGE_ALLOWED.has(key)) && !unknown.includes(token)) unknown.push(token);
  }
  const tooLong: ("subject" | "body")[] = [];
  if (text.subject.length > EMAIL_SUBJECT_MAX) tooLong.push("subject");
  if (text.body.length > EMAIL_BODY_MAX) tooLong.push("body");
  return { unknown, missingRequired: [], tooLong };
}

export type RenderedMessage = { subject: string; body: string; missing: EmailVariable[] };

export function renderMessageTemplate(template: EmailTemplateText, values: EmailValues): RenderedMessage {
  const missing: EmailVariable[] = [];
  const fill = filler(MESSAGE_ALLOWED, values, missing);
  return { subject: fill(template.subject).replace(/\s+/g, " ").trim(), body: fill(template.body.replace(/\r\n/g, "\n")).trim(), missing };
}

// MSG-02 — empreinte d'une liste de destinataires : adresses en minuscules, triées ; noms compris.
export function recipientsDigest(recipients: EmailRecipient[]): string {
  const normalized = recipients
    .map((recipient) => `${recipient.email.trim().toLowerCase()}\u0000${recipient.name.trim()}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(normalized).digest("hex");
}

export function reviewRecipients(recipients: EmailRecipient[]): RecipientsReview {
  return { count: recipients.length, recipients, digest: recipientsDigest(recipients) };
}

// MSG-02 — un envoi décidé par l'équipe vers plus d'une personne ne part que si l'écran du
// garde-fou a été confirmé pour cette liste exacte.
export class RecipientsNotConfirmedError extends Error {
  constructor(readonly review: RecipientsReview) {
    super("destinataires à confirmer");
    this.name = "RecipientsNotConfirmedError";
  }
}

export function assertRecipientsConfirmed(recipients: EmailRecipient[], confirmedDigest: string | null | undefined): void {
  if (recipients.length <= 1) return;
  const review = reviewRecipients(recipients);
  if (confirmedDigest !== review.digest) throw new RecipientsNotConfirmedError(review);
}

