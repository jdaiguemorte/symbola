"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { starterPaymentMethods } from "@symbola/starter-templates";
import { addPaymentMethods, archivePaymentMethod, updateQuoteSettings } from "@/modules/quotes/service";
import { isValidId } from "../module-access";
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

  const horizonText = String(formData.get("upcomingHorizonDays") ?? "").trim();
  const upcomingHorizonDays = /^\d{1,3}$/.test(horizonText) ? Number(horizonText) : NaN;
  if (!Number.isInteger(upcomingHorizonDays) || upcomingHorizonDays < 1 || upcomingHorizonDays > 730) {
    return { error: t("invalidHorizon") };
  }

  const termText = String(formData.get("invoicePaymentTermDays") ?? "").trim();
  const invoicePaymentTermDays = /^\d{1,3}$/.test(termText) ? Number(termText) : NaN;
  if (!Number.isInteger(invoicePaymentTermDays) || invoicePaymentTermDays > 120) return { error: t("invalidPaymentTerm") };
  const invoiceMentions = String(formData.get("invoiceMentions") ?? "").trim() || null;

  const prefix = (name: string) => String(formData.get(name) ?? "").trim().toUpperCase();
  try {
    await updateQuoteSettings(planner.organizationId, {
      validityDays,
      quotePrefix: prefix("quotePrefix"),
      invoicePrefix: prefix("invoicePrefix"),
      creditNotePrefix: prefix("creditNotePrefix"),
      upcomingHorizonDays,
      invoicePaymentTermDays,
      invoiceMentions,
    });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("invalidPrefix") };
    throw error;
  }
  revalidatePath("/devis/parametres");
  return { success: true };
}

// DEV-03 — modes de paiement : saisie libre, modèle de départ (fichier de
// données traduisible), archivage.
export async function addPaymentMethodAction(
  _prevState: QuoteSettingsFormState,
  formData: FormData,
): Promise<QuoteSettingsFormState> {
  const t = await getTranslations("Quotes");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: t("missingPaymentMethod") };
  await addPaymentMethods(planner.organizationId, [label]);
  revalidatePath("/devis/parametres");
  return { success: true };
}

export async function loadStarterPaymentMethodsAction(
  _prevState: QuoteSettingsFormState,
  _formData: FormData,
): Promise<QuoteSettingsFormState> {
  const t = await getTranslations("Quotes");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  await addPaymentMethods(planner.organizationId, starterPaymentMethods(locale));
  revalidatePath("/devis/parametres");
  return { success: true };
}

export async function archivePaymentMethodAction(formData: FormData): Promise<void> {
  const planner = await authorizedPlanner();
  if (!planner) return;
  const paymentMethodId = String(formData.get("paymentMethodId") ?? "");
  if (!isValidId(paymentMethodId)) return;
  await archivePaymentMethod(planner.organizationId, paymentMethodId);
  revalidatePath("/devis/parametres");
}
