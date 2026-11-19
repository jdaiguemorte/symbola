"use server";

// Lot 58 (FAC-11 ; ADR 0097) — réglage de l'exercice et du plan de comptes : une Planner ou la
// Propriétaire, jamais le Comptable (lecture seule, lot 52). Contrôle côté serveur.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { ACCOUNT_KEYS, JOURNAL_KEYS } from "@symbola/starter-templates";
import { AccountingSettingsError, saveAccountingSettings } from "@/modules/quotes/service";
import { authorizedPlanner } from "../planner-access";

export type AccountingSettingsState = { error?: string; success?: boolean };

export async function saveAccountingSettingsAction(_state: AccountingSettingsState, formData: FormData): Promise<AccountingSettingsState> {
  const t = await getTranslations("AccountingExports");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("errors.unauthenticated") };
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const text = (name: string) => String(formData.get(name) ?? "");
  try {
    await saveAccountingSettings(
      planner.organizationId,
      {
        fiscalYearStartMonth: Number(text("fiscalYearStartMonth")),
        accounts: Object.fromEntries(ACCOUNT_KEYS.map((key) => [key, { number: text(`account.${key}`), label: text(`accountLabel.${key}`) }])),
        journals: Object.fromEntries(JOURNAL_KEYS.map((key) => [key, { code: text(`journal.${key}`), label: text(`journalLabel.${key}`) }])),
      },
      locale,
    );
  } catch (error) {
    if (error instanceof AccountingSettingsError) return { error: t(`errors.${error.field}`) };
    throw error;
  }
  revalidatePath("/devis/exports-comptables");
  return { success: true };
}
