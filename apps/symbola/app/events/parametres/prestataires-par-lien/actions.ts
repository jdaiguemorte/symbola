"use server";

// Lot 47 (partie F ; ADR 0085) — réglages des prestataires par lien : la titulaire seule les change
// (date limite par défaut, relance, feuilles de route, délai d'alerte, tâches de suivi, HUB-20).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { saveVendorCoordinationSettings, VendorBriefInvalidError } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "@/app/events/module-access";

export type SettingsState = { error?: string; success?: boolean };

export async function saveVendorCoordinationSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const t = await getTranslations("VendorCoordination");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || auth.user.role !== "owner") return { error: t("errors.unauthorized") };
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("errors.unauthorized") };
  const labels = formData.getAll("taskLabel").map((value) => String(value).trim());
  const days = formData.getAll("taskDays").map((value) => Number(String(value)));
  const tasks = labels.map((label, index) => ({ label, dueInDays: days[index] ?? 0 })).filter((task) => task.label !== "");
  try {
    await saveVendorCoordinationSettings({
      organizationId: auth.user.organizationId,
      briefDeadlineDays: Number(formData.get("briefDeadlineDays")),
      briefReminder: formData.get("briefReminder") === "on",
      roadmapMonth: formData.get("roadmapMonth") === "on",
      roadmapWeek: formData.get("roadmapWeek") === "on",
      roadmapAlertDays: Number(formData.get("roadmapAlertDays")),
      followUpTasks: formData.get("resetTasks") === "on" ? null : tasks,
    });
  } catch (error) {
    if (error instanceof VendorBriefInvalidError) return { error: t("errors.settings") };
    throw error;
  }
  revalidatePath("/events/parametres/prestataires-par-lien");
  return { success: true };
}
