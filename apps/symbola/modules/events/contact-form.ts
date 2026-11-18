// Lot 44 (CRM-01 ; D1 à D7 ; ADR 0084) — le formulaire de contact public d'une organisation. Un envoi
// crée un prospect : le contact est retrouvé dans le hub par son e-mail exact, sinon créé, et jamais
// modifié (D5) ; l'évènement naît au statut Option, à la première étape du pipeline, avec la source
// choisie (ou « Formulaire de contact ») ; le message, la période et la tranche de budget vont dans
// une demande rattachée, gardée telle quelle. Un message à liens est mis de côté (« à vérifier »,
// D4) : rien n'est créé avant que la planner l'accepte ; non traité, il est effacé à 30 jours.
// Les journaux ne portent que des identifiants (SEC-20).
import { appDatabase } from "@symbola/db/client";
import { recordAudit } from "@symbola/db/audit";
import { SYSTEM_ACTOR } from "@symbola/db/actor";
import { parseEnv } from "@symbola/env";
import { listTeam, openField, sealField, type FieldPlace } from "@symbola/auth";
import { starterContactForm, starterProspectSourceLabels } from "@symbola/starter-templates";
import {
  CONTACT_FORM_FIELDS,
  type ContactFormField,
  type ContactFormSettings,
  type ContactSubmission,
  type ContactSubmissionOutcome,
  type EventProspectRequest,
  type ProspectRequestToReview,
  type PublicContactForm,
} from "@symbola/contracts";
import { getOrganizationContact, getPrivacySettings, getSellerDetails, isModuleEnabled, sendOrganizationEmail } from "@/modules/hub/service";
import { applyTaskTemplateRows, findDefaultTaskTemplateId, findProspectSources, insertProspect, insertProspectSource } from "./repository";
import { listEventTypes } from "./event-types";
import { resolveClientContacts } from "./clients";
import {
  attachReviewedRequest,
  deleteRequestToReview,
  deleteStaleRequestsToReview,
  findContactForm,
  findContactFormBySlug,
  findEventRequest,
  findRequestToReview,
  findRequestsToReview,
  insertReceivedRequest,
  insertRequestToReview,
  upsertContactForm,
  type ContactFormRow,
} from "./prospects-repository";
import { firstPipelineStageId } from "./pipeline";
import {
  contactFormNotice,
  contactSlugify,
  countLinks,
  isValidContactSlug,
  normalizeOrigin,
  normalizePrivacyUrl,
  parseContactSubmission,
  type RawContactSubmission,
} from "./contact-form-rules";

export { contactFormNotice, contactSlugify, countLinks, ContactSubmissionInvalidError, isValidContactSlug, normalizeOrigin, normalizePrivacyUrl, parseBudget, parseContactSubmission, type RawContactSubmission } from "./contact-form-rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ORIGINS = 5;

export class ContactFormInvalidError extends Error {
  constructor(readonly field: "slug" | "privacyPolicyUrl" | "allowedOrigins" | "hiddenFields") {
    super(`réglage du formulaire de contact invalide : ${field}`);
    this.name = "ContactFormInvalidError";
  }
}

export class ContactFormSlugTakenError extends Error {
  constructor() {
    super("adresse du formulaire déjà prise");
    this.name = "ContactFormSlugTakenError";
  }
}

export class ProspectRequestNotFoundError extends Error {
  constructor() {
    super("demande introuvable");
    this.name = "ProspectRequestNotFoundError";
  }
}

// —— Adresse publique (D2, même règle que la page de réservation du lot 46) ————————————————

export async function suggestContactFormSlug(organizationName: string): Promise<string> {
  const base = contactSlugify(organizationName).slice(0, 50).replace(/-+$/g, "") || "contact";
  const padded = base.length >= 3 ? base : `${base}-contact`;
  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? padded : `${padded}-${index + 1}`;
    if (!(await findContactFormBySlug(candidate))) return candidate;
  }
  return `${padded}-${Date.now().toString(36)}`;
}

// —— Réglages (CRM-01 ; D1, D3, D7) ————————————————————————————————————————————————————————

function toSettings(row: ContactFormRow): ContactFormSettings {
  return {
    active: row.active,
    slug: row.slug,
    hiddenFields: row.hiddenFields.filter((field): field is ContactFormField => (CONTACT_FORM_FIELDS as readonly string[]).includes(field)),
    privacyPolicyUrl: row.privacyPolicyUrl,
    allowedOrigins: row.allowedOrigins,
    notifyOwner: row.notifyOwner,
    locale: row.locale === "en" ? "en" : "fr",
  };
}

export async function getContactFormSettings(organizationId: string): Promise<ContactFormSettings | null> {
  const row = await findContactForm(organizationId);
  return row ? toSettings(row) : null;
}

// Le formulaire ne s'ouvre pas tant que l'adresse de la politique de confidentialité manque (RGP-03).
export async function saveContactFormSettings(
  organizationId: string,
  input: { active: boolean; slug: string; hiddenFields: string[]; privacyPolicyUrl: string | null; allowedOrigins: string[]; notifyOwner: boolean; locale: "fr" | "en" },
): Promise<ContactFormSettings> {
  const slug = contactSlugify(input.slug);
  if (!isValidContactSlug(slug)) throw new ContactFormInvalidError("slug");
  if (input.hiddenFields.some((field) => !(CONTACT_FORM_FIELDS as readonly string[]).includes(field))) throw new ContactFormInvalidError("hiddenFields");
  const privacyPolicyUrl = input.privacyPolicyUrl?.trim() ? normalizePrivacyUrl(input.privacyPolicyUrl) : null;
  if (input.privacyPolicyUrl?.trim() && !privacyPolicyUrl) throw new ContactFormInvalidError("privacyPolicyUrl");
  if (input.active && !privacyPolicyUrl) throw new ContactFormInvalidError("privacyPolicyUrl");
  const origins: string[] = [];
  for (const value of input.allowedOrigins) {
    if (!value.trim()) continue;
    const origin = normalizeOrigin(value);
    if (!origin) throw new ContactFormInvalidError("allowedOrigins");
    if (!origins.includes(origin)) origins.push(origin);
  }
  if (origins.length > MAX_ORIGINS) throw new ContactFormInvalidError("allowedOrigins");
  const taken = await findContactFormBySlug(slug);
  if (taken && taken.organizationId !== organizationId) throw new ContactFormSlugTakenError();
  try {
    const row = await upsertContactForm(organizationId, {
      active: input.active,
      slug,
      hiddenFields: [...new Set(input.hiddenFields)] as ContactFormField[],
      privacyPolicyUrl,
      allowedOrigins: origins,
      notifyOwner: input.notifyOwner,
      locale: input.locale,
    });
    return toSettings(row);
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    if (String((error as { code?: string }).code ?? cause?.code) === "23505") throw new ContactFormSlugTakenError();
    throw error;
  }
}

// —— La page publique ————————————————————————————————————————————————————————————————————————

export type PublicContactFormView = PublicContactForm & { notice: string; formId: string };

// Adresse inconnue, ancienne, formulaire fermé, sans politique, ou module Évènements fermé : null, et la
// même page « introuvable » (rien ne dit qu'une adresse a existé).
export async function resolvePublicContactForm(slug: string, locale: "fr" | "en"): Promise<PublicContactFormView | null> {
  if (!isValidContactSlug(slug)) return null;
  const form = await findContactFormBySlug(slug);
  if (!form || !form.active || !form.privacyPolicyUrl) return null;
  const db = appDatabase();
  if (!(await isModuleEnabled(db, form.organizationId, "events"))) return null;
  const [contact, seller, privacy, types, sources] = await Promise.all([
    getOrganizationContact(db, form.organizationId),
    getSellerDetails(db, form.organizationId),
    getPrivacySettings(db, form.organizationId),
    listEventTypes(form.organizationId),
    findProspectSources(form.organizationId),
  ]);
  // L'adresse du profil est sa ligne ; code postal et ville s'y ajoutent s'ils n'y sont pas déjà.
  const locality = [seller.postalCode, seller.city].filter(Boolean).join(" ");
  const address = [seller.address, locality && !(seller.address ?? "").includes(seller.postalCode ?? locality) ? locality : ""].filter(Boolean).join(", ") || null;
  const settings = toSettings(form);
  return {
    organizationId: form.organizationId,
    formId: form.id,
    slug: form.slug,
    organizationName: contact.name,
    hiddenFields: settings.hiddenFields,
    privacyPolicyUrl: form.privacyPolicyUrl,
    allowedOrigins: form.allowedOrigins,
    eventTypes: types.map((type) => ({ id: type.id, label: type.label })),
    sources: sources.map((source) => ({ id: source.id, label: source.label })),
    notice: contactFormNotice({ locale, organizationName: contact.name, address, months: privacy.prospectRetentionMonths, contact: contact.email ?? contact.name, policyUrl: form.privacyPolicyUrl }),
  };
}

// —— Délai minimal de remplissage (D4) ——————————————————————————————————————————————————————
// L'heure d'ouverture du formulaire, scellée (AES-256-GCM, DATA_ENCRYPTION_KEY, field-box du socle
// ADR 0079) et rattachée au formulaire : un robot ne la falsifie pas et ne la recopie pas ailleurs.

function timingPlace(form: { organizationId: string; formId: string }): FieldPlace {
  return { organizationId: form.organizationId, table: "events.contact_forms", column: "opened_at", rowId: form.formId };
}

export function sealFormOpening(form: { organizationId: string; formId: string }, now: Date = new Date()): string {
  return sealField(now.toISOString(), timingPlace(form));
}

// Vrai si le formulaire a été ouvert il y a au moins le délai minimal (et moins d'un jour).
export function isFormTimingValid(form: { organizationId: string; formId: string }, sealed: string, now: Date = new Date()): boolean {
  let opened: Date;
  try {
    opened = new Date(openField(sealed, timingPlace(form)));
  } catch {
    return false;
  }
  const elapsed = now.getTime() - opened.getTime();
  return Number.isFinite(elapsed) && elapsed >= starterContactForm().minimumFillSeconds * 1000 && elapsed <= 24 * 60 * 60 * 1000;
}

// —— Envoi (CRM-01 ; D3, D4, D5) ————————————————————————————————————————————————————————————

// La source « Formulaire de contact » de l'organisation, quelle que soit sa langue ; ajoutée à sa
// liste si elle n'y est pas encore (données de départ, HUB-20).
async function contactFormSourceId(organizationId: string, locale: "fr" | "en"): Promise<string> {
  const labels = starterProspectSourceLabels(starterContactForm().defaultSourceKey);
  if (!labels) throw new Error("source de départ « Formulaire de contact » absente");
  const sources = await findProspectSources(organizationId);
  const known = sources.find((source) => source.label === labels.fr || source.label === labels.en);
  if (known) return known.id;
  return (await insertProspectSource(organizationId, labels[locale])).id;
}

// Crée le prospect : contact (retrouvé, jamais modifié), évènement Option à la première étape, demande
// rattachée, événement interne ; puis le rétroplanning du type s'il y a une date (EVT-01, D8).
async function createFormProspect(organizationId: string, submission: ContactSubmission, form: { locale: "fr" | "en" }, now: Date, attach?: { requestId: string }): Promise<string> {
  const [contactId] = await resolveClientContacts(organizationId, [
    { firstName: submission.firstName, lastName: submission.lastName, email: submission.email, phone: submission.phone },
  ]);
  const sourceId = submission.sourceId ?? (await contactFormSourceId(organizationId, form.locale));
  const stageId = await firstPipelineStageId(organizationId, form.locale);
  const event = await insertProspect({
    organizationId,
    createdByUserId: null,
    clientContactIds: [contactId!],
    prospectSourceId: sourceId,
    eventTypeId: submission.eventTypeId,
    eventDate: submission.eventDate,
    venueName: null,
    venueCity: submission.place,
    guestsEstimated: submission.guests,
    wantedBudgetCents: submission.budgetCents,
    pipelineStageId: stageId,
    afterInsert: async (tx, created) => {
      if (attach) {
        if (!(await attachReviewedRequest(tx, organizationId, attach.requestId, created.id))) throw new ProspectRequestNotFoundError();
        return;
      }
      await insertReceivedRequest(tx, { organizationId, eventId: created.id, message: submission.message, period: submission.period, budgetRange: submission.budgetRange, receivedAt: now });
    },
  });
  if (event.eventDate) {
    const templateId = await findDefaultTaskTemplateId(organizationId, event.eventTypeId);
    if (templateId) await applyTaskTemplateRows(organizationId, event.id, templateId);
  }
  return event.id;
}

function pendingOf(submission: ContactSubmission): Record<string, string> {
  const entries: [string, string | null][] = [
    ["firstName", submission.firstName],
    ["lastName", submission.lastName],
    ["email", submission.email],
    ["phone", submission.phone],
    ["eventDate", submission.eventDate],
    ["place", submission.place],
    ["budgetCents", submission.budgetCents === null ? null : String(submission.budgetCents)],
    ["guests", submission.guests === null ? null : String(submission.guests)],
    ["eventTypeId", submission.eventTypeId],
    ["sourceId", submission.sourceId],
  ];
  return Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null));
}

function submissionOf(pending: Record<string, string>, request: { message: string | null; period: string | null; budgetRange: string | null }): ContactSubmission {
  return {
    firstName: pending.firstName ?? "",
    lastName: pending.lastName ?? null,
    email: pending.email ?? null,
    phone: pending.phone ?? null,
    eventDate: pending.eventDate ?? null,
    period: request.period,
    place: pending.place ?? null,
    budgetCents: pending.budgetCents ? Number(pending.budgetCents) : null,
    budgetRange: request.budgetRange,
    guests: pending.guests ? Number(pending.guests) : null,
    eventTypeId: pending.eventTypeId ?? null,
    sourceId: pending.sourceId ?? null,
    message: request.message,
  };
}

export type SubmitOptions = { now?: Date; notify?: (input: { organizationId: string; eventId: string; locale: "fr" | "en" }) => Promise<void> };

// Un envoi validé, pour l'organisation de l'adresse. La garde (piège, délai, débit) est faite avant,
// par l'appelant ; ici, le message à liens est mis de côté.
export async function submitContactForm(form: PublicContactFormView, raw: RawContactSubmission, options: SubmitOptions = {}): Promise<ContactSubmissionOutcome> {
  const now = options.now ?? new Date();
  const submission = parseContactSubmission(raw, form);
  const settings = await findContactForm(form.organizationId);
  if (!settings || !settings.active) return { kind: "ignored" };
  const locale = settings.locale === "en" ? "en" : "fr";
  const links = countLinks([submission.message, submission.period, submission.place, submission.budgetRange, submission.firstName, submission.lastName].filter(Boolean).join(" "));
  if (links > starterContactForm().maxLinksBeforeReview) {
    const request = await insertRequestToReview({ organizationId: form.organizationId, message: submission.message, period: submission.period, budgetRange: submission.budgetRange, pending: pendingOf(submission), receivedAt: now });
    await recordAudit(appDatabase(), { organizationId: form.organizationId, action: "events.prospect_request.to_review", objectId: request.id, details: {}, actor: SYSTEM_ACTOR });
    return { kind: "to_review", requestId: request.id };
  }
  const eventId = await createFormProspect(form.organizationId, submission, { locale }, now);
  await recordAudit(appDatabase(), { organizationId: form.organizationId, action: "events.prospect_request.received", objectId: eventId, details: {}, actor: SYSTEM_ACTOR });
  if (settings.notifyOwner) {
    const notify = options.notify ?? notifyOwnerOfRequest;
    // L'e-mail ne doit jamais faire échouer la demande, déjà enregistrée.
    await notify({ organizationId: form.organizationId, eventId, locale }).catch((error: unknown) => {
      console.error("e-mail de nouvelle demande non parti", form.organizationId, eventId, error instanceof Error ? error.name : "inconnue");
    });
  }
  return { kind: "created", eventId };
}

// « Nouvelle demande de contact » à la titulaire (D7) : ni le message ni les coordonnées du prospect,
// un lien vers la fiche seulement (SEC-20). Une seule fois par demande.
export async function notifyOwnerOfRequest(input: { organizationId: string; eventId: string; locale: "fr" | "en" }): Promise<void> {
  const team = await listTeam(appDatabase(), input.organizationId);
  const owner = team.find((member) => member.role === "owner" && !member.disabledAt);
  if (!owner) return;
  await sendOrganizationEmail({
    organizationId: input.organizationId,
    to: owner.email,
    kind: "prospect_form_received",
    locale: input.locale,
    values: { link: `${parseEnv(process.env).APP_PUBLIC_URL}/events/${input.eventId}` },
    reserve: false,
    idempotencyKey: `prospect-request:${input.eventId}`,
  });
}

// —— Demandes « à vérifier » (D4) ——————————————————————————————————————————————————————————————

export async function listProspectRequestsToReview(organizationId: string): Promise<ProspectRequestToReview[]> {
  return (await findRequestsToReview(organizationId)).map((row) => {
    const pending = row.pending ?? {};
    return {
      id: row.id,
      receivedAt: row.receivedAt.toISOString(),
      name: [pending.firstName, pending.lastName].filter(Boolean).join(" "),
      email: pending.email ?? null,
      phone: pending.phone ?? null,
      eventDate: pending.eventDate ?? null,
      period: row.period,
      message: row.message,
    };
  });
}

// Accepter : le prospect est créé comme pour un envoi ordinaire (sans e-mail : la planner l'a sous les yeux).
export async function acceptProspectRequest(organizationId: string, requestId: string): Promise<string> {
  if (!UUID.test(requestId)) throw new ProspectRequestNotFoundError();
  const request = await findRequestToReview(organizationId, requestId);
  if (!request || !request.pending) throw new ProspectRequestNotFoundError();
  const settings = await findContactForm(organizationId);
  const submission = submissionOf(request.pending, request);
  // Une valeur de liste supprimée entre-temps est ignorée.
  const [types, sources] = await Promise.all([listEventTypes(organizationId), findProspectSources(organizationId)]);
  if (submission.eventTypeId && !types.some((type) => type.id === submission.eventTypeId)) submission.eventTypeId = null;
  if (submission.sourceId && !sources.some((source) => source.id === submission.sourceId)) submission.sourceId = null;
  return createFormProspect(organizationId, submission, { locale: settings?.locale === "en" ? "en" : "fr" }, request.receivedAt, { requestId });
}

export async function discardProspectRequest(organizationId: string, requestId: string): Promise<void> {
  if (!UUID.test(requestId) || !(await deleteRequestToReview(organizationId, requestId))) throw new ProspectRequestNotFoundError();
}

// Purge des demandes « à vérifier » jamais traitées (contact-form.json : 30 jours).
export async function purgeStaleProspectRequests(organizationId: string, now: Date = new Date()): Promise<number> {
  const days = starterContactForm().toReviewRetentionDays;
  return deleteStaleRequestsToReview(organizationId, new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
}

export async function getEventProspectRequest(organizationId: string, eventId: string): Promise<EventProspectRequest | null> {
  if (!UUID.test(eventId)) return null;
  const row = await findEventRequest(organizationId, eventId);
  return row ? { id: row.id, receivedAt: row.receivedAt.toISOString(), message: row.message, period: row.period, budgetRange: row.budgetRange } : null;
}
