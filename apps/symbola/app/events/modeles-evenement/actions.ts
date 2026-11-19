"use server";

// Lot 58 (EVT-08 ; ADR 0097) — créer un évènement depuis un modèle (à une date), supprimer un modèle.
// Session de la planner, organisation, module, objet ; un modèle d'une autre organisation n'existe pas.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { createEventFromTemplate } from "@/lib/events/event-templates";
import { EventTemplateNotFoundError, removeEventTemplate } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type TemplateFormState = { error?: string };

async function access(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

export async function createFromTemplateAction(_state: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const t = await getTranslations("EventTemplates");
  const allowed = await access();
  if (!allowed) return { error: t("errors.unauthenticated") };
  const templateId = String(formData.get("templateId") ?? "");
  const eventDate = String(formData.get("eventDate") ?? "");
  if (!isValidId(templateId)) return { error: t("errors.notFound") };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return { error: t("errors.date") };
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  let eventId: string;
  try {
    eventId = await createEventFromTemplate(allowed.organizationId, templateId, { eventDate, userId: allowed.userId, locale });
  } catch (error) {
    if (error instanceof EventTemplateNotFoundError) return { error: t("errors.notFound") };
    throw error;
  }
  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}

export async function removeTemplateAction(formData: FormData): Promise<void> {
  const allowed = await access();
  if (!allowed) return;
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return;
  try {
    await removeEventTemplate(allowed.organizationId, templateId);
  } catch (error) {
    if (!(error instanceof EventTemplateNotFoundError)) throw error;
  }
  revalidatePath("/events/modeles-evenement");
}
