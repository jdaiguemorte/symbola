"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { starterLossReasons, starterProspectSources, type StarterLocale } from "@symbola/starter-templates";
import { addLossReasons, addProspectSources, createLossReason, createProspectSource } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";

export type EventsSettingsFormState = { error?: string; success?: boolean; sources?: number; reasons?: number };

export async function createProspectSourceAction(
  _prevState: EventsSettingsFormState,
  formData: FormData,
): Promise<EventsSettingsFormState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: t("missingLabel") };

  await createProspectSource(auth.user.organizationId, label);
  revalidatePath("/events/parametres", "layout");
  revalidatePath("/events/new");
  return { success: true };
}

export async function createLossReasonAction(
  _prevState: EventsSettingsFormState,
  formData: FormData,
): Promise<EventsSettingsFormState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") };

  const label = String(formData.get("label") ?? "").trim();
  const isFreeText = formData.get("isFreeText") === "on";
  if (!label) return { error: t("missingLabel") };

  await createLossReason(auth.user.organizationId, label, isFreeText);
  revalidatePath("/events/parametres", "layout");
  return { success: true };
}

// PRD-EVT-07 — listes de départ (packages/starter-templates), dans la langue de
// la planner : sources de prospect et motifs de perte, sans doublon.
export async function loadStarterListsAction(
  _prevState: EventsSettingsFormState,
  _formData: FormData,
): Promise<EventsSettingsFormState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") };

  const locale = (await getLocale()) as StarterLocale;
  const sources = await addProspectSources(auth.user.organizationId, starterProspectSources(locale));
  const reasons = await addLossReasons(auth.user.organizationId, starterLossReasons(locale));
  revalidatePath("/events/parametres", "layout");
  revalidatePath("/events/new");
  return { success: true, sources, reasons };
}

