// Lot 44 (CRM-01 ; D1 à D5 ; ADR 0084) — règles pures du formulaire de contact, sans base : adresse
// publique, origines des sites autorisés, adresse de la politique, mention d'information, budget
// (montant ou tranche), liens d'un message (D4) et validation d'un envoi (champs obligatoires et
// masqués). Testées par contact-form-rules.test.ts (seuil de couverture, NFR-21).
import { z } from "zod";
import { starterContactFormNotice } from "@symbola/starter-templates";
import type { ContactFormField, ContactSubmission, PublicContactForm } from "@symbola/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Champ d'un envoi refusé : la personne corrige (pas un robot, un oubli).
export class ContactSubmissionInvalidError extends Error {
  constructor(readonly field: "name" | "contact" | "email" | "phone" | "date" | "guests" | "budget" | "message" | "period" | "place") {
    super(`envoi du formulaire de contact invalide : ${field}`);
    this.name = "ContactSubmissionInvalidError";
  }
}

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
