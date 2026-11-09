"use server";

// Lot 17 (DEV-09 à DEV-11) — enregistrement de l'apparence, des textes et du
// paiement des documents. Session planner, organisation et module vérifiés
// côté serveur ; validation dans le module (InvalidDocumentSettingsError).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { InvalidDocumentSettingsError, updateDocumentSettings } from "@/modules/quotes/service";
import { authorizedPlanner } from "../../planner-access";

export type DocumentSettingsFormState = { error?: string; success?: boolean };

const ERROR_KEYS = {
  color: "errorColor",
  font: "errorFont",
  iban: "errorIban",
  bic: "errorBic",
  quoteIntro: "errorTooLong",
  quoteTerms: "errorTooLong",
  invoiceIntro: "errorTooLong",
  invoiceTerms: "errorTooLong",
  footer: "errorTooLong",
} as const;

export async function updateDocumentSettingsAction(_previous: DocumentSettingsFormState, formData: FormData): Promise<DocumentSettingsFormState> {
  const t = await getTranslations("Documents");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };

  const text = (name: string) => String(formData.get(name) ?? "");
  const choice = text("colorChoice");
  const font = text("font") === "classic" ? "classic" : text("font") === "modern" ? "modern" : null;
  if (!font) return { error: t("errorFont") };
  try {
    await updateDocumentSettings(planner.organizationId, {
      color: choice === "custom" ? text("customColor") : choice || null,
      font,
      iban: text("iban"),
      bic: text("bic"),
      quoteIntro: text("quoteIntro"),
      quoteTerms: text("quoteTerms"),
      invoiceIntro: text("invoiceIntro"),
      invoiceTerms: text("invoiceTerms"),
      footer: text("footer"),
    });
  } catch (error) {
    if (error instanceof InvalidDocumentSettingsError) return { error: t(ERROR_KEYS[error.field]) };
    throw error;
  }
  revalidatePath("/devis/parametres/documents");
  return { success: true };
}
