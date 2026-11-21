"use server";

// Lot 46 (RDV-01 à RDV-04, EVT-10 ; D1 à D11 ; ADR 0082) — actions de la planner sur le module
// Rendez-vous. Contrôles côté serveur à chaque appel : session, organisation et module ouvert
// (appointmentsPlanner), puis le service (RLS). Toute entrée est validée par Zod ; une erreur revient
// dans l'adresse sous une clé (jamais un message technique ni une donnée).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { APPOINTMENT_CANCEL_REASONS, APPOINTMENT_LOCATION_KINDS, APPOINTMENT_REMINDER_PLANS, type AppointmentCancelReason } from "@symbola/contracts";
import { wallTimeToInstant } from "@/lib/calendar/ics";
import {
  addAppointmentReportAction,
  addAvailabilityClosure,
  addCalendarSource,
  addStarterAppointmentTypes,
  AppointmentInvalidError,
  AppointmentNotFoundError,
  AppointmentNotLinkedError,
  AppointmentTypeNotFoundError,
  APPOINTMENTS_TIME_ZONE,
  BookingSlugTakenError,
  CalendarSourceNotFoundError,
  CalendarUrlInvalidError,
  cancelAppointment,
  convertActionToTask,
  createAppointmentType,
  createManualAppointment,
  createOptionFromAppointment,
  linkAppointmentToEvent,
  moveAppointment,
  refreshMyCalendarSource,
  removeAppointmentReportAction,
  removeAvailabilityClosure,
  removeCalendarSource,
  saveAppointmentReport,
  saveAvailabilityRules,
  saveBookingPage,
  trashAppointment,
  trashAppointmentType,
  updateAppointmentType,
} from "@/modules/appointments/service";
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { offerUndo } from "@/lib/undo";
import { unexpectedActionError } from "@/lib/action-errors";
import { appointmentsPlanner } from "./access";

const uuid = z.uuid();
const text = (max: number) => z.string().trim().max(max);
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

function value(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

// « 2027-03-02T10:00 » (champ date et heure) : l'heure de Paris.
function parisInstant(raw: string): Date | null {
  const match = LOCAL_DATE_TIME.exec(raw.trim());
  return match ? wallTimeToInstant(match[1]!, match[2]!, APPOINTMENTS_TIME_ZONE) : null;
}

function errorKey(error: unknown): string | null {
  if (error instanceof AppointmentInvalidError) return `invalid.${error.field.split(":")[0]}`;
  if (error instanceof BookingSlugTakenError) return "slugTaken";
  if (error instanceof CalendarUrlInvalidError) return "calendarUrl";
  if (error instanceof AppointmentNotLinkedError) return "notLinked";
  if (error instanceof AppointmentNotFoundError || error instanceof AppointmentTypeNotFoundError || error instanceof CalendarSourceNotFoundError) return "notFound";
  return null;
}

// Erreur attendue : sa clé dans l'adresse ; inattendue : la référence courte (journal sans donnée).
async function fail(path: string, error: unknown): Promise<never> {
  const key = errorKey(error);
  if (!key) await unexpectedActionError(error);
  redirect(`${path}${path.includes("?") ? "&" : "?"}erreur=${key ?? "unexpected"}`);
}

function done(path: string, ok: string): never {
  revalidatePath("/rendez-vous");
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${ok}`);
}

async function planner() {
  const auth = await appointmentsPlanner();
  if (!auth) redirect("/rendez-vous");
  return auth;
}

// —— Page de réservation et types (RDV-01, D11) ————————————————————————————————————

export async function saveBookingPageAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const parsed = z.object({ slug: text(80), active: z.boolean(), privacyNotice: text(3000) }).safeParse({ slug: value(formData, "slug"), active: formData.get("active") === "on", privacyNotice: value(formData, "privacyNotice") });
  if (!parsed.success) return fail("/rendez-vous/reglages", new AppointmentInvalidError("slug"));
  try {
    await saveBookingPage(auth.user.organizationId, { slug: parsed.data.slug, active: parsed.data.active, privacyNotice: parsed.data.privacyNotice || null });
  } catch (error) {
    return fail("/rendez-vous/reglages", error);
  }
  done("/rendez-vous/reglages", "pageSaved");
}

// RDV-01 : nom et durée, en moins d'une minute.
export async function createAppointmentTypeAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const parsed = z.object({ name: text(120).min(1), durationMinutes: z.coerce.number().int().min(15).max(480) }).safeParse({ name: value(formData, "name"), durationMinutes: value(formData, "durationMinutes") });
  if (!parsed.success) return fail("/rendez-vous/reglages", new AppointmentInvalidError(parsed.error.issues[0]?.path[0] === "name" ? "name" : "durationMinutes"));
  let id: string;
  try {
    id = (await createAppointmentType(auth.user.organizationId, parsed.data, auth.user.id)).id;
  } catch (error) {
    return fail("/rendez-vous/reglages", error);
  }
  revalidatePath("/rendez-vous");
  redirect(`/rendez-vous/reglages?ok=typeCreated&type=${id}#types`);
}

export async function addStarterTypesAction(): Promise<void> {
  const auth = await planner();
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  try {
    await addStarterAppointmentTypes(auth.user.organizationId, auth.user.id, locale);
  } catch (error) {
    return fail("/rendez-vous/reglages", error);
  }
  done("/rendez-vous/reglages", "startersAdded");
}

const questionSchema = z.object({ id: z.string().max(40), label: text(200), kind: z.enum(["choice", "text"]), choices: z.array(text(120)).max(12), required: z.boolean() });

export async function updateAppointmentTypeAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = value(formData, "id");
  const path = `/rendez-vous/reglages/types/${id}`;
  const questions: z.infer<typeof questionSchema>[] = [];
  for (let index = 0; index < 5; index++) {
    const label = value(formData, `question${index}Label`).trim();
    if (!label) continue;
    const kind = value(formData, `question${index}Kind`) === "choice" ? "choice" : "text";
    // Lot 64 (D7) : « Obligatoire » ; les choix arrivent un par ligne (les pastilles de l'éditeur).
    questions.push({ id: value(formData, `question${index}Id`) || `q${index + 1}`, label, kind, choices: kind === "choice" ? value(formData, `question${index}Choices`).split("\n").map((line) => line.trim()).filter(Boolean) : [], required: formData.get(`question${index}Required`) === "on" });
  }
  const parsed = z
    .object({
      id: uuid,
      name: text(120).min(1),
      durationMinutes: z.coerce.number().int().min(15).max(480),
      locationKind: z.enum(APPOINTMENT_LOCATION_KINDS),
      location: text(500),
      description: text(300),
      bufferBeforeMinutes: z.coerce.number().int().min(0).max(240),
      bufferAfterMinutes: z.coerce.number().int().min(0).max(240),
      minNoticeHours: z.coerce.number().int().min(0).max(720),
      horizonDays: z.coerce.number().int().min(1).max(365),
      reminders: z.enum(APPOINTMENT_REMINDER_PLANS),
      questions: z.array(questionSchema).max(5),
    })
    .safeParse({
      id,
      name: value(formData, "name"),
      durationMinutes: value(formData, "durationMinutes"),
      locationKind: value(formData, "locationKind"),
      location: value(formData, "location"),
      description: value(formData, "description"),
      bufferBeforeMinutes: value(formData, "bufferBeforeMinutes"),
      bufferAfterMinutes: value(formData, "bufferAfterMinutes"),
      minNoticeHours: value(formData, "minNoticeHours"),
      horizonDays: value(formData, "horizonDays"),
      reminders: value(formData, "reminders"),
      questions,
    });
  if (!parsed.success) return fail(path, new AppointmentInvalidError(String(parsed.error.issues[0]?.path[0] ?? "name")));
  const { minNoticeHours, id: typeId, ...input } = parsed.data;
  // La personne qui reçoit : un compte actif de l'équipe, jamais un identifiant venu d'ailleurs.
  const hostUserId = value(formData, "hostUserId");
  const team = await listTeam(appDatabase(), auth.user.organizationId);
  if (!team.some((member) => member.id === hostUserId && !member.disabledAt)) return fail(path, new AppointmentInvalidError("host"));
  try {
    await updateAppointmentType(auth.user.organizationId, typeId, {
      ...input,
      hostUserId,
      location: input.location || null,
      description: input.description || null,
      minNoticeMinutes: minNoticeHours * 60,
      allowEventDays: formData.get("allowEventDays") === "on",
      active: formData.get("active") === "on",
    });
  } catch (error) {
    return fail(path, error);
  }
  done(path, "typeSaved");
}

export async function trashAppointmentTypeAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = uuid.safeParse(value(formData, "id"));
  if (!id.success) return fail("/rendez-vous/reglages", new AppointmentTypeNotFoundError());
  try {
    await trashAppointmentType(auth.user.organizationId, id.data);
  } catch (error) {
    return fail("/rendez-vous/reglages", error);
  }
  await offerUndo({ kind: "appointmentType", id: id.data });
  done("/rendez-vous/reglages", "typeTrashed");
}

// —— Disponibilités et agendas extérieurs (D2) ————————————————————————————————————

export async function saveAvailabilityAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const rules = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    for (const slot of [0, 1]) {
      const start = value(formData, `d${weekday}s${slot}`);
      const end = value(formData, `d${weekday}e${slot}`);
      if (start && end) rules.push({ weekday, startTime: start, endTime: end });
    }
  }
  try {
    await saveAvailabilityRules(auth.user.organizationId, auth.user.id, rules);
  } catch (error) {
    return fail("/rendez-vous/disponibilites", error);
  }
  done("/rendez-vous/disponibilites", "availabilitySaved");
}

export async function addClosureAction(formData: FormData): Promise<void> {
  const auth = await planner();
  try {
    await addAvailabilityClosure(auth.user.organizationId, auth.user.id, { startsOn: value(formData, "startsOn"), endsOn: value(formData, "endsOn") || value(formData, "startsOn"), reason: value(formData, "reason").slice(0, 80) || null });
  } catch (error) {
    return fail("/rendez-vous/disponibilites", error);
  }
  done("/rendez-vous/disponibilites", "closureAdded");
}

export async function removeClosureAction(formData: FormData): Promise<void> {
  const auth = await planner();
  try {
    await removeAvailabilityClosure(auth.user.organizationId, auth.user.id, value(formData, "id"));
  } catch (error) {
    return fail("/rendez-vous/disponibilites", error);
  }
  done("/rendez-vous/disponibilites", "closureRemoved");
}

// L'adresse secrète n'est jamais renvoyée à l'écran ni écrite au journal.
export async function addCalendarSourceAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const parsed = z.object({ label: text(80).min(1), url: z.string().trim().min(1).max(2000) }).safeParse({ label: value(formData, "label"), url: value(formData, "url") });
  if (!parsed.success) return fail("/rendez-vous/disponibilites#agendas", new AppointmentInvalidError(parsed.error.issues[0]?.path[0] === "label" ? "label" : "calendarUrl"));
  try {
    await addCalendarSource(auth.user.organizationId, auth.user.id, parsed.data);
  } catch (error) {
    return fail("/rendez-vous/disponibilites", error);
  }
  done("/rendez-vous/disponibilites", "sourceAdded");
}

export async function refreshCalendarSourceAction(formData: FormData): Promise<void> {
  const auth = await planner();
  try {
    await refreshMyCalendarSource(auth.user.organizationId, auth.user.id, value(formData, "id"));
  } catch (error) {
    return fail("/rendez-vous/disponibilites", error);
  }
  done("/rendez-vous/disponibilites", "sourceRefreshed");
}

export async function removeCalendarSourceAction(formData: FormData): Promise<void> {
  const auth = await planner();
  try {
    await removeCalendarSource(auth.user.organizationId, auth.user.id, value(formData, "id"));
  } catch (error) {
    return fail("/rendez-vous/disponibilites", error);
  }
  done("/rendez-vous/disponibilites", "sourceRemoved");
}

// —— Rendez-vous (RDV-03, RDV-04) ———————————————————————————————————————————————————

export async function createManualAppointmentAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const startsAt = parisInstant(value(formData, "startsAt"));
  const parsed = z
    .object({ typeId: uuid, name: text(200).min(1), email: text(254), phone: text(40), eventId: z.union([uuid, z.literal("")]) })
    .safeParse({ typeId: value(formData, "typeId"), name: value(formData, "name"), email: value(formData, "email"), phone: value(formData, "phone"), eventId: value(formData, "eventId") });
  if (!parsed.success || !startsAt) return fail("/rendez-vous/nouveau", new AppointmentInvalidError(!startsAt ? "startsAt" : String(parsed.error?.issues[0]?.path[0] ?? "name")));
  let id: string;
  try {
    const locale = (await getLocale()) === "en" ? "en" : "fr";
    id = (await createManualAppointment(auth.user.organizationId, { ...parsed.data, startsAt, email: parsed.data.email || null, phone: parsed.data.phone || null, eventId: parsed.data.eventId || null, notify: formData.get("notify") === "on", locale })).appointment.id;
  } catch (error) {
    return fail("/rendez-vous/nouveau", error);
  }
  revalidatePath("/rendez-vous");
  redirect(`/rendez-vous/${id}?ok=created`);
}

const reasonOf = (raw: string): AppointmentCancelReason | null => ((APPOINTMENT_CANCEL_REASONS as readonly string[]).includes(raw) ? (raw as AppointmentCancelReason) : null);

export async function cancelAppointmentAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = value(formData, "id");
  try {
    await cancelAppointment(auth.user.organizationId, id, { reason: reasonOf(value(formData, "reason")), notify: formData.get("notify") === "on" });
  } catch (error) {
    return fail(`/rendez-vous/${id}`, error);
  }
  done(`/rendez-vous/${id}`, "cancelled");
}

export async function moveAppointmentAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = value(formData, "id");
  const startsAt = parisInstant(value(formData, "startsAt"));
  if (!startsAt) return fail(`/rendez-vous/${id}`, new AppointmentInvalidError("startsAt"));
  try {
    await moveAppointment(auth.user.organizationId, id, startsAt, { notify: formData.get("notify") === "on" });
  } catch (error) {
    return fail(`/rendez-vous/${id}`, error);
  }
  done(`/rendez-vous/${id}`, "moved");
}

export async function trashAppointmentAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = value(formData, "id");
  try {
    await trashAppointment(auth.user.organizationId, id);
  } catch (error) {
    return fail(`/rendez-vous/${id}`, error);
  }
  await offerUndo({ kind: "appointment", id });
  done("/rendez-vous", "trashed");
}

// RDV-04 (D7) : rattacher à un évènement, ou en créer une option sans ressaisie.
export async function linkEventAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = value(formData, "id");
  const eventId = value(formData, "eventId");
  try {
    await linkAppointmentToEvent(auth.user.organizationId, id, eventId === "" ? null : eventId);
  } catch (error) {
    return fail(`/rendez-vous/${id}`, error);
  }
  done(`/rendez-vous/${id}`, eventId === "" ? "unlinked" : "linked");
}

export async function createOptionAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = value(formData, "id");
  const parsed = z.object({ prospectSourceId: uuid, eventDate: z.union([z.iso.date(), z.literal("")]) }).safeParse({ prospectSourceId: value(formData, "prospectSourceId"), eventDate: value(formData, "eventDate") });
  if (!parsed.success) return fail(`/rendez-vous/${id}`, new AppointmentInvalidError("prospectSourceId"));
  try {
    await createOptionFromAppointment(auth.user.organizationId, id, { createdByUserId: auth.user.id, prospectSourceId: parsed.data.prospectSourceId, eventDate: parsed.data.eventDate || null });
  } catch (error) {
    return fail(`/rendez-vous/${id}`, error);
  }
  done(`/rendez-vous/${id}`, "optionCreated");
}

// —— Compte rendu (EVT-10 ; D8, D9) ——————————————————————————————————————————————————

export async function saveReportAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = value(formData, "id");
  try {
    await saveAppointmentReport(auth.user.organizationId, id, value(formData, "notes").slice(0, 10_000));
  } catch (error) {
    return fail(`/rendez-vous/${id}#compte-rendu`, error);
  }
  done(`/rendez-vous/${id}`, "reportSaved");
}

export async function addReportActionAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = value(formData, "id");
  const dueOn = value(formData, "dueOn");
  try {
    await addAppointmentReportAction(auth.user.organizationId, id, { label: value(formData, "label"), dueOn: dueOn === "" ? null : dueOn, responsible: value(formData, "responsible") === "clients" ? "clients" : "planner" });
  } catch (error) {
    return fail(`/rendez-vous/${id}`, error);
  }
  done(`/rendez-vous/${id}`, "actionAdded");
}

export async function removeReportActionAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = value(formData, "id");
  try {
    await removeAppointmentReportAction(auth.user.organizationId, value(formData, "actionId"));
  } catch (error) {
    return fail(`/rendez-vous/${id}`, error);
  }
  done(`/rendez-vous/${id}`, "actionRemoved");
}

// EVT-10 : « En faire une tâche », en un geste.
export async function convertActionToTaskAction(formData: FormData): Promise<void> {
  const auth = await planner();
  const id = value(formData, "id");
  try {
    await convertActionToTask(auth.user.organizationId, value(formData, "actionId"));
  } catch (error) {
    return fail(`/rendez-vous/${id}`, error);
  }
  done(`/rendez-vous/${id}`, "taskCreated");
}
