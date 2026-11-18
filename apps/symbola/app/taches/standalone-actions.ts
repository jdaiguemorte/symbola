"use server";

// Lot 53 (CHR-10 ; D6) — tâches hors évènement : ajouter (avec sa répétition), cocher (la suivante naît
// si elle se répète), supprimer (corbeille). Le module Évènements valide tout (Zod) ; une tâche d'une
// autre organisation ou d'un évènement n'est pas touchée (RLS, event_id nul exigé).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { parisToday } from "@symbola/i18n";
import { addStandaloneTask, deleteStandaloneTask, PlanningInputError, setStandaloneTaskDone } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled } from "@/app/events/module-access";

export type StandaloneTaskFormState = { error?: string; success?: boolean };

export async function addStandaloneTaskAction(_prev: StandaloneTaskFormState, formData: FormData): Promise<StandaloneTaskFormState> {
  const auth = await requirePlanner();
  const t = await getTranslations("StandaloneTasks");
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("invalid") };
  const recurrence = String(formData.get("recurrence") ?? "");
  try {
    await addStandaloneTask(auth.user.organizationId, { label: String(formData.get("label") ?? ""), dueDate: String(formData.get("dueDate") ?? ""), recurrence: recurrence === "" ? null : recurrence });
  } catch (error) {
    if (error instanceof PlanningInputError) return { error: t("invalid") };
    throw error;
  }
  revalidatePath("/taches");
  revalidatePath("/");
  return { success: true };
}

export async function completeStandaloneTaskAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  try {
    const now = new Date();
    await setStandaloneTaskDone(auth.user.organizationId, String(formData.get("taskId") ?? ""), true, now, parisToday(now));
  } catch (error) {
    if (!(error instanceof PlanningInputError)) throw error;
  }
  revalidatePath("/taches");
  revalidatePath("/");
}

export async function deleteStandaloneTaskAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  try {
    await deleteStandaloneTask(auth.user.organizationId, String(formData.get("taskId") ?? ""));
  } catch (error) {
    if (!(error instanceof PlanningInputError)) throw error;
  }
  revalidatePath("/taches");
  revalidatePath("/");
}
