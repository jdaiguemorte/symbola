// Porte d'entrée publique du module appointments (lot 46 : RDV-01 à RDV-04, EVT-10 ; D1 à D11 ;
// ADR 0082) — seul fichier que les autres modules et les écrans peuvent importer (ADR 0011). Pensé
// comme le futur contrat HTTP /v1/appointments si le module devient une app autonome.
import { randomUUID } from "node:crypto";
import { formatLinkToken, hashLinkSecret, newLinkSecret, openField, parseLinkToken, sealField } from "@symbola/auth";
import {
  APPOINTMENT_CANCEL_REASONS,
  APPOINTMENT_LOCATION_KINDS,
  APPOINTMENT_QUESTIONS_MAX,
  APPOINTMENT_REMINDER_PLANS,
  APPOINTMENTS_APPOINTMENT_BOOKED,
  APPOINTMENTS_APPOINTMENT_BOOKED_VERSION,
  type Appointment,
  type AppointmentBookedPayload,
  type AppointmentCancelReason,
  type AppointmentQuestion,
  type AppointmentReport,
  type AppointmentType,
  type AppointmentTypeInput,
  type AvailabilityClosure,
  type AvailabilityRule,
  type BookingPage,
  type CalendarSourceErrorKind,
  type CalendarSourceView,
  type TodayAppointment,
} from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import { starterAppointmentDefaults, starterAppointmentTypes, starterAvailability, starterBookingPrivacyNotice } from "@symbola/starter-templates";
import { addEventTask, createProspect, getEvent, listBusyRanges } from "@/modules/events/service";
import { getOrganizationContact, isModuleEnabled, isOrganizationClosed, resolveContact, splitPersonName } from "@/modules/hub/service";
import { CalendarReadError, fetchCalendarText, normalizeCalendarUrl, parseBusyRanges, urlHint, type Transport } from "./ics-reader";
import { notifyHost, sendPersonEmail } from "./notifications";
import {
  countUpcomingByEmail,
  deleteCalendarSource,
  deleteClosure,
  deleteReportAction,
  emitInTransaction,
  findAppointment,
  findAppointmentByTokenHash,
  findAppointments,
  findAppointmentsChangedSince,
  findAppointmentType,
  findAppointmentTypes,
  findAvailability,
  findBookingPage,
  findBookingPageBySlug,
  findCalendarSource,
  findCalendarSources,
  findReminderCandidates,
  findReportAction,
  findReports,
  inOrganization,
  insertAppointmentRow,
  insertAppointmentType,
  insertCalendarSource,
  insertClosure,
  insertReportAction,
  lockHost,
  readHostBusy,
  recordCalendarFailure,
  replaceAvailabilityRules,
  restoreAppointmentRow,
  restoreAppointmentTypeRow,
  setReportActionTask,
  storeCalendarRead,
  trashAppointmentRow,
  trashAppointmentTypeRow,
  updateAppointmentRow,
  updateAppointmentTypeRow,
  upsertBookingPage,
  upsertReport,
  type AppointmentRow,
  type AppointmentTypeRow,
  type CalendarSourceRow,
  type Tx,
} from "./repository";
import { addDays, computeSlots, nearestSlots, zonedDate, type Range } from "./slots";

export { appointmentsPrivacy, listAppointmentRetention } from "./privacy";
export { APPOINTMENTS_EXPORT_EXCLUSIONS, describeAppointmentsExport, exportAppointmentsData, eraseAppointmentsData, importAppointmentsData, registerAppointmentsImportIds } from "./export";
export { CalendarUrlInvalidError, CalendarReadError } from "./ics-reader";
export { computeSlots, nearestSlots } from "./slots";
export { manageUrl } from "./notifications";
export type { Appointment, AppointmentReport, AppointmentType, BookingPage, CalendarSourceView, TodayAppointment } from "@symbola/contracts";

// Fuseau des disponibilités (ARC-17 : Paris, en attendant le fuseau de chaque personne, RDV-05).
export const APPOINTMENTS_TIME_ZONE = "Europe/Paris";
// D5 : au plus trois rendez-vous à venir par adresse e-mail et par organisation.
export const UPCOMING_PER_EMAIL = 3;
// D2 : un agenda extérieur est relu toutes les quinze minutes ; trois échecs de suite, « en erreur ».
export const SOURCE_REFRESH_MINUTES = 15;
export const SOURCE_ERROR_AFTER = 3;
export const SOURCES_PER_PERSON = 5;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// —— Erreurs ——————————————————————————————————————————————————————————————————————

export class AppointmentNotFoundError extends Error {
  constructor() {
    super("rendez-vous introuvable");
    this.name = "AppointmentNotFoundError";
  }
}
export class AppointmentTypeNotFoundError extends Error {
  constructor() {
    super("type de rendez-vous introuvable");
    this.name = "AppointmentTypeNotFoundError";
  }
}
export class AppointmentInvalidError extends Error {
  constructor(readonly field: string) {
    super(`champ invalide : ${field}`);
    this.name = "AppointmentInvalidError";
  }
}
export class BookingSlugTakenError extends Error {
  constructor() {
    super("adresse de page déjà prise");
    this.name = "BookingSlugTakenError";
  }
}
export class CalendarSourceNotFoundError extends Error {
  constructor() {
    super("agenda extérieur introuvable");
    this.name = "CalendarSourceNotFoundError";
  }
}
// EVT-10 (D9) : une action ne devient une tâche que d'un rendez-vous rattaché à un évènement.
export class AppointmentNotLinkedError extends Error {
  constructor() {
    super("rendez-vous sans évènement");
    this.name = "AppointmentNotLinkedError";
  }
}

// —— Conversions ———————————————————————————————————————————————————————————————————

function toType(row: AppointmentTypeRow): AppointmentType {
  return {
    id: row.id,
    name: row.name,
    durationMinutes: row.durationMinutes,
    locationKind: row.locationKind,
    location: row.location,
    bufferBeforeMinutes: row.bufferBeforeMinutes,
    bufferAfterMinutes: row.bufferAfterMinutes,
    minNoticeMinutes: row.minNoticeMinutes,
    horizonDays: row.horizonDays,
    reminders: row.reminders,
    questions: row.questions,
    hostUserId: row.hostUserId,
    allowEventDays: row.allowEventDays,
    active: row.active,
    position: row.position,
  };
}

function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    typeId: row.typeId,
    typeName: row.typeName,
    hostUserId: row.hostUserId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    locationKind: row.locationKind,
    location: row.location,
    status: row.status,
    origin: row.origin,
    personName: row.personName,
    personEmail: row.personEmail,
    personPhone: row.personPhone,
    locale: row.locale,
    answers: row.answers,
    contactId: row.contactId,
    eventId: row.eventId,
    createdAt: row.createdAt.toISOString(),
    rescheduledAt: row.rescheduledAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledBy: row.cancelledBy,
    cancelReason: (row.cancelReason as AppointmentCancelReason | null) ?? null,
    isDemo: row.isDemo,
  };
}

function toSourceView(row: CalendarSourceRow): CalendarSourceView {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    urlHint: row.urlHint,
    state: row.state,
    failures: row.failures,
    lastErrorKind: (row.lastErrorKind as CalendarSourceErrorKind | null) ?? null,
    lastReadAt: row.lastReadAt?.toISOString() ?? null,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
  };
}

// —— Page de réservation (D11) ————————————————————————————————————————————————————

// « Atelier Camille » → « atelier-camille » ; 3 à 60 caractères, lettres, chiffres et tirets.
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 60;
}

export async function getBookingPage(organizationId: string): Promise<BookingPage | null> {
  const row = await findBookingPage(organizationId);
  return row ? { slug: row.slug, active: row.active, privacyNotice: row.privacyNotice } : null;
}

export async function suggestBookingSlug(organizationName: string): Promise<string> {
  const base = slugify(organizationName) || "rendez-vous";
  const padded = base.length < 3 ? `${base}-rdv` : base;
  for (let index = 0; index < 20; index++) {
    const candidate = index === 0 ? padded : `${padded.slice(0, 56)}-${index + 1}`;
    if (!(await findBookingPageBySlug(candidate))) return candidate;
  }
  return `${padded.slice(0, 50)}-${randomUUID().slice(0, 6)}`;
}

// D11 : l'adresse est choisie, unique ; la changer fait cesser l'ancienne.
export async function saveBookingPage(organizationId: string, input: { slug: string; active: boolean; privacyNotice: string | null }): Promise<BookingPage> {
  const slug = slugify(input.slug);
  if (!isValidSlug(slug)) throw new AppointmentInvalidError("slug");
  const notice = input.privacyNotice?.trim() || null;
  if (notice && notice.length > 3000) throw new AppointmentInvalidError("privacyNotice");
  const taken = await findBookingPageBySlug(slug);
  if (taken && taken.organizationId !== organizationId) throw new BookingSlugTakenError();
  try {
    const row = await upsertBookingPage(organizationId, { slug, active: input.active, privacyNotice: notice });
    return { slug: row.slug, active: row.active, privacyNotice: row.privacyNotice };
  } catch (error) {
    if (String((error as { code?: string }).code) === "23505") throw new BookingSlugTakenError();
    throw error;
  }
}

// RGP-03 : la mention d'information de la page, au nom de la planner (texte de départ sinon).
export async function bookingPrivacyNotice(organizationId: string, locale: "fr" | "en", custom: string | null): Promise<string> {
  const contact = await getOrganizationContact(appDatabase(), organizationId);
  const template = custom ?? starterBookingPrivacyNotice(locale);
  return template.replaceAll("{organization}", contact.name).replaceAll("{contact}", contact.email ?? contact.name);
}

export type PublicBookingPage = { organizationId: string; slug: string; privacyNotice: string; types: AppointmentType[] };

// La page publique d'une adresse : seulement si la page est active et le module ouvert pour son
// organisation ; sinon null, comme une adresse inconnue.
export async function resolvePublicBookingPage(slug: string, locale: "fr" | "en"): Promise<PublicBookingPage | null> {
  if (!isValidSlug(slug)) return null;
  const page = await findBookingPageBySlug(slug);
  if (!page || !page.active) return null;
  if (!(await isModuleEnabled(appDatabase(), page.organizationId, "appointments")) || (await isOrganizationClosed(appDatabase(), page.organizationId))) return null;
  const types = (await findAppointmentTypes(page.organizationId)).filter((type) => type.active).map(toType);
  return { organizationId: page.organizationId, slug: page.slug, privacyNotice: await bookingPrivacyNotice(page.organizationId, locale, page.privacyNotice), types };
}

// —— Types (RDV-01) ———————————————————————————————————————————————————————————————

function cleanQuestions(questions: AppointmentQuestion[] | undefined): AppointmentQuestion[] {
  const list = (questions ?? []).map((question) => ({
    id: question.id && /^[a-z0-9_-]{1,40}$/i.test(question.id) ? question.id : randomUUID().slice(0, 8),
    label: question.label.trim(),
    kind: question.kind === "choice" ? ("choice" as const) : ("text" as const),
    choices: question.kind === "choice" ? question.choices.map((choice) => choice.trim()).filter(Boolean).slice(0, 12) : [],
  }));
  if (list.length > APPOINTMENT_QUESTIONS_MAX) throw new AppointmentInvalidError("questions");
  for (const question of list) {
    if (question.label.length === 0 || question.label.length > 200) throw new AppointmentInvalidError("questions");
    if (question.kind === "choice" && question.choices.length < 2) throw new AppointmentInvalidError("questions");
  }
  return list;
}

function integerIn(value: number | undefined, fallback: number, min: number, max: number, field: string): number {
  const number = value ?? fallback;
  if (!Number.isInteger(number) || number < min || number > max) throw new AppointmentInvalidError(field);
  return number;
}

function typeValues(input: AppointmentTypeInput, base: Omit<AppointmentType, "id" | "position">) {
  const name = (input.name ?? base.name).trim();
  if (name.length === 0 || name.length > 120) throw new AppointmentInvalidError("name");
  const locationKind = input.locationKind ?? base.locationKind;
  if (!APPOINTMENT_LOCATION_KINDS.includes(locationKind)) throw new AppointmentInvalidError("locationKind");
  const location = input.location === undefined ? base.location : input.location?.trim() || null;
  if (location && location.length > 500) throw new AppointmentInvalidError("location");
  if (locationKind === "video" && location && !/^https:\/\/\S+$/.test(location)) throw new AppointmentInvalidError("location");
  const reminders = input.reminders ?? base.reminders;
  if (!APPOINTMENT_REMINDER_PLANS.includes(reminders)) throw new AppointmentInvalidError("reminders");
  return {
    name,
    durationMinutes: integerIn(input.durationMinutes, base.durationMinutes, 15, 480, "durationMinutes"),
    locationKind,
    location,
    bufferBeforeMinutes: integerIn(input.bufferBeforeMinutes, base.bufferBeforeMinutes, 0, 240, "bufferBeforeMinutes"),
    bufferAfterMinutes: integerIn(input.bufferAfterMinutes, base.bufferAfterMinutes, 0, 240, "bufferAfterMinutes"),
    minNoticeMinutes: integerIn(input.minNoticeMinutes, base.minNoticeMinutes, 0, 43_200, "minNoticeMinutes"),
    horizonDays: integerIn(input.horizonDays, base.horizonDays, 1, 365, "horizonDays"),
    reminders,
    questions: input.questions === undefined ? base.questions : cleanQuestions(input.questions),
    hostUserId: input.hostUserId ?? base.hostUserId,
    allowEventDays: input.allowEventDays ?? base.allowEventDays,
    active: input.active ?? base.active,
  };
}

export async function listAppointmentTypes(organizationId: string): Promise<AppointmentType[]> {
  return (await findAppointmentTypes(organizationId)).map(toType);
}

export async function getAppointmentType(organizationId: string, id: string): Promise<AppointmentType | null> {
  if (!UUID.test(id)) return null;
  const row = await findAppointmentType(organizationId, id);
  return row ? toType(row) : null;
}

// RDV-01 : nom et durée suffisent ; le reste vient des réglages par défaut (données de départ), la
// personne qui reçoit est celle qui crée le type.
export async function createAppointmentType(organizationId: string, input: AppointmentTypeInput, createdByUserId: string): Promise<AppointmentType> {
  const defaults = starterAppointmentDefaults();
  const values = typeValues(input, { ...defaults, name: input.name, durationMinutes: input.durationMinutes, location: null, questions: [], hostUserId: createdByUserId, active: true });
  return toType(await insertAppointmentType(organizationId, values));
}

export async function updateAppointmentType(organizationId: string, id: string, input: Partial<AppointmentTypeInput>): Promise<AppointmentType> {
  const current = await getAppointmentType(organizationId, id);
  if (!current) throw new AppointmentTypeNotFoundError();
  const row = await updateAppointmentTypeRow(organizationId, id, typeValues({ ...current, ...input } as AppointmentTypeInput, current));
  if (!row) throw new AppointmentTypeNotFoundError();
  return toType(row);
}

export async function trashAppointmentType(organizationId: string, id: string): Promise<void> {
  if (!UUID.test(id) || !(await trashAppointmentTypeRow(organizationId, id))) throw new AppointmentTypeNotFoundError();
}

export async function restoreAppointmentType(organizationId: string, id: string): Promise<boolean> {
  return UUID.test(id) && restoreAppointmentTypeRow(organizationId, id);
}

// Les trois types de départ (HUB-20), ajoutés à la demande de la planner, une seule fois chacun.
export async function addStarterAppointmentTypes(organizationId: string, hostUserId: string, locale: "fr" | "en"): Promise<number> {
  const existing = new Set((await findAppointmentTypes(organizationId)).map((type) => type.name));
  const defaults = starterAppointmentDefaults();
  let added = 0;
  for (const starter of starterAppointmentTypes(locale)) {
    if (existing.has(starter.name)) continue;
    await insertAppointmentType(organizationId, {
      ...defaults,
      name: starter.name,
      durationMinutes: starter.durationMinutes,
      locationKind: starter.locationKind,
      bufferBeforeMinutes: starter.bufferBeforeMinutes,
      bufferAfterMinutes: starter.bufferAfterMinutes,
      questions: starter.questions,
      hostUserId,
    });
    added += 1;
  }
  return added;
}

// —— Disponibilités ———————————————————————————————————————————————————————————————

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Sans plage enregistrée, la personne a les plages de départ (lundi au vendredi, 9 h - 18 h).
export async function getAvailability(organizationId: string, userId: string): Promise<{ rules: AvailabilityRule[]; closures: AvailabilityClosure[]; isDefault: boolean }> {
  const { rules, closures } = await findAvailability(organizationId, userId);
  return {
    rules: rules.length > 0 ? rules.map((rule) => ({ weekday: rule.weekday, startTime: rule.startTime.slice(0, 5), endTime: rule.endTime.slice(0, 5) })) : starterAvailability(),
    closures: closures.map((closure) => ({ id: closure.id, startsOn: closure.startsOn, endsOn: closure.endsOn, reason: closure.reason })),
    isDefault: rules.length === 0,
  };
}

export async function saveAvailabilityRules(organizationId: string, userId: string, rules: AvailabilityRule[]): Promise<void> {
  if (rules.length > 28) throw new AppointmentInvalidError("rules");
  for (const rule of rules) {
    if (!Number.isInteger(rule.weekday) || rule.weekday < 1 || rule.weekday > 7 || !TIME.test(rule.startTime) || !TIME.test(rule.endTime) || rule.endTime <= rule.startTime) {
      throw new AppointmentInvalidError("rules");
    }
  }
  await replaceAvailabilityRules(organizationId, userId, rules);
}

export async function addAvailabilityClosure(organizationId: string, userId: string, input: { startsOn: string; endsOn: string; reason: string | null }): Promise<AvailabilityClosure> {
  const date = /^\d{4}-\d{2}-\d{2}$/;
  if (!date.test(input.startsOn) || !date.test(input.endsOn) || input.endsOn < input.startsOn) throw new AppointmentInvalidError("closure");
  const reason = input.reason?.trim() || null;
  if (reason && reason.length > 80) throw new AppointmentInvalidError("reason");
  const row = await insertClosure(organizationId, userId, { startsOn: input.startsOn, endsOn: input.endsOn, reason });
  return { id: row.id, startsOn: row.startsOn, endsOn: row.endsOn, reason: row.reason };
}

export async function removeAvailabilityClosure(organizationId: string, userId: string, id: string): Promise<void> {
  if (!UUID.test(id) || !(await deleteClosure(organizationId, userId, id))) throw new AppointmentNotFoundError();
}

// —— Agendas extérieurs (D2, D4) ——————————————————————————————————————————————————

const sealPlace = (organizationId: string, rowId: string) => ({ organizationId, table: "appointments.calendar_sources", column: "url_sealed", rowId });

// Chaque personne de l'équipe ne voit que ses propres agendas (et jamais leur adresse en entier).
export async function listMyCalendarSources(organizationId: string, userId: string): Promise<CalendarSourceView[]> {
  return (await findCalendarSources(organizationId, { userId })).map(toSourceView);
}

// D4 : de la veille à l'horizon le plus lointain des types (et au moins 60 jours).
async function readWindow(organizationId: string, now: Date): Promise<{ from: Date; to: Date }> {
  const horizon = Math.max(60, ...(await findAppointmentTypes(organizationId)).map((type) => type.horizonDays));
  return { from: new Date(now.getTime() - DAY), to: new Date(now.getTime() + (horizon + 2) * DAY) };
}

// Relit une source : en cas d'échec, seul son genre est noté (jamais l'adresse).
export async function refreshCalendarSource(organizationId: string, sourceId: string, options: { now?: Date; transport?: Transport } = {}): Promise<CalendarSourceView> {
  const now = options.now ?? new Date();
  const source = await findCalendarSource(organizationId, sourceId);
  if (!source) throw new CalendarSourceNotFoundError();
  try {
    const url = normalizeCalendarUrl(openField(source.urlSealed, sealPlace(organizationId, source.id)));
    const text = await fetchCalendarText(url, options.transport ? { transport: options.transport } : {});
    const window = await readWindow(organizationId, now);
    const ranges = parseBusyRanges(text, { ...window, fallbackZone: APPOINTMENTS_TIME_ZONE });
    await storeCalendarRead(organizationId, source.id, ranges, now);
  } catch (error) {
    const kind: CalendarSourceErrorKind = error instanceof CalendarReadError ? error.kind : "blocked";
    const row = await recordCalendarFailure(organizationId, source.id, kind, now, SOURCE_ERROR_AFTER);
    console.error("agenda extérieur : lecture échouée", { organizationId, sourceId: source.id, kind, failures: row?.failures ?? null });
  }
  const updated = await findCalendarSource(organizationId, sourceId);
  if (!updated) throw new CalendarSourceNotFoundError();
  return toSourceView(updated);
}

// L'adresse est chiffrée avant tout enregistrement (DAT-08, ADR 0079), puis lue aussitôt.
export async function addCalendarSource(organizationId: string, userId: string, input: { label: string; url: string }, options: { now?: Date; transport?: Transport } = {}): Promise<CalendarSourceView> {
  const label = input.label.trim();
  if (label.length === 0 || label.length > 80) throw new AppointmentInvalidError("label");
  const url = normalizeCalendarUrl(input.url);
  if ((await findCalendarSources(organizationId, { userId })).length >= SOURCES_PER_PERSON) throw new AppointmentInvalidError("sources");
  const id = randomUUID();
  await insertCalendarSource(organizationId, { id, userId, label, urlSealed: sealField(url.href, sealPlace(organizationId, id)), urlHint: urlHint(url) });
  return refreshCalendarSource(organizationId, id, options);
}

export async function removeCalendarSource(organizationId: string, userId: string, id: string): Promise<void> {
  if (!UUID.test(id) || !(await deleteCalendarSource(organizationId, userId, id))) throw new CalendarSourceNotFoundError();
}

// Seulement une source de la personne : celle d'une autre n'est pas trouvée.
export async function refreshMyCalendarSource(organizationId: string, userId: string, id: string): Promise<CalendarSourceView> {
  const source = UUID.test(id) ? await findCalendarSource(organizationId, id) : null;
  if (!source || source.userId !== userId) throw new CalendarSourceNotFoundError();
  return refreshCalendarSource(organizationId, id);
}

const isStale = (source: CalendarSourceRow, now: Date) => !source.lastReadAt || now.getTime() - source.lastReadAt.getTime() >= SOURCE_REFRESH_MINUTES * MINUTE;

// Tâche périodique : relit les sources dont la dernière lecture a quinze minutes ou plus.
export async function refreshDueCalendarSources(organizationId: string, now: Date = new Date()): Promise<number> {
  let read = 0;
  for (const source of await findCalendarSources(organizationId)) {
    if (!isStale(source, new Date(now.getTime() + MINUTE))) continue;
    await refreshCalendarSource(organizationId, source.id, { now });
    read += 1;
  }
  return read;
}

// HUB-08 : les agendas en erreur, pour prévenir la planner.
export async function listCalendarSourcesInError(organizationId: string): Promise<CalendarSourceView[]> {
  return (await findCalendarSources(organizationId)).filter((source) => source.state === "error").map(toSourceView);
}

// —— Créneaux (RDV-02) ————————————————————————————————————————————————————————————

// D6, revu au lot 64 (RDV-02 ; D2, D3 ; ADR 0108) : les plages occupées des évènements qui bloquent
// (heures réglées par type ou par évènement, la veille et le lendemain compris), pour la personne qui
// reçoit : ceux de son équipe, ou sans équipe (si le module Évènements est ouvert).
async function eventBusy(organizationId: string, hostUserId: string, now: Date, horizonDays: number): Promise<Range[]> {
  if (!(await isModuleEnabled(appDatabase(), organizationId, "events"))) return [];
  const window = { from: new Date(now.getTime() - DAY), to: new Date(now.getTime() + (horizonDays + 2) * DAY) };
  const ranges = await listBusyRanges(organizationId, window, { userId: hostUserId });
  return ranges.filter((range) => range.blocking).map((range) => ({ start: range.start, end: range.end }));
}

// Sans lecture réussie, ou en erreur : aucun créneau (mieux vaut ne rien proposer qu'une plage
// occupée).
function sourcesBlock(sources: CalendarSourceRow[]): boolean {
  return sources.some((source) => source.state === "error" || source.lastSuccessAt === null);
}

async function slotsInTransaction(tx: Tx, type: AppointmentTypeRow, now: Date, eventRanges: Range[], excludeAppointmentId: string | null): Promise<Date[]> {
  const window: Range = { start: now, end: new Date(now.getTime() + (type.horizonDays + 2) * DAY) };
  const { busy, sources, rules, closures } = await readHostBusy(tx, type.hostUserId, window, excludeAppointmentId);
  if (sourcesBlock(sources)) return [];
  return computeSlots({
    now,
    timeZone: APPOINTMENTS_TIME_ZONE,
    rules: rules.length > 0 ? rules : starterAvailability(),
    closures,
    blockedDays: [],
    busy: [...busy, ...eventRanges],
    durationMinutes: type.durationMinutes,
    bufferBeforeMinutes: type.bufferBeforeMinutes,
    bufferAfterMinutes: type.bufferAfterMinutes,
    minNoticeMinutes: type.minNoticeMinutes,
    horizonDays: type.horizonDays,
  });
}

// À l'ouverture de la page : les agendas de la personne qui reçoit dont la lecture a plus de quinze
// minutes sont relus d'abord (dix secondes au plus chacun).
async function refreshHostSources(organizationId: string, hostUserId: string, now: Date, transport?: Transport): Promise<void> {
  for (const source of await findCalendarSources(organizationId, { userId: hostUserId })) {
    if (isStale(source, now)) await refreshCalendarSource(organizationId, source.id, { now, ...(transport ? { transport } : {}) });
  }
}

export async function availableSlots(organizationId: string, typeId: string, options: { now?: Date; excludeAppointmentId?: string | null; transport?: Transport } = {}): Promise<Date[]> {
  const now = options.now ?? new Date();
  const type = UUID.test(typeId) ? await findAppointmentType(organizationId, typeId) : null;
  if (!type || !type.active) return [];
  await refreshHostSources(organizationId, type.hostUserId, now, options.transport);
  const blocked = type.allowEventDays ? [] : await eventBusy(organizationId, type.hostUserId, now, type.horizonDays);
  return inOrganization(organizationId, (tx) => slotsInTransaction(tx, type, now, blocked, options.excludeAppointmentId ?? null));
}

// —— Réservation (RDV-02, RDV-03 ; D5) —————————————————————————————————————————————

export type BookingInput = {
  organizationId: string;
  typeId: string;
  startsAt: Date;
  name: string;
  email: string;
  phone: string | null;
  answers: Record<string, string>;
  locale: "fr" | "en";
  now?: Date;
};

export type BookingResult =
  | { outcome: "booked"; appointment: Appointment; manageToken: string }
  | { outcome: "taken"; alternatives: Date[] }
  | { outcome: "limit" }
  | { outcome: "unavailable" };

function cleanPerson(input: { name: string; email: string | null; phone: string | null }) {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (name.length === 0 || name.length > 200) throw new AppointmentInvalidError("name");
  const email = input.email?.trim().toLowerCase() || null;
  if (email && (email.length > 254 || !EMAIL.test(email))) throw new AppointmentInvalidError("email");
  const phone = input.phone?.replace(/\s+/g, " ").trim() || null;
  if (phone && (phone.length > 40 || !/^[+0-9 ().-]+$/.test(phone))) throw new AppointmentInvalidError("phone");
  return { name, email, phone };
}

function cleanAnswers(type: AppointmentTypeRow, answers: Record<string, string>) {
  return type.questions.flatMap((question) => {
    const answer = (answers[question.id] ?? "").trim();
    if (answer === "") return [];
    if (answer.length > 500) throw new AppointmentInvalidError(`answer:${question.id}`);
    if (question.kind === "choice" && !question.choices.includes(answer)) throw new AppointmentInvalidError(`answer:${question.id}`);
    return [{ questionId: question.id, label: question.label, answer }];
  });
}

// SEC-14 : 256 bits aléatoires ; l'empreinte sert à retrouver le rendez-vous, le jeton chiffré
// (DAT-08) à redonner le même lien dans les rappels.
const tokenPlace = (organizationId: string, rowId: string) => ({ organizationId, table: "appointments.appointments", column: "manage_token_sealed", rowId });

function newManageToken(organizationId: string, appointmentId: string): { token: string; manageTokenHash: string; manageTokenSealed: string } {
  const secret = newLinkSecret();
  const token = formatLinkToken(organizationId, secret);
  return { token, manageTokenHash: hashLinkSecret(secret), manageTokenSealed: sealField(token, tokenPlace(organizationId, appointmentId)) };
}

function manageTokenOf(row: AppointmentRow): string | null {
  if (!row.manageTokenSealed) return null;
  try {
    return openField(row.manageTokenSealed, tokenPlace(row.organizationId, row.id));
  } catch {
    return null;
  }
}

// Le contact du hub : créé, ou rattaché à celui de même adresse e-mail (DAT-12) ; puis l'évènement
// interne (D7), une fois.
async function attachContactAndPublish(row: AppointmentRow): Promise<AppointmentRow> {
  let contactId = row.contactId;
  if (!contactId && row.personEmail) {
    try {
      const { firstName, lastName } = splitPersonName(row.personName, "firstLast");
      contactId = (await resolveContact(row.organizationId, { kind: "person", firstName: firstName ?? row.personName, lastName, email: row.personEmail, phone: row.personPhone }, { isDemo: row.isDemo })).id;
    } catch (error) {
      console.error("rendez-vous : contact non rattaché", { appointmentId: row.id, error: error instanceof Error ? error.name : "inconnue" });
    }
  }
  return inOrganization(row.organizationId, async (tx) => {
    const updated = (await updateAppointmentRow(row.organizationId, row.id, { contactId }, tx)) ?? row;
    const payload: AppointmentBookedPayload = {
      appointmentId: row.id,
      typeId: row.typeId,
      contactId,
      eventId: row.eventId,
      hostUserId: row.hostUserId,
      startsAt: row.startsAt.toISOString(),
      origin: row.origin,
    };
    await emitInTransaction(tx, { organizationId: row.organizationId, name: APPOINTMENTS_APPOINTMENT_BOOKED, version: APPOINTMENTS_APPOINTMENT_BOOKED_VERSION, payload });
    return updated;
  });
}

// Confirmation immédiate (D5) : le créneau est recalculé sous un verrou par personne qui reçoit ;
// s'il n'est plus libre, les créneaux voisins sont proposés. Au plus trois rendez-vous à venir par
// adresse e-mail et par organisation.
export async function bookAppointment(input: BookingInput, options: { transport?: Transport } = {}): Promise<BookingResult> {
  const now = input.now ?? new Date();
  const type = UUID.test(input.typeId) ? await findAppointmentType(input.organizationId, input.typeId) : null;
  if (!type || !type.active) return { outcome: "unavailable" };
  const person = cleanPerson({ name: input.name, email: input.email, phone: input.phone });
  if (!person.email) throw new AppointmentInvalidError("email");
  const answers = cleanAnswers(type, input.answers);
  await refreshHostSources(input.organizationId, type.hostUserId, now, options.transport);
  const blocked = type.allowEventDays ? [] : await eventBusy(input.organizationId, type.hostUserId, now, type.horizonDays);
  const appointmentId = randomUUID();
  const manage = newManageToken(input.organizationId, appointmentId);
  const result = await inOrganization(input.organizationId, async (tx): Promise<{ row: AppointmentRow } | { taken: Date[] } | { limit: true }> => {
    await lockHost(tx, input.organizationId, type.hostUserId);
    const slots = await slotsInTransaction(tx, type, now, blocked, null);
    if (!slots.some((slot) => slot.getTime() === input.startsAt.getTime())) return { taken: nearestSlots(slots, input.startsAt) };
    if ((await countUpcomingByEmail(tx, person.email!, now)) >= UPCOMING_PER_EMAIL) return { limit: true };
    const row = await insertAppointmentRow(tx, input.organizationId, {
      id: appointmentId,
      typeId: type.id,
      typeName: type.name,
      hostUserId: type.hostUserId,
      startsAt: input.startsAt,
      endsAt: new Date(input.startsAt.getTime() + type.durationMinutes * MINUTE),
      bufferBeforeMinutes: type.bufferBeforeMinutes,
      bufferAfterMinutes: type.bufferAfterMinutes,
      locationKind: type.locationKind,
      location: type.location,
      reminders: type.reminders,
      origin: "public",
      personName: person.name,
      personEmail: person.email,
      personPhone: person.phone,
      locale: input.locale,
      answers,
      manageTokenHash: manage.manageTokenHash,
      manageTokenSealed: manage.manageTokenSealed,
    });
    return { row };
  });
  if ("taken" in result) return { outcome: "taken", alternatives: result.taken };
  if ("limit" in result) return { outcome: "limit" };
  const row = await attachContactAndPublish(result.row);
  await afterChange(row, "appointment_confirmed", "booked", manage.token, now);
  return { outcome: "booked", appointment: toAppointment(row), manageToken: manage.token };
}

// Les e-mails ne retiennent jamais le rendez-vous : un envoi en échec reste dans la file.
async function afterChange(row: AppointmentRow, personKind: "appointment_confirmed" | "appointment_rescheduled" | "appointment_cancelled" | null, hostNotice: "booked" | "rescheduled" | "cancelled" | null, token: string | null, now: Date): Promise<void> {
  try {
    if (personKind) await sendPersonEmail(row, personKind, { manageToken: token, now });
  } catch (error) {
    console.error("rendez-vous : e-mail à la personne non parti", { appointmentId: row.id, error: error instanceof Error ? error.name : "inconnue" });
  }
  try {
    if (hostNotice) await notifyHost(row, hostNotice);
  } catch (error) {
    console.error("rendez-vous : e-mail à la planner non parti", { appointmentId: row.id, error: error instanceof Error ? error.name : "inconnue" });
  }
}

// —— Lien de gestion (RDV-03 ; D10) ——————————————————————————————————————————————

export type ManagedAppointment = {
  organizationId: string;
  appointment: Appointment;
  organizationName: string;
  // Report possible : le type existe encore et est actif.
  canReschedule: boolean;
};

// Le rendez-vous d'un jeton, valable jusqu'à la fin du rendez-vous. Inconnu, d'une autre
// organisation, expiré ou retiré : la même réponse (null).
async function appointmentOfToken(token: string, now: Date): Promise<AppointmentRow | null> {
  const parsed = parseLinkToken(token);
  // Lot 35c (RGP-11) : un espace fermé ferme ses liens et sa page de réservation.
  if (!parsed || (await isOrganizationClosed(appDatabase(), parsed.organizationId))) return null;
  const row = await findAppointmentByTokenHash(parsed.organizationId, hashLinkSecret(parsed.secret));
  if (!row || row.organizationId !== parsed.organizationId || row.isDemo) return null;
  if (row.endsAt.getTime() <= now.getTime()) return null;
  if (!(await isModuleEnabled(appDatabase(), row.organizationId, "appointments"))) return null;
  return row;
}

export async function describeManagedAppointment(token: string, now: Date = new Date()): Promise<ManagedAppointment | null> {
  const row = await appointmentOfToken(token, now);
  if (!row) return null;
  const type = row.typeId ? await findAppointmentType(row.organizationId, row.typeId) : null;
  const contact = await getOrganizationContact(appDatabase(), row.organizationId);
  return { organizationId: row.organizationId, appointment: toAppointment(row), organizationName: contact.name, canReschedule: row.status === "booked" && Boolean(type?.active) };
}

export async function slotsForManagedAppointment(token: string, now: Date = new Date()): Promise<Date[] | null> {
  const row = await appointmentOfToken(token, now);
  if (!row || row.status !== "booked" || !row.typeId) return null;
  return availableSlots(row.organizationId, row.typeId, { now, excludeAppointmentId: row.id });
}

export type RescheduleResult = { outcome: "rescheduled"; appointment: Appointment } | { outcome: "taken"; alternatives: Date[] } | { outcome: "invalid" };

async function moveInLock(row: AppointmentRow, type: AppointmentTypeRow, startsAt: Date, now: Date, checkSlots: boolean): Promise<{ row: AppointmentRow } | { taken: Date[] }> {
  const blocked = checkSlots && !type.allowEventDays ? await eventBusy(row.organizationId, type.hostUserId, now, type.horizonDays) : [];
  return inOrganization(row.organizationId, async (tx) => {
    await lockHost(tx, row.organizationId, type.hostUserId);
    if (checkSlots) {
      const slots = await slotsInTransaction(tx, type, now, blocked, row.id);
      if (!slots.some((slot) => slot.getTime() === startsAt.getTime())) return { taken: nearestSlots(slots, startsAt) };
    }
    const updated = await updateAppointmentRow(row.organizationId, row.id, { startsAt, endsAt: new Date(startsAt.getTime() + (row.endsAt.getTime() - row.startsAt.getTime())), rescheduledAt: now }, tx);
    if (!updated) throw new AppointmentNotFoundError();
    return { row: updated };
  });
}

// Report par la personne, sans compte : un créneau libre du même type ; la planner est prévenue.
export async function rescheduleByToken(token: string, startsAt: Date, now: Date = new Date()): Promise<RescheduleResult> {
  const row = await appointmentOfToken(token, now);
  if (!row || row.status !== "booked" || !row.typeId) return { outcome: "invalid" };
  const type = await findAppointmentType(row.organizationId, row.typeId);
  if (!type || !type.active) return { outcome: "invalid" };
  await refreshHostSources(row.organizationId, type.hostUserId, now);
  const moved = await moveInLock(row, type, startsAt, now, true);
  if ("taken" in moved) return { outcome: "taken", alternatives: moved.taken };
  await afterChange(moved.row, "appointment_rescheduled", "rescheduled", token, now);
  return { outcome: "rescheduled", appointment: toAppointment(moved.row) };
}

export async function cancelByToken(token: string, reason: AppointmentCancelReason | null, now: Date = new Date()): Promise<boolean> {
  const row = await appointmentOfToken(token, now);
  if (!row || row.status !== "booked") return false;
  const updated = await updateAppointmentRow(row.organizationId, row.id, { status: "cancelled", cancelledAt: now, cancelledBy: "person", cancelReason: reason && APPOINTMENT_CANCEL_REASONS.includes(reason) ? reason : null });
  if (!updated) return false;
  await afterChange(updated, "appointment_cancelled", "cancelled", null, now);
  return true;
}

// —— Côté planner ———————————————————————————————————————————————————————————————————

export async function listAppointments(organizationId: string, filter: { from?: Date; to?: Date; order?: "asc" | "desc"; limit?: number } = {}): Promise<Appointment[]> {
  return (await findAppointments(organizationId, filter)).map(toAppointment);
}

export async function getAppointment(organizationId: string, id: string): Promise<Appointment | null> {
  if (!UUID.test(id)) return null;
  const row = await findAppointment(organizationId, id);
  return row ? toAppointment(row) : null;
}

async function requireRow(organizationId: string, id: string): Promise<AppointmentRow> {
  const row = UUID.test(id) ? await findAppointment(organizationId, id) : null;
  if (!row) throw new AppointmentNotFoundError();
  return row;
}

// Un rendez-vous saisi à la main (téléphone, salon) : sans page publique, à l'heure choisie par la
// planner ; la personne est prévenue si elle a une adresse e-mail et si la planner le veut.
export async function createManualAppointment(
  organizationId: string,
  input: { typeId: string; startsAt: Date; name: string; email: string | null; phone: string | null; eventId?: string | null; notify: boolean; locale: "fr" | "en"; isDemo?: boolean },
  now: Date = new Date(),
): Promise<{ appointment: Appointment; manageToken: string | null }> {
  const type = UUID.test(input.typeId) ? await findAppointmentType(organizationId, input.typeId) : null;
  if (!type) throw new AppointmentTypeNotFoundError();
  const person = cleanPerson(input);
  if (Number.isNaN(input.startsAt.getTime())) throw new AppointmentInvalidError("startsAt");
  if (input.eventId && !(await getEvent(organizationId, input.eventId))) throw new AppointmentInvalidError("eventId");
  const appointmentId = randomUUID();
  const manage = person.email ? newManageToken(organizationId, appointmentId) : null;
  const inserted = await inOrganization(organizationId, (tx) =>
    insertAppointmentRow(tx, organizationId, {
      id: appointmentId,
      typeId: type.id,
      typeName: type.name,
      hostUserId: type.hostUserId,
      startsAt: input.startsAt,
      endsAt: new Date(input.startsAt.getTime() + type.durationMinutes * MINUTE),
      bufferBeforeMinutes: type.bufferBeforeMinutes,
      bufferAfterMinutes: type.bufferAfterMinutes,
      locationKind: type.locationKind,
      location: type.location,
      reminders: type.reminders,
      origin: "manual",
      personName: person.name,
      personEmail: person.email,
      personPhone: person.phone,
      locale: input.locale,
      eventId: input.eventId ?? null,
      manageTokenHash: manage?.manageTokenHash ?? null,
      manageTokenSealed: manage?.manageTokenSealed ?? null,
      isDemo: input.isDemo ?? false,
    }),
  );
  const row = await attachContactAndPublish(inserted);
  if (input.notify) await afterChange(row, "appointment_confirmed", null, manage?.token ?? null, now);
  return { appointment: toAppointment(row), manageToken: manage?.token ?? null };
}

// Déplacer depuis l'app : l'heure choisie par la planner ; le même lien de gestion part avec l'e-mail.
export async function moveAppointment(organizationId: string, id: string, startsAt: Date, options: { notify: boolean; now?: Date }): Promise<Appointment> {
  const now = options.now ?? new Date();
  const row = await requireRow(organizationId, id);
  if (row.status !== "booked") throw new AppointmentInvalidError("status");
  if (Number.isNaN(startsAt.getTime())) throw new AppointmentInvalidError("startsAt");
  const updated = await updateAppointmentRow(organizationId, row.id, {
    startsAt,
    endsAt: new Date(startsAt.getTime() + (row.endsAt.getTime() - row.startsAt.getTime())),
    rescheduledAt: now,
  });
  if (!updated) throw new AppointmentNotFoundError();
  if (options.notify) await afterChange(updated, "appointment_rescheduled", null, manageTokenOf(updated), now);
  return toAppointment(updated);
}

export async function cancelAppointment(organizationId: string, id: string, options: { reason: AppointmentCancelReason | null; notify: boolean; now?: Date }): Promise<Appointment> {
  const now = options.now ?? new Date();
  const row = await requireRow(organizationId, id);
  if (row.status !== "booked") throw new AppointmentInvalidError("status");
  const updated = await updateAppointmentRow(organizationId, row.id, { status: "cancelled", cancelledAt: now, cancelledBy: "planner", cancelReason: options.reason });
  if (!updated) throw new AppointmentNotFoundError();
  if (options.notify) await afterChange(updated, "appointment_cancelled", null, null, now);
  return toAppointment(updated);
}

export async function trashAppointment(organizationId: string, id: string): Promise<void> {
  if (!UUID.test(id) || !(await trashAppointmentRow(organizationId, id))) throw new AppointmentNotFoundError();
}

export async function restoreAppointment(organizationId: string, id: string): Promise<boolean> {
  return UUID.test(id) && restoreAppointmentRow(organizationId, id);
}

// RDV-04 (D7) : rattacher le rendez-vous à un évènement existant (module Évènements ouvert).
export async function linkAppointmentToEvent(organizationId: string, id: string, eventId: string | null): Promise<Appointment> {
  const row = await requireRow(organizationId, id);
  if (eventId !== null && (!UUID.test(eventId) || !(await getEvent(organizationId, eventId)))) throw new AppointmentInvalidError("eventId");
  const updated = await updateAppointmentRow(organizationId, row.id, { eventId });
  if (!updated) throw new AppointmentNotFoundError();
  return toAppointment(updated);
}

// RDV-04 (D7) : créer une option depuis le rendez-vous, sans ressaisie (UX-02) : le contact est repris,
// la date souhaitée et la source viennent du formulaire ; le rendez-vous y est rattaché.
export async function createOptionFromAppointment(
  organizationId: string,
  id: string,
  input: { createdByUserId: string; prospectSourceId: string; eventDate: string | null; eventTypeId?: string | null },
): Promise<{ eventId: string }> {
  const row = await requireRow(organizationId, id);
  if (row.eventId) return { eventId: row.eventId };
  const { firstName, lastName } = splitPersonName(row.personName, "firstLast");
  const created = await createProspect({
    organizationId,
    createdByUserId: input.createdByUserId,
    clients: [{ contactId: row.contactId, firstName: firstName ?? row.personName, lastName, email: row.personEmail, phone: row.personPhone }],
    prospectSourceId: input.prospectSourceId,
    eventTypeId: input.eventTypeId ?? null,
    eventDate: input.eventDate,
  });
  await updateAppointmentRow(organizationId, row.id, { eventId: created.id });
  return { eventId: created.id };
}

// —— Comptes rendus (EVT-10 ; D8, D9) ———————————————————————————————————————————————

function toReport(entry: Awaited<ReturnType<typeof findReports>>[number]): AppointmentReport {
  return {
    id: entry.report.id,
    appointmentId: entry.report.appointmentId,
    notes: entry.report.notes,
    updatedAt: entry.report.updatedAt.toISOString(),
    actions: entry.actions.map((action) => ({ id: action.id, label: action.label, dueOn: action.dueOn, responsible: action.responsible, taskId: action.taskId, taskEventId: action.taskEventId })),
  };
}

export async function getAppointmentReport(organizationId: string, appointmentId: string): Promise<AppointmentReport | null> {
  if (!UUID.test(appointmentId)) return null;
  const [entry] = await findReports(organizationId, [appointmentId]);
  return entry ? toReport(entry) : null;
}

export async function saveAppointmentReport(organizationId: string, appointmentId: string, notes: string | null): Promise<AppointmentReport> {
  await requireRow(organizationId, appointmentId);
  const text = notes?.trim() || null;
  if (text && text.length > 10_000) throw new AppointmentInvalidError("notes");
  await upsertReport(organizationId, appointmentId, text);
  return (await getAppointmentReport(organizationId, appointmentId))!;
}

export async function addAppointmentReportAction(organizationId: string, appointmentId: string, input: { label: string; dueOn: string | null; responsible: "planner" | "clients" }): Promise<AppointmentReport> {
  await requireRow(organizationId, appointmentId);
  const label = input.label.replace(/\s+/g, " ").trim();
  if (label.length === 0 || label.length > 200) throw new AppointmentInvalidError("label");
  if (input.dueOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn)) throw new AppointmentInvalidError("dueOn");
  const report = (await getAppointmentReport(organizationId, appointmentId)) ?? (await saveAppointmentReport(organizationId, appointmentId, null));
  await insertReportAction(organizationId, report.id, { label, dueOn: input.dueOn, responsible: input.responsible === "clients" ? "clients" : "planner" });
  return (await getAppointmentReport(organizationId, appointmentId))!;
}

export async function removeAppointmentReportAction(organizationId: string, actionId: string): Promise<void> {
  if (!UUID.test(actionId) || !(await deleteReportAction(organizationId, actionId))) throw new AppointmentNotFoundError();
}

// EVT-10 : « En faire une tâche », en un geste : tâche de l'évènement lié, avec le titre, l'échéance
// (le jour même si l'action n'en a pas) et le responsable de l'action. Sans évènement : refusée
// (l'écran propose d'abord de rattacher le rendez-vous, D9).
export async function convertActionToTask(organizationId: string, actionId: string, now: Date = new Date()): Promise<{ taskId: string; eventId: string }> {
  const found = UUID.test(actionId) ? await findReportAction(organizationId, actionId) : null;
  if (!found) throw new AppointmentNotFoundError();
  if (found.action.taskId && found.action.taskEventId) return { taskId: found.action.taskId, eventId: found.action.taskEventId };
  const appointment = await requireRow(organizationId, found.appointmentId);
  if (!appointment.eventId) throw new AppointmentNotLinkedError();
  const task = await addEventTask(organizationId, appointment.eventId, { label: found.action.label, dueDate: found.action.dueOn ?? parisToday(now), responsible: found.action.responsible });
  await setReportActionTask(organizationId, actionId, { taskId: task.id, taskEventId: appointment.eventId });
  return { taskId: task.id, eventId: appointment.eventId };
}

// EVT-10 : les rendez-vous d'un évènement et leurs comptes rendus (fiche de l'évènement).
export async function listEventAppointments(organizationId: string, eventId: string): Promise<{ appointment: Appointment; report: AppointmentReport | null }[]> {
  if (!UUID.test(eventId)) return [];
  const rows = await findAppointments(organizationId, { eventId, order: "desc" });
  const reports = new Map((await findReports(organizationId, rows.map((row) => row.id))).map((entry) => [entry.report.appointmentId, toReport(entry)]));
  return rows.map((row) => ({ appointment: toAppointment(row), report: reports.get(row.id) ?? null }));
}

// CRM-03 : les rendez-vous d'un contact (historique de sa fiche).
export async function listContactAppointments(organizationId: string, contactId: string): Promise<Appointment[]> {
  if (!UUID.test(contactId)) return [];
  return (await findAppointments(organizationId, { contactId, order: "desc", limit: 50 })).map(toAppointment);
}

// —— Rappels (D10) ——————————————————————————————————————————————————————————————————

const REMINDER_HOURS: Record<"24h" | "24h_2h", number[]> = { "24h": [24], "24h_2h": [24, 2] };

// Un rappel part quand son heure est passée, si le rendez-vous a été pris (ou déplacé) avant cette
// heure, et avant le rappel suivant ; sa clé (rendez-vous, rappel, heure du rendez-vous) empêche un
// second envoi. Un rendez-vous annulé n'est plus candidat ; un rendez-vous reporté a une autre clé.
export function dueReminder(row: Pick<AppointmentRow, "reminders" | "startsAt" | "createdAt" | "rescheduledAt">, now: Date): number | null {
  if (row.reminders === "none") return null;
  const hours = REMINDER_HOURS[row.reminders];
  const bookedAt = (row.rescheduledAt ?? row.createdAt).getTime();
  for (let index = 0; index < hours.length; index++) {
    const due = row.startsAt.getTime() - hours[index]! * 3_600_000;
    const next = index + 1 < hours.length ? row.startsAt.getTime() - hours[index + 1]! * 3_600_000 : row.startsAt.getTime();
    if (now.getTime() >= due && now.getTime() < next && bookedAt < due) return hours[index]!;
  }
  return null;
}

export async function sendDueAppointmentReminders(organizationId: string, now: Date = new Date()): Promise<number> {
  let sent = 0;
  for (const row of await findReminderCandidates(organizationId, now, 25)) {
    const hours = dueReminder(row, now);
    if (hours === null || row.isDemo) continue;
    try {
      const token = manageTokenOf(row);
      if (!token) continue;
      if (await sendPersonEmail(row, "appointment_reminder", { manageToken: token, keySuffix: `_${hours}h`, now })) sent += 1;
    } catch (error) {
      console.error("rendez-vous : rappel non parti", { appointmentId: row.id, error: error instanceof Error ? error.name : "inconnue" });
    }
  }
  return sent;
}

// —— « Aujourd'hui » (HUB-08), portail (POR-02), flux d'agenda (HUB-29) ——————————————

// Les rendez-vous du jour, et les nouveaux, reportés ou annulés depuis la veille (jours de Paris).
export async function listTodayAppointments(organizationId: string, now: Date = new Date()): Promise<TodayAppointment[]> {
  const today = parisToday(now);
  const startOfYesterday = new Date(`${addDays(today, -1)}T00:00:00Z`);
  const since = new Date(startOfYesterday.getTime() - 2 * 3_600_000);
  const items = new Map<string, TodayAppointment>();
  const pick = (row: AppointmentRow, change: TodayAppointment["change"], changedAt: Date | null) => ({
    id: row.id,
    typeName: row.typeName,
    personName: row.personName,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    eventId: row.eventId,
    hostUserId: row.hostUserId,
    change,
    changedAt: changedAt?.toISOString() ?? null,
  });
  for (const row of await findAppointmentsChangedSince(organizationId, since)) {
    const day = (instant: Date | null) => (instant ? zonedDate(instant, APPOINTMENTS_TIME_ZONE) : null);
    const recent = (instant: Date | null) => {
      const date = day(instant);
      return date !== null && date >= addDays(today, -1);
    };
    if (row.status === "cancelled" && recent(row.cancelledAt)) items.set(row.id, pick(row, "cancelled", row.cancelledAt));
    else if (row.status === "booked" && recent(row.rescheduledAt)) items.set(row.id, pick(row, "rescheduled", row.rescheduledAt));
    else if (row.status === "booked" && recent(row.createdAt) && row.origin === "public") items.set(row.id, pick(row, "new", row.createdAt));
  }
  const tomorrow = new Date(`${addDays(today, 1)}T00:00:00Z`);
  for (const row of await findAppointments(organizationId, { from: new Date(now.getTime() - DAY), to: new Date(tomorrow.getTime() + DAY), status: "booked" })) {
    if (row.isDemo || zonedDate(row.startsAt, APPOINTMENTS_TIME_ZONE) !== today) continue;
    items.set(row.id, pick(row, "today", null));
  }
  return [...items.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// POR-02, POR-10 : au portail, les prochains rendez-vous de l'évènement auxquels la personne du
// lien participe (par son adresse e-mail), seulement les siens.
export async function listUpcomingAppointmentsForPerson(organizationId: string, eventId: string, email: string, now: Date = new Date()): Promise<Pick<Appointment, "id" | "typeName" | "startsAt" | "endsAt" | "locationKind" | "location">[]> {
  const address = email.trim().toLowerCase();
  if (!UUID.test(eventId) || address === "") return [];
  if (!(await isModuleEnabled(appDatabase(), organizationId, "appointments"))) return [];
  const rows = await findAppointments(organizationId, { eventId, email: address, status: "booked", from: now, limit: 20 });
  return rows.filter((row) => !row.isDemo && row.startsAt.getTime() > now.getTime()).map((row) => ({ id: row.id, typeName: row.typeName, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), locationKind: row.locationKind, location: row.location }));
}

// HUB-29 : les rendez-vous de la personne qui reçoit, pour son flux d'agenda (de la veille à six mois).
export async function listHostAppointmentsForFeed(organizationId: string, hostUserId: string, now: Date = new Date()): Promise<Appointment[]> {
  if (!(await isModuleEnabled(appDatabase(), organizationId, "appointments"))) return [];
  const rows = await findAppointments(organizationId, { hostUserId, status: "booked", from: new Date(now.getTime() - 30 * DAY), to: new Date(now.getTime() + 183 * DAY) });
  return rows.filter((row) => !row.isDemo).map(toAppointment);
}

// Résumé pour l'agenda de l'app : les rendez-vous pris d'un intervalle.
export async function listAgendaAppointments(organizationId: string, from: Date, to: Date): Promise<Appointment[]> {
  return (await findAppointments(organizationId, { from, to, status: "booked" })).filter((row) => !row.isDemo).map(toAppointment);
}

// RDV-04 : l'app s'utilise seule ; l'écran sait si le module Évènements est là (rattachement, option).
export async function isEventsModuleAvailable(organizationId: string): Promise<boolean> {
  return isModuleEnabled(appDatabase(), organizationId, "events");
}

export async function isAppointmentsModuleEnabled(organizationId: string): Promise<boolean> {
  return isModuleEnabled(appDatabase(), organizationId, "appointments");
}

// Lot 39a (ADR 0073) — corbeille du module.
export { isAppointmentsObjectTrashed, listTrashedAppointmentsRows, purgeTrashedAppointmentsObjects, type AppointmentsTrashKind } from "./trash";
export { deleteDemoAppointments } from "./repository";

// Lot 45 (CRM-07 ; ADR 0090) : rendez-vous d'un contact fusionné.
export { countContactAppointments, repointAppointmentsMergedContact } from "./contact-merge";

// Lot 45 (CRM-06, D3) : le dernier rendez-vous pris par le prospect (sur l'évènement ou par l'un de ses
// contacts), une action qui arrête ses relances.
export async function latestProspectAppointment(organizationId: string, eventId: string, contactIds: string[]): Promise<Date | null> {
  const found = [...(await listEventAppointments(organizationId, eventId)).map((entry) => entry.appointment)];
  for (const contactId of contactIds) found.push(...(await listContactAppointments(organizationId, contactId)));
  const dates = found.filter((appointment) => appointment.origin === "public" && appointment.status !== "cancelled").map((appointment) => new Date(appointment.createdAt).getTime());
  return dates.length > 0 ? new Date(Math.max(...dates)) : null;
}
