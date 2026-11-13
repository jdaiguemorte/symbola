"use server";

// Lot 32a (HUB-08, EVT-02, PAR-03 ; décisions D6 et D7) — actions de « Aujourd'hui » et du cockpit :
// cocher une tâche (avec « Annuler » pendant dix secondes), la rétablir, la reporter, relancer un
// prestataire retenu sans contrat. Contrôles côté serveur : session planner, organisation, module
// Évènements souscrit, identifiants valides ; le retour ne mène qu'à l'accueil ou à la fiche.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { eventNames, EventTaskNotFoundError, getEvent, recordVendorReminder, updateEventTask, VendorCandidateNotFoundError } from "@/modules/events/service";
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

export type RemindState = { error?: string; message?: string; mailto?: string; nonce?: number };

// D6 : la relance s'inscrit dans l'activité ; le message part de la messagerie de la planner,
// prérempli (Symbola n'envoie rien). Sans adresse dans la fiche du carnet, la relance reste inscrite.
export async function remindVendorAction(_prev: RemindState, formData: FormData): Promise<RemindState> {
  const t = await getTranslations("Today");
  const tEvents = await getTranslations("Events");
  const allowed = await access();
  if (!allowed) return { error: tEvents("unauthenticated") };
  const eventId = String(formData.get("eventId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!isValidId(eventId) || !isValidId(candidateId)) return { error: tEvents("eventNotFound") };
  let reminded;
  try {
    reminded = await recordVendorReminder({ organizationId: allowed.organizationId, eventId, candidateId, userId: allowed.userId });
  } catch (error) {
    if (error instanceof VendorCandidateNotFoundError) return { error: tEvents("eventNotFound") };
    throw error;
  }
  const db = appDatabase();
  const vendorsEnabled = reminded.vendorId ? await isModuleEnabled(db, allowed.organizationId, "vendors") : false;
  const email = reminded.vendorId && vendorsEnabled ? ((await getVendorContacts(allowed.organizationId, [reminded.vendorId]))[0]?.email ?? null) : null;
  refresh(eventId);
  if (!email) return { message: t("remind.noEmail"), nonce: Date.now() };
  const locale = (await getLocale()) as Locale;
  const event = await getEvent(allowed.organizationId, eventId);
  const header = await getDocumentHeader(db, allowed.organizationId);
  const names = event ? eventNames(event.clients) : "";
  const subject = t("remind.subject", { names });
  const body = t("remind.body", {
    slot: reminded.slotLabel,
    names,
    date: event?.eventDate ? t("remind.dateSuffix", { date: formatCalendarDate(event.eventDate, locale) }) : "",
    organization: header?.organizationName ?? "",
  });
  const mailto = `mailto:${encodeURIComponent(email)}?${new URLSearchParams({ subject, body }).toString().replace(/\+/g, "%20")}`;
  return { message: t("remind.recorded"), mailto, nonce: Date.now() };
}
