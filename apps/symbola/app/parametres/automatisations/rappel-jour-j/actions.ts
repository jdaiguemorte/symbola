"use server";

// Lot 66b (JRJ-01, HUB-28 ; D2, D3) — le rappel du jour J de l'organisation : la Propriétaire seule.
// La tâche périodique relit le réglage aussitôt.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { AutomationInputError, setDayReminderTarget } from "@/modules/hub/service";
import { forgetDayReminders } from "@/lib/day-reminders";
import { readDayReminderForm } from "@/lib/day-reminder-form-data";
import { requireOwner } from "@/lib/guards";
import type { DayReminderFormState } from "@/app/ui/day-reminder-form";

export async function saveDayReminderAction(_prev: DayReminderFormState, formData: FormData): Promise<DayReminderFormState> {
  const auth = await requireOwner();
  const t = await getTranslations("DayReminder");
  if (!auth) return { error: t("ownerOnly") };
  try {
    for (const row of readDayReminderForm(formData)) await setDayReminderTarget(auth.user.organizationId, row.target, { enabled: row.enabled, moment: row.moment, sendTime: row.sendTime });
  } catch (error) {
    if (error instanceof AutomationInputError) return { error: t("invalid") };
    throw error;
  }
  forgetDayReminders(auth.user.organizationId);
  revalidatePath("/parametres/automatisations/rappel-jour-j");
  revalidatePath("/parametres/automatisations");
  return { success: t("saved") };
}
