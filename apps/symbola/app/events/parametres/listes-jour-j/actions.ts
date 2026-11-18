"use server";

// Lot 51 (JRJ-06, HUB-20 ; ADR 0091) — modèles de listes de contrôle du jour J de l'organisation :
// modifier (nom, installation ou démontage, une case par ligne), ajouter, retirer. Une liste déjà
// copiée dans un évènement ne change pas (HUB-21).
import { revalidatePath } from "next/cache";
import { DayChecklistInvalidError, DayChecklistNotFoundError, removeDayChecklistTemplate, saveDayChecklistTemplate } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export type ChecklistTemplateState = { error?: boolean; saved?: boolean };

function input(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    phase: formData.get("phase") === "teardown" ? ("teardown" as const) : ("setup" as const),
    items: String(formData.get("items") ?? "").split("\n"),
  };
}

export async function saveChecklistTemplateAction(_prev: ChecklistTemplateState, formData: FormData): Promise<ChecklistTemplateState> {
  const auth = await requirePlanner();
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: true };
  const templateId = String(formData.get("templateId") ?? "");
  try {
    await saveDayChecklistTemplate(auth.user.organizationId, isValidId(templateId) ? templateId : null, input(formData));
  } catch (error) {
    if (error instanceof DayChecklistInvalidError || error instanceof DayChecklistNotFoundError) return { error: true };
    throw error;
  }
  revalidatePath("/events/parametres/listes-jour-j");
  return { saved: true };
}

export async function removeChecklistTemplateAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId) || !(await isEventsModuleEnabled(auth.user.organizationId))) return;
  await removeDayChecklistTemplate(auth.user.organizationId, templateId).catch((error: unknown) => {
    if (!(error instanceof DayChecklistNotFoundError)) throw error;
  });
  revalidatePath("/events/parametres/listes-jour-j");
}
