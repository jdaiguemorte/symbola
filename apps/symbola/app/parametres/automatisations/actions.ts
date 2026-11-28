"use server";

// Lot 53 (HUB-28 ; D5) — activer, couper ou régler un automatisme : la Propriétaire seule (réglage de
// l'organisation). Couper arrête les envois à venir ; à la remise en route, rien n'est rattrapé.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { AutomationInputError, setAutomationDays, setAutomationEnabled, setAutomationSendTime, setDefaultSendTime } from "@/modules/hub/service";
import { forgetSendTimes } from "@/lib/automation-gates";
import { requireOwner } from "@/lib/guards";

export type AutomationFormState = { error?: string; success?: boolean };

export async function toggleAutomationAction(formData: FormData): Promise<void> {
  const auth = await requireOwner();
  if (!auth) return;
  try {
    await setAutomationEnabled(auth.user.organizationId, String(formData.get("key") ?? ""), formData.get("enabled") === "true", new Date(), auth.user.id);
  } catch (error) {
    if (!(error instanceof AutomationInputError)) throw error;
  }
  revalidatePath("/parametres/automatisations");
  revalidatePath("/parametres/radar");
}

// Lot 74h (D7, G10) : l'interrupteur d'un automatisme, réglage isolé qui s'enregistre seul. Couper garde la
// date et la personne (0246) ; remettre en marche les efface. La titulaire seule (requireOwner) ; un membre
// n'a pas l'interrupteur, et une requête forgée est refusée ici.
export async function setAutomationRunningAction(_prev: AutomationFormState, formData: FormData): Promise<AutomationFormState> {
  const auth = await requireOwner();
  const t = await getTranslations("Automations");
  if (!auth) return { error: t("ownerOnly") };
  try {
    await setAutomationEnabled(auth.user.organizationId, String(formData.get("key") ?? ""), formData.get("enabled") === "1", new Date(), auth.user.id);
  } catch (error) {
    if (error instanceof AutomationInputError) return { error: t("invalid") };
    throw error;
  }
  revalidatePath("/parametres/automatisations");
  revalidatePath("/parametres/radar");
  revalidatePath("/");
  return { success: true };
}

export async function saveAutomationDaysAction(_prev: AutomationFormState, formData: FormData): Promise<AutomationFormState> {
  const auth = await requireOwner();
  const t = await getTranslations("Automations");
  if (!auth) return { error: t("ownerOnly") };
  try {
    await setAutomationDays(auth.user.organizationId, String(formData.get("key") ?? ""), Number(formData.get("days")));
  } catch (error) {
    if (error instanceof AutomationInputError) return { error: t("invalid") };
    throw error;
  }
  revalidatePath("/parametres/automatisations");
  return { success: true };
}

// Lot 66a (HUB-28 ; D1 ; ADR 0112) : l'heure d'envoi par défaut de l'organisation, et celle d'un
// automatisme (vide : revenir à l'heure par défaut). Les tâches périodiques la relisent aussitôt.
export async function saveDefaultSendTimeAction(_prev: AutomationFormState, formData: FormData): Promise<AutomationFormState> {
  const auth = await requireOwner();
  const t = await getTranslations("Automations");
  if (!auth) return { error: t("ownerOnly") };
  try {
    await setDefaultSendTime(auth.user.organizationId, String(formData.get("time") ?? ""));
  } catch (error) {
    if (error instanceof AutomationInputError) return { error: t("invalidTime") };
    throw error;
  }
  forgetSendTimes(auth.user.organizationId);
  revalidatePath("/parametres/automatisations");
  return { success: true };
}

export async function saveAutomationSendTimeAction(_prev: AutomationFormState, formData: FormData): Promise<AutomationFormState> {
  const auth = await requireOwner();
  const t = await getTranslations("Automations");
  if (!auth) return { error: t("ownerOnly") };
  const time = String(formData.get("time") ?? "");
  try {
    await setAutomationSendTime(auth.user.organizationId, String(formData.get("key") ?? ""), time === "" ? null : time);
  } catch (error) {
    if (error instanceof AutomationInputError) return { error: t("invalidTime") };
    throw error;
  }
  forgetSendTimes(auth.user.organizationId);
  revalidatePath("/parametres/automatisations");
  return { success: true };
}
