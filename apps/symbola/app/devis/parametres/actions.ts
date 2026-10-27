"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { updateQuoteSettings } from "@/modules/quotes/service";
import { authorizedPlanner } from "../planner-access";

export type QuoteSettingsFormState = { error?: string; success?: boolean };

// DEV-01 — validité par défaut et préfixes des séries (CLAUDE.md §2.5 :
// formats de numérotation paramétrables par organisation).
export async function updateQuoteSettingsAction(
  _prevState: QuoteSettingsFormState,
  formData: FormData,
): Promise<QuoteSettingsFormState> {
  const t = await getTranslations("Quotes");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };

  const validityText = String(formData.get("validityDays") ?? "").trim();
  const validityDays = /^\d{1,3}$/.test(validityText) ? Number(validityText) : NaN;
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 365) return { error: t("invalidValidity") };

  const prefix = (name: string) => String(formData.get(name) ?? "").trim().toUpperCase();
  try {
    await updateQuoteSettings(planner.organizationId, {
      validityDays,
      quotePrefix: prefix("quotePrefix"),
      invoicePrefix: prefix("invoicePrefix"),
      creditNotePrefix: prefix("creditNotePrefix"),
    });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("invalidPrefix") };
    throw error;
  }
  revalidatePath("/devis/parametres");
  return { success: true };
}
