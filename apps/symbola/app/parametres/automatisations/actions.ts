"use server";

// Lot 53 (HUB-28 ; D5) — activer, couper ou régler un automatisme : la Propriétaire seule (réglage de
// l'organisation). Couper arrête les envois à venir ; à la remise en route, rien n'est rattrapé.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { AutomationInputError, setAutomationDays, setAutomationEnabled } from "@/modules/hub/service";
import { requireOwner } from "@/lib/guards";

export type AutomationFormState = { error?: string; success?: boolean };

export async function toggleAutomationAction(formData: FormData): Promise<void> {
  const auth = await requireOwner();
  if (!auth) return;
  try {
    await setAutomationEnabled(auth.user.organizationId, String(formData.get("key") ?? ""), formData.get("enabled") === "true");
  } catch (error) {
    if (!(error instanceof AutomationInputError)) throw error;
  }
  revalidatePath("/parametres/automatisations");
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
