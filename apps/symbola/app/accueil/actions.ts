"use server";

// Lot 32a (HUB-08, EVT-02, PAR-03 ; décisions D6 et D7) — actions de « Aujourd'hui » et du cockpit :
// cocher une tâche (avec « Annuler » pendant dix secondes), la rétablir, la reporter, noter la relance
// d'un prestataire (lot 65d). Contrôles côté serveur : session planner, organisation, module
// Évènements souscrit, identifiants valides ; le retour ne mène qu'à l'accueil ou à la fiche.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { z } from "zod";
import { ENGAGED_CANDIDATE_STATUSES } from "@symbola/contracts";
import { DemoEventRestrictionError, eventNames, EventTaskNotFoundError, getEvent, listEventVendorSlots, listVendorCandidates, recordVendorReminder, updateEventTask, VendorCandidateNotFoundError } from "@/modules/events/service";
import { getDocumentHeader, isModuleEnabled } from "@/modules/hub/service";
import { getVendorContacts } from "@/modules/vendors/service";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function access(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

// Jamais une adresse venue du formulaire : l'accueil, ou la synthèse de l'évènement.
function returnPath(formData: FormData, eventId: string): string {
  return formData.get("returnTo") === "event" ? `/events/${eventId}` : "/";
}

function refresh(eventId: string): void {
  revalidatePath("/");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/taches");
}

// D7 : la tâche est faite tout de suite ; l'écran propose « Annuler » pendant dix secondes.
export async function completeTaskAction(formData: FormData): Promise<void> {
  const allowed = await access();
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!allowed || !isValidId(eventId) || !isValidId(taskId)) return;
  try {
    await updateEventTask({ organizationId: allowed.organizationId, taskId, done: true });
  } catch (error) {
    if (error instanceof EventTaskNotFoundError) return;
    throw error;
  }
  refresh(eventId);
  redirect(`${returnPath(formData, eventId)}?${new URLSearchParams({ fait: taskId, evenement: eventId }).toString()}`);
}

export async function undoTaskAction(formData: FormData): Promise<void> {
  const allowed = await access();
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!allowed || !isValidId(eventId) || !isValidId(taskId)) return;
  try {
    await updateEventTask({ organizationId: allowed.organizationId, taskId, done: false });
  } catch (error) {
    if (error instanceof EventTaskNotFoundError) return;
    throw error;
  }
  refresh(eventId);
  redirect(returnPath(formData, eventId));
}

export type PostponeState = { error?: string; message?: string };

// Cockpit : « Reporter » une tâche à une nouvelle date.
export async function postponeTaskAction(_prev: PostponeState, formData: FormData): Promise<PostponeState> {
  const t = await getTranslations("Events");
  const allowed = await access();
  if (!allowed) return { error: t("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const dueDate = String(formData.get("dueDate") ?? "");
  if (!isValidId(eventId) || !isValidId(taskId)) return { error: t("taskNotFound") };
  if (!DATE_PATTERN.test(dueDate)) return { error: t("invalidDate") };
  try {
    await updateEventTask({ organizationId: allowed.organizationId, taskId, dueDate });
  } catch (error) {
    if (error instanceof EventTaskNotFoundError) return { error: t("taskNotFound") };
    if (error instanceof RangeError) return { error: t("invalidDate") };
    throw error;
  }
  refresh(eventId);
  const tToday = await getTranslations("Today");
  return { message: tToday("cockpit.postponed", { date: formatCalendarDate(dueDate, (await getLocale()) as Locale) }) };
}

// Lot 65d (PRE-02, HUB-08 ; M16) : « Noter une relance » remplace « Relancer ». Rien n'est envoyé ni
// ouvert d'office : la planner déclare comment et quand elle a relancé, et quand y revenir ; le
// message type se copie s'il lui sert. Le prestataire quitte « Aujourd'hui » jusqu'au rappel.
export type ReminderDraft = { subject: string; body: string; email: string | null } | null;

async function reminderContext(organizationId: string, eventId: string, candidateId: string) {
  const event = await getEvent(organizationId, eventId);
  const candidate = event ? (await listVendorCandidates(organizationId, eventId)).find((entry) => entry.id === candidateId) : undefined;
  if (!event || !candidate) return null;
  const slot = (await listEventVendorSlots(organizationId, eventId)).find((entry) => entry.id === candidate.vendorSlotId);
  return { event, candidate, slotLabel: slot?.label ?? "" };
}

// Le message type, à copier : le contrat attendu d'un prestataire retenu, sinon son devis.
export async function vendorReminderDraftAction(input: { eventId: string; candidateId: string }): Promise<ReminderDraft> {
  const t = await getTranslations("Today");
  const allowed = await access();
  if (!allowed || !isValidId(input.eventId) || !isValidId(input.candidateId)) return null;
  const context = await reminderContext(allowed.organizationId, input.eventId, input.candidateId);
  if (!context) return null;
  const db = appDatabase();
  const vendorsEnabled = context.candidate.vendorId ? await isModuleEnabled(db, allowed.organizationId, "vendors") : false;
  const email = context.candidate.vendorId && vendorsEnabled ? ((await getVendorContacts(allowed.organizationId, [context.candidate.vendorId]))[0]?.email ?? null) : null;
  const locale = (await getLocale()) as Locale;
  const header = await getDocumentHeader(db, allowed.organizationId);
  const names = eventNames(context.event.clients, context.event.name);
  const values = {
    slot: context.slotLabel,
    names,
    date: context.event.eventDate ? t("remind.dateSuffix", { date: formatCalendarDate(context.event.eventDate, locale) }) : "",
    organization: header?.organizationName ?? "",
  };
  const contract = ENGAGED_CANDIDATE_STATUSES.includes(context.candidate.status);
  return { subject: t(contract ? "remind.subject" : "remind.quoteSubject", { names }), body: t(contract ? "remind.body" : "remind.quoteBody", values), email };
}

export type NoteReminderState = { saved?: string; error?: string };

const reminderSchema = z.object({
  eventId: z.uuid(),
  candidateId: z.uuid(),
  channel: z.enum(["phone", "email", "sms", "in_person"]),
  remindedOn: z.string().regex(DATE_PATTERN),
  recallDays: z.enum(["none", "2", "3", "7", "14"]),
  note: z.string().max(2000),
});

export async function noteVendorReminderAction(_prev: NoteReminderState, formData: FormData): Promise<NoteReminderState> {
  const t = await getTranslations("Today");
  const tEvents = await getTranslations("Events");
  const allowed = await access();
  if (!allowed) return { error: tEvents("unauthenticated") };
  const parsed = reminderSchema.safeParse({
    eventId: formData.get("eventId"),
    candidateId: formData.get("candidateId"),
    channel: formData.get("channel"),
    remindedOn: formData.get("remindedOn"),
    recallDays: formData.get("recallDays"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: t("reminder.invalid") };
  const { eventId, candidateId, channel, remindedOn, recallDays, note } = parsed.data;
  const recallOn = recallDays === "none" ? null : addDaysTo(remindedOn, Number(recallDays));
  try {
    await recordVendorReminder({ organizationId: allowed.organizationId, eventId, candidateId, userId: allowed.userId, channel, remindedOn, recallOn, note });
  } catch (error) {
    if (error instanceof VendorCandidateNotFoundError) return { error: tEvents("eventNotFound") };
    // Lot 33b (HUB-10) : rien ne part vers un tiers depuis un évènement fictif.
    if (error instanceof DemoEventRestrictionError) return { error: tEvents("demoNoSend") };
    if (error instanceof RangeError) return { error: t("reminder.invalid") };
    throw error;
  }
  refresh(eventId);
  const locale = (await getLocale()) as Locale;
  return { saved: recallOn ? t("reminder.saved", { date: formatCalendarDate(recallOn, locale) }) : t("reminder.savedNoRecall") };
}

function addDaysTo(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
