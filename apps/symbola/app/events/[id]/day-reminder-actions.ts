"use server";

// Lot 66b (JRJ-01 ; D2, D3 ; M18) — le rappel du jour J réglé pour un évènement : coupé, ou un autre
// moment ou une autre heure, cible par cible ; ce qui est égal au réglage de l'organisation n'est pas
// gardé. « Revenir au réglage de l'organisation » efface tout. La tâche périodique relit aussitôt.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { clearDayReminderOverride, EventNotFoundError, setDayReminderOverride } from "@/modules/events/service";
import { listDayReminderTargets } from "@/modules/hub/service";
import { forgetDayReminders } from "@/lib/day-reminders";
import { readDayReminderForm } from "@/lib/day-reminder-form-data";
import { getPlannerAuthContext } from "@/lib/auth-context";
import type { DayReminderFormState } from "@/app/ui/day-reminder-form";
import { isEventsModuleEnabled, isValidId } from "../module-access";

async function organization(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

export async function saveEventDayReminderAction(_prev: DayReminderFormState, formData: FormData): Promise<DayReminderFormState> {
  const t = await getTranslations("DayReminder");
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  if (!organizationId || !isValidId(eventId)) return { error: t("invalid") };
  const organizationSettings = await listDayReminderTargets(organizationId);
  try {
    for (const row of readDayReminderForm(formData)) {
      const base = organizationSettings.find((setting) => setting.target === row.target);
      if (base && base.enabled === row.enabled && base.moment === row.moment && base.sendTime === row.sendTime) await clearDayReminderOverride(organizationId, eventId, row.target);
      else await setDayReminderOverride(organizationId, eventId, row.target, { enabled: row.enabled, moment: row.moment, sendTime: row.sendTime });
    }
  } catch (error) {
    if (error instanceof EventNotFoundError || error instanceof RangeError) return { error: t("invalid") };
    throw error;
  }
  forgetDayReminders(organizationId);
  revalidatePath(`/events/${eventId}`);
  return { success: t("event.saved") };
}

export async function resetEventDayReminderAction(_prev: DayReminderFormState, formData: FormData): Promise<DayReminderFormState> {
  const t = await getTranslations("DayReminder");
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  if (!organizationId || !isValidId(eventId)) return { error: t("invalid") };
  for (const target of ["planner", "vendors", "team", "clients"]) await clearDayReminderOverride(organizationId, eventId, target);
  forgetDayReminders(organizationId);
  revalidatePath(`/events/${eventId}`);
  return { success: t("event.resetDone") };
}
