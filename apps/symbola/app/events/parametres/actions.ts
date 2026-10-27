"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createLossReason, createProspectSource } from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";

export type EventsSettingsFormState = { error?: string; success?: boolean };

export async function createProspectSourceAction(
  _prevState: EventsSettingsFormState,
  formData: FormData,
): Promise<EventsSettingsFormState> {
  const t = await getTranslations("Events");
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: t("missingLabel") };

  await createProspectSource(auth.user.organizationId, label);
  revalidatePath("/events/parametres");
  revalidatePath("/events/new");
  return { success: true };
}

export async function createLossReasonAction(
  _prevState: EventsSettingsFormState,
  formData: FormData,
): Promise<EventsSettingsFormState> {
  const t = await getTranslations("Events");
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") };

  const label = String(formData.get("label") ?? "").trim();
  const isFreeText = formData.get("isFreeText") === "on";
  if (!label) return { error: t("missingLabel") };

  await createLossReason(auth.user.organizationId, label, isFreeText);
  revalidatePath("/events/parametres");
  return { success: true };
}
