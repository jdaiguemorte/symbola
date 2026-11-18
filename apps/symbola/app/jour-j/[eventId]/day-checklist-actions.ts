"use server";

// Lot 51 (JRJ-06 ; ADR 0091) — préparer les listes de contrôle du jour J (en ligne) : une liste par
// temps fort, copiée d'un modèle de l'organisation ; une case ajoutée ou retirée ; une liste vierge
// retirée. Une case cochée ou une liste entamée restent (bilan). Session, module et évènement ouvert
// au jour J vérifiés à chaque action.
import { revalidatePath } from "next/cache";
import { addDayChecklistItem, createDayChecklist, DayChecklistInvalidError, DayChecklistNotFoundError, getEvent, removeDayChecklist, removeDayChecklistItem } from "@/modules/events/service";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { isDayOfOpen } from "./day-of-view";

async function access(formData: FormData): Promise<{ organizationId: string; eventId: string } | null> {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId) || !(await isEventsModuleEnabled(organizationId))) return null;
  const event = await getEvent(organizationId, eventId);
  return event && isDayOfOpen(event) ? { organizationId, eventId } : null;
}

async function quietly(eventId: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    // Refus attendus (liste entamée, case cochée, saisie trop longue) : l'écran reste tel quel.
    if (!(error instanceof DayChecklistInvalidError) && !(error instanceof DayChecklistNotFoundError)) throw error;
  }
  revalidatePath(`/jour-j/${eventId}`);
}

export async function createDayChecklistAction(formData: FormData): Promise<void> {
  const context = await access(formData);
  if (!context) return;
  const templateId = String(formData.get("templateId") ?? "");
  const keyMomentId = String(formData.get("keyMomentId") ?? "");
  await quietly(context.eventId, () => createDayChecklist({ ...context, templateId: isValidId(templateId) ? templateId : null, keyMomentId: isValidId(keyMomentId) ? keyMomentId : null }));
}

export async function addDayChecklistItemAction(formData: FormData): Promise<void> {
  const context = await access(formData);
  if (!context) return;
  await quietly(context.eventId, () => addDayChecklistItem({ ...context, checklistId: String(formData.get("checklistId") ?? ""), label: String(formData.get("label") ?? "") }));
}

export async function removeDayChecklistItemAction(formData: FormData): Promise<void> {
  const context = await access(formData);
  if (!context) return;
  await quietly(context.eventId, () => removeDayChecklistItem({ ...context, itemId: String(formData.get("itemId") ?? "") }));
}

export async function removeDayChecklistAction(formData: FormData): Promise<void> {
  const context = await access(formData);
  if (!context) return;
  await quietly(context.eventId, () => removeDayChecklist({ ...context, checklistId: String(formData.get("checklistId") ?? "") }));
}
