// Lot 44 (CRM-01 ; D1 à D7 ; ADR 0084) — le formulaire de contact public d'une organisation. Un envoi
// crée un prospect : le contact est retrouvé dans le hub par son e-mail exact, sinon créé, et jamais
// modifié (D5) ; l'évènement naît au statut Option, à la première étape du pipeline, avec la source
// choisie (ou « Formulaire de contact ») ; le message, la période et la tranche de budget vont dans
// une demande rattachée, gardée telle quelle. Un message à liens est mis de côté (« à vérifier »,
// D4) : rien n'est créé avant que la planner l'accepte ; non traité, il est effacé à 30 jours.
// Les journaux ne portent que des identifiants (SEC-20).
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { recordAudit } from "@symbola/db/audit";
import { SYSTEM_ACTOR } from "@symbola/db/actor";
import { parseEnv } from "@symbola/env";
import { listTeam, openField, sealField, type FieldPlace } from "@symbola/auth";
import { starterContactForm, starterContactFormNotice, starterProspectSourceLabels } from "@symbola/starter-templates";
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

// Champ d'un envoi refusé : la personne corrige (pas un robot, un oubli).
export class ContactSubmissionInvalidError extends Error {
  constructor(readonly field: "name" | "contact" | "email" | "phone" | "date" | "guests" | "budget" | "message" | "period" | "place") {
    super(`envoi du formulaire de contact invalide : ${field}`);
    this.name = "ContactSubmissionInvalidError";
  }
}

export class ProspectRequestNotFoundError extends Error {
  constructor() {
    super("demande introuvable");
    this.name = "ProspectRequestNotFoundError";
  }
}

// —— Adresse publique (D2, même règle que la page de réservation du lot 46) ————————————————

export function contactSlugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function isValidContactSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 60;
}

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

// Origine d'un site autorisé à encadrer le formulaire : https, sans chemin (D1).
export function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".") || /[*\s]/.test(url.host)) return null;
  return url.origin;
}

export function normalizePrivacyUrl(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && trimmed.length <= 500 ? url.toString() : null;
  } catch {
    return null;
  }
}

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

// Mention d'information (RGP-03) : responsable (nom, adresse), finalité, durée des prospects, droits,
// contact, politique de la planner. Texte de départ dans contact-form.json (AV-4, AV-5).
export function contactFormNotice(input: { locale: "fr" | "en"; organizationName: string; address: string | null; months: number; contact: string; policyUrl: string }): string {
  return starterContactFormNotice(input.locale)
    .replaceAll("{organization}", input.organizationName)
    .replaceAll("{address}", input.address ? ` (${input.address})` : "")
    .replaceAll("{months}", String(input.months))
    .replaceAll("{contact}", input.contact)
    .replaceAll("{policy}", input.policyUrl);
}

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

const rawSchema = z.object({
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  email: z.string().trim().max(254),
  phone: z.string().trim().max(40),
  eventDate: z.string().trim().max(10),
  period: z.string().trim().max(200),
  place: z.string().trim().max(400),
  budget: z.string().trim().max(200),
  guests: z.string().trim().max(10),
  eventTypeId: z.string().trim().max(36),
  sourceId: z.string().trim().max(36),
  message: z.string().max(10000),
});

export type RawContactSubmission = Partial<Record<keyof z.infer<typeof rawSchema>, string>>;

// Budget : un montant (« 25 000 € », « 25k ») en centimes ; sinon une tranche gardée en texte.
export function parseBudget(value: string): { cents: number | null; range: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { cents: null, range: null };
  const match = /^(\d{1,3}(?:[\s  .]?\d{3})*|\d+)(?:[.,](\d{1,2}))?\s*(k)?\s*(?:€|eur|euros?)?$/i.exec(trimmed);
  if (match) {
    const units = Number(match[1]!.replace(/[\s  .]/g, ""));
    const cents = match[3] ? units * 100_000 : units * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
    if (Number.isSafeInteger(cents) && cents > 0 && cents <= 2_000_000_000) return { cents, range: null };
  }
  return { cents: null, range: trimmed.slice(0, 100) };
}

// Liens d'un texte (adresses web) : au-delà du seuil, l'envoi est mis de côté (D4).
export function countLinks(value: string): number {
  return (value.match(/\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|ru|xyz|top|info|biz|io|co)\b/gi) ?? []).length;
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Valide un envoi : un champ masqué est ignoré, même si la requête l'envoie (D3) ; le nom, et l'e-mail
// ou le téléphone, sont obligatoires.
export function parseContactSubmission(raw: RawContactSubmission, form: Pick<PublicContactForm, "hiddenFields" | "eventTypes" | "sources">): ContactSubmission {
  const parsed = rawSchema.safeParse({
    firstName: raw.firstName ?? "",
    lastName: raw.lastName ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? "",
    eventDate: raw.eventDate ?? "",
    period: raw.period ?? "",
    place: raw.place ?? "",
    budget: raw.budget ?? "",
    guests: raw.guests ?? "",
    eventTypeId: raw.eventTypeId ?? "",
    sourceId: raw.sourceId ?? "",
    message: raw.message ?? "",
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    if (field === "firstName" || field === "lastName") throw new ContactSubmissionInvalidError("name");
    if (field === "email" || field === "phone" || field === "message" || field === "period" || field === "place" || field === "budget" || field === "guests") throw new ContactSubmissionInvalidError(field);
    if (field === "eventDate") throw new ContactSubmissionInvalidError("date");
    throw new ContactSubmissionInvalidError("message");
  }
  const hidden = new Set(form.hiddenFields);
  const shown = (field: ContactFormField, value: string): string => (hidden.has(field) ? "" : value);
  const data = parsed.data;
  if (!data.firstName || !data.lastName) throw new ContactSubmissionInvalidError("name");
  const email = data.email.toLowerCase();
  if (email && !z.email().safeParse(email).success) throw new ContactSubmissionInvalidError("email");
  const phone = shown("phone", data.phone);
  if (phone && !/^[+()\d][\d\s().+-]{5,39}$/.test(phone)) throw new ContactSubmissionInvalidError("phone");
  if (!email && !phone) throw new ContactSubmissionInvalidError("contact");
  const eventDate = shown("date", data.eventDate);
  if (eventDate && !isRealDate(eventDate)) throw new ContactSubmissionInvalidError("date");
  const guestsText = shown("guests", data.guests);
  const guests = guestsText ? Number(guestsText) : null;
  if (guests !== null && (!Number.isInteger(guests) || guests < 0 || guests > 100000)) throw new ContactSubmissionInvalidError("guests");
  const budget = parseBudget(shown("budget", data.budget));
  const message = shown("message", data.message).replace(/\r\n/g, "\n").trim();
  if (message.length > 5000) throw new ContactSubmissionInvalidError("message");
  const period = shown("date", data.period);
  if (period.length > 100) throw new ContactSubmissionInvalidError("period");
  const place = shown("place", data.place);
  if (place.length > 200) throw new ContactSubmissionInvalidError("place");
  const eventTypeId = shown("eventType", data.eventTypeId);
  const sourceId = shown("source", data.sourceId);
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: email || null,
    phone: phone || null,
    eventDate: eventDate || null,
    period: period || null,
    place: place || null,
    budgetCents: budget.cents,
    budgetRange: budget.range,
    guests,
    // Une valeur hors des listes de l'organisation est ignorée (jamais celle d'une autre).
    eventTypeId: UUID.test(eventTypeId) && form.eventTypes.some((type) => type.id === eventTypeId) ? eventTypeId : null,
    sourceId: UUID.test(sourceId) && form.sources.some((source) => source.id === sourceId) ? sourceId : null,
    message: message || null,
  };
}

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
