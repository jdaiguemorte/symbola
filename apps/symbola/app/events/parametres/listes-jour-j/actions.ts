"use server";

// Lot 51 (JRJ-06, HUB-20 ; ADR 0091) — modèles de listes de contrôle du jour J de l'organisation :
// modifier (nom, installation ou démontage, une case par ligne), ajouter, retirer. Une liste déjà
// copiée dans un évènement ne change pas (HUB-21).
import { revalidatePath } from "next/cache";
import { DayChecklistInvalidError, DayChecklistNotFoundError, removeDayChecklistTemplate, saveDayChecklistTemplate, setDayOfLeadDays } from "@/modules/events/service";
import { dayOfLeadDaysSchema } from "@symbola/contracts";
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

// Lot 72d (EVT-02 ; J9) — combien de jours avant le jour J « Ouvrir le Jour J » devient l'action de l'en-tête
// de la fiche (1 à 30) : un réglage isolé, enregistré seul (règle 19 de DESIGN.md). Validé ici (Zod) et par
// la base (contrainte de 0226) ; l'organisation est celle de la session (RLS).
export type DayOfLeadDaysState = { error?: boolean; saved?: boolean; days?: number; at?: number };

export async function saveDayOfLeadDaysAction(_prev: DayOfLeadDaysState, formData: FormData): Promise<DayOfLeadDaysState> {
  const auth = await requirePlanner();
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: true, at: Date.now() };
  const raw = String(formData.get("days") ?? "").trim();
  const parsed = dayOfLeadDaysSchema.safeParse(/^\d{1,3}$/.test(raw) ? Number(raw) : Number.NaN);
  if (!parsed.success) return { error: true, at: Date.now() };
  const days = await setDayOfLeadDays(auth.user.organizationId, parsed.data);
  revalidatePath("/events/parametres/listes-jour-j");
  return { saved: true, days, at: Date.now() };
}
