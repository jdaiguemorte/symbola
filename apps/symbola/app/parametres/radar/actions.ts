"use server";

// Lot 53 (GC-02, CHR-05 ; D7) — règles et seuils du radar des risques, seuils de la santé du planning :
// réglages de l'organisation, par la Propriétaire. Toute entrée est validée par le module (Zod).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { AutomationInputError, setAutomationEnabled, setRiskRule } from "@/modules/hub/service";
import { PlanningInputError, setPlanningHealthThresholds } from "@/modules/events/service";
import { requireOwner } from "@/lib/guards";

export type RadarFormState = { error?: string; success?: boolean };

export async function saveRiskRuleAction(_prev: RadarFormState, formData: FormData): Promise<RadarFormState> {
  const auth = await requireOwner();
  const t = await getTranslations("RiskRadar");
  if (!auth) return { error: t("settings.ownerOnly") };
  try {
    await setRiskRule(auth.user.organizationId, { rule: String(formData.get("rule") ?? ""), enabled: formData.get("enabled") === "on", thresholdDays: Number(formData.get("thresholdDays")) });
  } catch (error) {
    if (error instanceof AutomationInputError) return { error: t("settings.invalid") };
    throw error;
  }
  revalidatePath("/parametres/radar");
  revalidatePath("/");
  return { success: true };
}

export async function saveHealthThresholdsAction(_prev: RadarFormState, formData: FormData): Promise<RadarFormState> {
  const auth = await requireOwner();
  const t = await getTranslations("RiskRadar");
  if (!auth) return { error: t("settings.ownerOnly") };
  try {
    await setPlanningHealthThresholds(auth.user.organizationId, { watchPoints: Number(formData.get("watchPoints")), latePoints: Number(formData.get("latePoints")), milestoneWeight: Number(formData.get("milestoneWeight")) });
  } catch (error) {
    if (error instanceof PlanningInputError) return { error: t("health.invalid") };
    throw error;
  }
  revalidatePath("/parametres/radar");
  return { success: true };
}

// Lot 74h (G10, A6) : « Remettre le radar en marche », en tête de ses règles quand il est coupé. La
// titulaire seule ; la date et l'auteur de la coupure s'effacent (0246).
export async function resumeRiskRadarAction(): Promise<void> {
  const auth = await requireOwner();
  if (!auth) return;
  await setAutomationEnabled(auth.user.organizationId, "risk_radar", true, new Date(), auth.user.id);
  revalidatePath("/parametres/radar");
  revalidatePath("/parametres/automatisations");
  revalidatePath("/");
}
