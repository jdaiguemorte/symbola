"use server";

// Lot 64 (HUB-29, RDV-02 ; D1, D2 ; maquettes M1 à M4) — plages occupées : règle d'un type, règle des
// évènements sans type, « les options bloquent », réglage propre d'un évènement. Contrôles côté
// serveur : session, rôle planner, organisation, module Évènements ; l'objet est cherché sous la RLS
// de l'organisation (un identifiant d'une autre organisation ne trouve rien).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { BusyRuleInvalidError, EventArchivedError, setBusySettings, setEventBusyRule, setEventTypeBusyRule } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import type { FormDialogState } from "@/app/ui/form-dialog";
import { isEventsModuleEnabled, isValidId } from "./module-access";

async function organization(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

function ruleFrom(formData: FormData) {
  return {
    startDayOffset: Number(formData.get("startDayOffset")),
    startTime: String(formData.get("startTime") ?? ""),
    endDayOffset: Number(formData.get("endDayOffset")),
    endTime: String(formData.get("endTime") ?? ""),
  };
}

async function failure(error: unknown): Promise<FormDialogState> {
  const t = await getTranslations("Busy");
  if (error instanceof BusyRuleInvalidError) return { error: t(error.reason === "rule" ? "invalidRule" : "notFound") };
  if (error instanceof EventArchivedError) return { error: t("archived") };
  throw error;
}

function revalidateSettings() {
  revalidatePath("/events/parametres/plages-occupees");
}

export async function saveTypeBusyRuleAction(_state: FormDialogState, formData: FormData): Promise<FormDialogState> {
  const organizationId = await organization();
  const eventTypeId = String(formData.get("eventTypeId") ?? "");
  if (!organizationId || !isValidId(eventTypeId)) return { error: (await getTranslations("Events"))("unauthenticated") };
  try {
    await setEventTypeBusyRule(organizationId, eventTypeId, ruleFrom(formData));
  } catch (error) {
    return failure(error);
  }
  revalidateSettings();
  return { success: true, at: Date.now() };
}

export async function resetTypeBusyRuleAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  const eventTypeId = String(formData.get("eventTypeId") ?? "");
  if (!organizationId || !isValidId(eventTypeId)) return;
  await setEventTypeBusyRule(organizationId, eventTypeId, null).catch((error: unknown) => {
    if (!(error instanceof BusyRuleInvalidError)) throw error;
  });
  revalidateSettings();
}

export async function saveFallbackBusyRuleAction(_state: FormDialogState, formData: FormData): Promise<FormDialogState> {
  const organizationId = await organization();
  if (!organizationId) return { error: (await getTranslations("Events"))("unauthenticated") };
  try {
    await setBusySettings(organizationId, { fallback: ruleFrom(formData) });
  } catch (error) {
    return failure(error);
  }
  revalidateSettings();
  return { success: true, at: Date.now() };
}

export async function setOptionsBlockAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  if (!organizationId) return;
  await setBusySettings(organizationId, { optionsBlock: formData.get("optionsBlock") === "true" });
  revalidateSettings();
}

export async function saveEventBusyRuleAction(_state: FormDialogState, formData: FormData): Promise<FormDialogState> {
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  if (!organizationId || !isValidId(eventId)) return { error: (await getTranslations("Events"))("unauthenticated") };
  try {
    await setEventBusyRule(organizationId, eventId, ruleFrom(formData));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true, at: Date.now() };
}

export async function resetEventBusyRuleAction(formData: FormData): Promise<void> {
  const organizationId = await organization();
  const eventId = String(formData.get("eventId") ?? "");
  if (!organizationId || !isValidId(eventId)) return;
  await setEventBusyRule(organizationId, eventId, null).catch((error: unknown) => {
    if (!(error instanceof BusyRuleInvalidError) && !(error instanceof EventArchivedError)) throw error;
  });
  revalidatePath(`/events/${eventId}`);
}
