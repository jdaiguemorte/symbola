// Lot 38a (MSG-01, HUB-18 ; D2, D4, D5, D7 ; ADR 0072) — les e-mails à l'image de l'organisation.
// Un e-mail adressé aux tiers part de son modèle (email-templates.ts), rendu avec ses variables :
// une variable employée sans valeur arrête l'envoi (EmailVariableMissingError). Il porte son logo
// (joint en ligne) ou son nom, la couleur de ses documents (ADR 0046), ses coordonnées en pied ; son
// nom est le nom affiché de l'expéditeur, l'adresse reste celle de Symbola, les réponses vont à son
// adresse de contact. L'essai part à la personne connectée seulement. Les e-mails de Symbola
// (sécurité, équipe) ont un texte fixe et la même mise en page, à l'image de Symbola.
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { appDatabase } from "@symbola/db/client";
import { listTeam } from "@symbola/auth";
import { renderMailHtml, renderMailText, reserveOrganizationMail, sendMail, type MailBlock, type MailLayout } from "@symbola/mail";
import { starterDocumentStyle } from "@symbola/starter-templates";
import type { EmailLocale, EmailTemplateKind, EmailTemplateText, EmailValues, EmailVariable } from "@symbola/contracts";
import { DOCUMENT_INK, documentAppearance } from "@/lib/documents/appearance";
import { loadDocumentLogo, type DocumentLogo } from "@/lib/document-logo";
import { getDocumentSettings } from "@/modules/quotes/service";
import { EMAIL_TEMPLATE_RULES, renderEmailTemplate, variableToken } from "./email-template-rules";
import { getEmailTemplate } from "./email-templates";
import { jobKeyExists, queueAndSendEmail } from "./jobs";
import { randomUUID } from "node:crypto";
import { parseEnv } from "@symbola/env";
import { organizationFromAddress } from "./email-deliveries";
import { deliveryReference, messageIdDomain } from "./sender-address-rules";
import { DELIVERY_HEADER } from "./scaleway-webhook";
import { findOrganizationById, findOrganizationProfile, findUserContact } from "./repository";
import { preparesRelationEmail } from "./relation-mail";

const LOGO_CID = "logo@symbola";
const PLACEHOLDER_LINK = "https://symbola.invalid/lien";

type Attachment = { filename: string; content: Buffer; contentType: string; cid?: string };

function translator(locale: EmailLocale) {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Emails" });
}

// tokens : les variables comme elles s'écrivent dans le modèle, pour le message à l'équipe.
export class EmailVariableMissingError extends Error {
  readonly tokens: string[];
  constructor(
    readonly missing: EmailVariable[],
    readonly kind: EmailTemplateKind,
    readonly locale: EmailLocale,
  ) {
    super(`variable d'e-mail sans valeur : ${missing.join(", ")}`);
    this.name = "EmailVariableMissingError";
    this.tokens = missing.map((key) => variableToken(key, locale));
  }
}

type OrganizationIdentity = {
  name: string;
  logo: DocumentLogo | null;
  accent: string;
  onAccent: string;
  footerLines: string[];
  replyTo: string | null;
  // Lot 55 (MSG-04 révisée) : l'adresse d'expédition de l'organisation (null : celle de SMTP_FROM).
  fromAddress: string | null;
};

async function organizationIdentity(organizationId: string): Promise<OrganizationIdentity> {
  const db = appDatabase();
  const [organization, profile, team, settings, fromAddress] = await Promise.all([
    findOrganizationById(db, organizationId),
    findOrganizationProfile(db, organizationId),
    listTeam(db, organizationId),
    getDocumentSettings(organizationId),
    organizationFromAddress(organizationId),
  ]);
  const name = organization?.name ?? "";
  const owner = team.find((member) => member.role === "owner" && !member.disabledAt)?.email ?? null;
  const replyTo = profile?.contactEmail ?? owner;
  const appearance = documentAppearance(settings.color, null, starterDocumentStyle("fr").defaultColor);
  const contact = [replyTo, profile?.contactPhone].filter((value): value is string => Boolean(value)).join(" · ");
  const footerLines = [name, profile?.address ?? null, contact || null, profile?.website ?? null].filter((line): line is string => Boolean(line));
  return { name, logo: await loadDocumentLogo(organizationId, profile?.logoKey ?? null), accent: appearance.accent, onAccent: appearance.onAccent, footerLines, replyTo, fromAddress };
}

function logoAttachment(logo: DocumentLogo | null): Attachment[] {
  if (!logo) return [];
  return [{ filename: `logo.${logo.format === "png" ? "png" : "jpg"}`, content: logo.data, contentType: logo.format === "png" ? "image/png" : "image/jpeg", cid: LOGO_CID }];
}

export type ComposedEmail = {
  subject: string;
  text: string;
  html: string;
  attachments: Attachment[];
  fromName: string;
  replyTo: string | null;
  fromAddress: string | null;
  layout: MailLayout;
};

function layoutOf(input: { kind: EmailTemplateKind; locale: EmailLocale; identity: OrganizationIdentity; template: EmailTemplateText; values: EmailValues; banner: string | null }) {
  const values: EmailValues = { organization: input.identity.name, ...input.values };
  const rendered = renderEmailTemplate(input.kind, input.template, values);
  const t = translator(input.locale);
  const button = EMAIL_TEMPLATE_RULES[input.kind].button;
  const label = button === "sign" ? t("button.sign") : button === "answer" ? t("button.answer") : button === "manage" ? t("button.manage") : button === "request" ? t("button.request") : button === "roadmap" ? t("button.roadmap") : button === "questionnaire" ? t("button.questionnaire") : button === "open" ? t("button.open") : button === "dayOf" ? t("button.dayOf") : button === "confirm" ? t("button.confirm") : button === "notMe" ? t("button.notMe") : button === "account" ? t("button.account") : button === "message" ? t("button.message") : t("button.space");
  // Lot 47 (D4) : les deux réponses d'un brief ont leur propre libellé.
  const labelOf = (variable: EmailVariable) => (variable === "link_available" ? t("button.available") : variable === "link_unavailable" ? t("button.unavailable") : label);
  const blocks: MailBlock[] = rendered.blocks.map((block) => (block.kind === "button" ? { kind: "button", url: block.url, label: labelOf(block.variable) } : block));
  const layout: MailLayout = {
    lang: input.locale,
    subject: rendered.subject,
    senderName: input.identity.name,
    logoCid: input.identity.logo ? LOGO_CID : null,
    accent: input.identity.accent,
    textOnAccent: input.identity.onAccent,
    blocks,
    footerLines: input.identity.footerLines,
    footerNote: t("footerNote"),
    banner: input.banner,
  };
  return { layout, missing: rendered.missing };
}

// Le modèle de l'organisation (ou le texte donné : aperçu et essai d'un texte pas encore
// enregistré), rendu à son image. Une variable employée sans valeur lève EmailVariableMissingError.
export async function composeOrganizationEmail(input: {
  organizationId: string;
  kind: EmailTemplateKind;
  locale: EmailLocale;
  values: EmailValues;
  template?: EmailTemplateText;
  banner?: string | null;
}): Promise<ComposedEmail> {
  const [identity, template] = await Promise.all([organizationIdentity(input.organizationId), input.template ?? getEmailTemplate(input.organizationId, input.kind, input.locale)]);
  const { layout, missing } = layoutOf({ kind: input.kind, locale: input.locale, identity, template, values: input.values, banner: input.banner ?? null });
  if (missing.length > 0) throw new EmailVariableMissingError(missing, input.kind, input.locale);
  return {
    subject: layout.subject,
    text: renderMailText(layout),
    html: renderMailHtml(layout),
    attachments: logoAttachment(identity.logo),
    fromName: identity.name,
    replyTo: identity.replyTo,
    fromAddress: identity.fromAddress,
    layout,
  };
}

// Lot 65d (MSG-01 ; ADR 0110) — le message de la relation préparé pour la messagerie de la planner :
// l'objet et le texte brut, sans mise en page ni pied (sa messagerie ajoute sa signature) ; un lien
// devient une ligne « Libellé : adresse ». Une variable employée sans valeur lève
// EmailVariableMissingError, comme pour un envoi.
export async function composePreparedEmailText(input: { organizationId: string; kind: EmailTemplateKind; locale: EmailLocale; values: EmailValues; template?: EmailTemplateText }): Promise<{ subject: string; body: string }> {
  const [identity, template] = await Promise.all([organizationIdentity(input.organizationId), input.template ?? getEmailTemplate(input.organizationId, input.kind, input.locale)]);
  const { layout, missing } = layoutOf({ kind: input.kind, locale: input.locale, identity, template, values: input.values, banner: null });
  if (missing.length > 0) throw new EmailVariableMissingError(missing, input.kind, input.locale);
  const separator = input.locale === "en" ? ": " : " : ";
  const body = layout.blocks.map((block) => (block.kind === "button" ? `${block.label}${separator}${block.url}` : block.text)).join("\n\n");
  return { subject: layout.subject, body };
}

// Avant un geste qu'on ne défait pas (créer un lien, demander une signature) : l'e-mail qui suivra
// pourra-t-il partir ? Le lien, pas encore connu, est remplacé par une adresse d'attente.
export async function assertOrganizationEmailReady(input: { organizationId: string; kind: EmailTemplateKind; locale: EmailLocale; values: EmailValues }): Promise<void> {
  await composeOrganizationEmail({ ...input, values: { link: PLACEHOLDER_LINK, ...input.values } });
}

// Compose, réserve l'envoi dans le plafond de l'organisation (SEC-22, lot 24b), puis l'inscrit dans
// la file des tâches et le tente aussitôt (lot 40b, ARC-10) : un serveur d'envoi qui ne répond pas
// le fait repartir plus tard. Une variable vide arrête tout avant la réservation. idempotencyKey (des
// identifiants, jamais d'adresse) : un e-mail déjà inscrit sous cette clé ne repart pas.
export async function sendOrganizationEmail(input: {
  organizationId: string;
  to: string;
  kind: EmailTemplateKind;
  locale: EmailLocale;
  values: EmailValues;
  // Lot 45 (CRM-05, CRM-06) : le texte relu et modifié par la planner, à la place du modèle.
  template?: EmailTemplateText;
  attachments?: Attachment[];
  reserve?: boolean;
  idempotencyKey?: string;
  // Lot 55 (MSG-05) : l'évènement de l'e-mail, pour le journal des envois par évènement.
  eventId?: string | null;
  // Lot 65d (Q45, décision de Julien du 22/11/2026) : la seule exception au garde-fou ci-dessous, le
  // programme décalé le jour J (JRJ-05), qui part toujours de Symbola.
  dayOfShift?: true;
}): Promise<{ deferred: boolean; prepared?: true }> {
  // Lot 65d (MSG-01 ; ADR 0110) : garde-fou. Un message de la relation ne part jamais de Symbola quand
  // l'organisation l'envoie de sa messagerie ; l'appelant dépose un message préparé (depositPreparedEmail).
  if (!(input.dayOfShift && input.kind === "program_published") && (await preparesRelationEmail(input.organizationId, input.kind))) {
    console.error(`message de la relation non envoyé par Symbola (${input.kind}) : l'organisation l'envoie de sa messagerie`);
    return { deferred: false, prepared: true };
  }
  const mail = await composeOrganizationEmail(input);
  if (input.idempotencyKey && (await jobKeyExists(input.organizationId, input.idempotencyKey))) return { deferred: false };
  if (input.reserve !== false) await reserveOrganizationMail(input.organizationId);
  // Lot 55 (MSG-05) : l'identifiant du message porte la ligne du journal, que le webhook retrouve.
  const env = parseEnv(process.env);
  const deliveryId = randomUUID();
  const reference = deliveryReference(input.organizationId, deliveryId, messageIdDomain(env.SMTP_SENDER_MODE, env.SMTP_FROM_DOMAIN, env.SMTP_FROM));
  // deferred : l'envoi immédiat a échoué ; la file le reprend. Un appelant peut le dire à la personne.
  const outcome = await queueAndSendEmail(input.organizationId, {
    to: input.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    fromName: mail.fromName,
    ...(mail.fromAddress ? { fromAddress: mail.fromAddress } : {}),
    messageId: `<${reference}>`,
    // Recopié par Scaleway dans ses évènements (email_headers) : le webhook retrouve la ligne du journal.
    headers: { [DELIVERY_HEADER]: reference },
    ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    attachments: [...mail.attachments, ...(input.attachments ?? [])],
  }, input.idempotencyKey, { id: deliveryId, reference, kind: input.kind, eventId: input.eventId ?? null });
  return { deferred: outcome === "retry" || outcome === "failed" };
}

// Données fictives de l'aperçu et de l'essai : celles de l'exemple de l'aide, dans la langue du modèle.
function sampleValues(locale: EmailLocale): EmailValues {
  const t = translator(locale);
  return {
    first_name: t("sample.firstName"),
    event: t("sample.event"),
    event_date: t("sample.eventDate"),
    clients: t("sample.clients"),
    link: t("sample.link"),
    valid_until: t("sample.validUntil"),
    tasks: t("sample.tasks"),
    quote_number: t("sample.quoteNumber"),
    version: t("sample.version"),
    place: t("sample.place"),
    appointment: t("sample.appointment"),
    appointment_date: t("sample.appointmentDate"),
    slot: t("sample.slot"),
    deadline: t("sample.deadline"),
    link_available: t("sample.link"),
    link_unavailable: t("sample.link"),
    // Lot 43 (FAC-08, FAC-09) : un RIB, un montant et une référence fictifs.
    amount: t("sample.amount"),
    due_date: t("sample.dueDate"),
    reference: t("sample.reference"),
    iban: t("sample.iban"),
    bic: t("sample.bic"),
    penalties: t("sample.penalties"),
    brochure: t("sample.brochure"),
    booking_link: t("sample.bookingLink"),
    questionnaire: t("sample.questionnaire"),
    valid_from: t("sample.validFrom"),
    device: t("sample.device"),
    date_time: t("sample.dateTime"),
    change: t("sample.change"),
    // Lot 53 (HUB-24, HUB-15).
    client_term: t("sample.clientTerm"),
    digest: t("sample.digest"),
    alert: t("sample.alert"),
    // Lot 55 (MSG-03, POR-06).
    topic: t("sample.topic"),
  };
}

// missingTokens : les variables sans valeur, telles qu'elles s'écrivent dans le modèle ; replyTo :
// l'adresse où arriveront les réponses (null : aucune).
export type EmailPreview = { layout: MailLayout; hasLogo: boolean; missing: EmailVariable[]; missingTokens: string[]; replyTo: string | null };

// D7 — l'aperçu dans l'écran du modèle : le même rendu que l'e-mail, avec les données fictives ;
// le logo s'affiche par l'adresse de l'app (pas de pièce jointe dans une page).
export async function previewEmailTemplate(input: { organizationId: string; kind: EmailTemplateKind; locale: EmailLocale; template?: EmailTemplateText }): Promise<EmailPreview> {
  const [identity, template] = await Promise.all([organizationIdentity(input.organizationId), input.template ?? getEmailTemplate(input.organizationId, input.kind, input.locale)]);
  const { layout, missing } = layoutOf({ kind: input.kind, locale: input.locale, identity, template, values: sampleValues(input.locale), banner: null });
  return { layout, hasLogo: identity.logo !== null, missing, missingTokens: missing.map((key) => variableToken(key, input.locale)), replyTo: identity.replyTo };
}

// D7 — l'essai part à la personne connectée seulement, marqué « Essai », compté dans le plafond.
export async function sendTestEmail(input: { organizationId: string; userId: string; kind: EmailTemplateKind; locale: EmailLocale; template?: EmailTemplateText }): Promise<{ to: string }> {
  const contact = await findUserContact(appDatabase(), input.organizationId, input.userId);
  if (!contact) throw new Error("compte introuvable dans l'organisation");
  const t = translator(input.locale);
  const mail = await composeOrganizationEmail({ ...input, values: sampleValues(input.locale), banner: t("testBanner") });
  await reserveOrganizationMail(input.organizationId);
  await queueAndSendEmail(input.organizationId, {
    to: contact.email,
    subject: t("testSubject", { subject: mail.subject }),
    text: mail.text,
    html: mail.html,
    fromName: mail.fromName,
    ...(mail.fromAddress ? { fromAddress: mail.fromAddress } : {}),
    ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    attachments: mail.attachments,
  });
  return { to: contact.email };
}

// Les e-mails de Symbola (code d'un lien, équipe, compte) : texte fixe des fichiers de traduction,
// mis en page à l'image de Symbola. Un paragraphe égal à l'adresse du bouton devient le bouton.
// Lot 40b (ARC-10, ADR 0076) : avec son organisation, l'e-mail passe par la file des tâches (repris
// si le serveur d'envoi ne répond pas) ; sans organisation (lien de connexion, comptes créés par
// l'Exploitation), il part en direct : un lien de connexion en retard ne sert plus, on le redemande.
export async function sendSymbolaEmail(input: {
  to: string;
  locale: EmailLocale;
  subject: string;
  body: string;
  button?: { label: string; url: string };
  attachments?: Attachment[];
  organizationId?: string;
  idempotencyKey?: string;
}): Promise<void> {
  const t = translator(input.locale);
  const blocks: MailBlock[] = input.body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph): MailBlock => (input.button && paragraph === input.button.url ? { kind: "button", url: input.button.url, label: input.button.label } : { kind: "paragraph", text: paragraph }));
  const layout: MailLayout = {
    lang: input.locale,
    subject: input.subject,
    senderName: "Symbola",
    logoCid: null,
    accent: DOCUMENT_INK,
    textOnAccent: "#ffffff",
    blocks,
    footerLines: [],
    footerNote: t("symbolaFooter"),
  };
  const message = { to: input.to, subject: input.subject, text: renderMailText(layout), html: renderMailHtml(layout), ...(input.attachments ? { attachments: input.attachments } : {}) };
  if (input.organizationId) {
    if (input.idempotencyKey && (await jobKeyExists(input.organizationId, input.idempotencyKey))) return;
    await queueAndSendEmail(input.organizationId, message, input.idempotencyKey);
    return;
  }
  await sendMail(message);
}
