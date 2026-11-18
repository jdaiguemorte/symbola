"use server";

// Lot 43 (FAC-09, FAC-15 ; D1, D7) — réglages des relances : jours avant l'expiration d'une proposition,
// jours après une échéance impayée, taux de la clause de pénalités d'un particulier (vide : aucune).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { ReminderSettingsInvalidError, updateReminderSettings } from "@/modules/quotes/service";
import { parseDecimal } from "../decimal-input";
import { authorizedPlanner } from "../planner-access";

export type ReminderSettingsState = { error?: string; success?: boolean };

export async function saveReminderSettingsAction(_prev: ReminderSettingsState, formData: FormData): Promise<ReminderSettingsState> {
  const t = await getTranslations("ReminderSettings");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("errorUnauthenticated") };
  const days = String(formData.get("paymentReminderDays") ?? "")
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);
  const rateText = String(formData.get("consumerRate") ?? "").trim();
  const rate = rateText === "" ? null : parseDecimal(rateText, 2);
  if (rateText !== "" && rate === null) return { error: t("errorRate") };
  try {
    await updateReminderSettings(planner.organizationId, { expiryReminderDays: Number(formData.get("expiryReminderDays")), paymentReminderDays: days, consumerLatePenaltyBasisPoints: rate });
  } catch (error) {
    if (error instanceof ReminderSettingsInvalidError) return { error: t(`errors.${error.field}`) };
    throw error;
  }
  revalidatePath("/devis/relances");
  return { success: true };
}
