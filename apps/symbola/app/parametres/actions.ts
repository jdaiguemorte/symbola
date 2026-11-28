"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { parseAmountToCents } from "@symbola/i18n";
import {
  InvalidSellerAddressError,
  InvalidAnnualEventVolumeError,
  saveVatOnDebits,
  VatOnDebitsNotApplicableError,
  changeVatRegime,
  completeOnboarding,
  InvalidDocumentDetailsError,
  InvalidProfessionalMentionError,
  saveCompanySheet,
  saveProfessionalMentions,
  saveFollowUpDelays,
  type LegalForm,
  type Metier,
  type VatRegime,
} from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";

async function requireOrganization() {
  const auth = await requirePlanner();
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

// Lot 62b (UX-12) — la fiche de l'entreprise, enregistrée d'un seul geste : identité (ONB-01),
// adresse (FAC-10, D7) et coordonnées imprimées sur les devis et factures (DEV-07). Le hub contrôle
// tout avant d'écrire : une fiche refusée n'enregistre rien, et l'erreur nomme le champ.
// values : ce qui a été saisi, rendu au formulaire quand la fiche est refusée (rien n'est perdu).
export type CompanySheetFormState = { success?: boolean; error?: string; values?: Record<string, string> };

const DETAIL_ERROR_KEYS = {
  siret: "errorSiret",
  contactEmail: "errorContactEmail",
  contactPhone: "errorContactPhone",
  website: "errorWebsite",
  vatNumber: "errorVatNumber",
  registration: "errorRegistration",
  shareCapitalCents: "errorShareCapital",
} as const;

export async function saveCompanySheetAction(_prevState: CompanySheetFormState, formData: FormData): Promise<CompanySheetFormState> {
  const t = await getTranslations("Settings");
  const { organizationId } = await requireOrganization();
  const text = (name: string) => String(formData.get(name) ?? "").trim() || null;
  const values = Object.fromEntries([...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string" && !entry[0].startsWith("$")));
  const capital = parseAmountToCents(String(formData.get("shareCapital") ?? ""));
  if (capital === undefined) return { error: t("errorShareCapital"), values };

  const db = appDatabase();
  try {
    await saveCompanySheet(db, organizationId, {
      siren: text("siren"),
      legalForm: text("legalForm") as LegalForm | null,
      metier: text("metier") as Metier | null,
      metierPrecision: text("metierPrecision"),
      // Lot 74h (G15) : « Mariages par an » ; absent du formulaire, la valeur reste.
      ...(formData.has("annualEventVolume") ? { annualEventVolume: text("annualEventVolume") } : {}),
      address: {
        address: String(formData.get("address") ?? ""),
        postalCode: String(formData.get("postalCode") ?? ""),
        city: String(formData.get("city") ?? ""),
        countryCode: String(formData.get("countryCode") ?? ""),
      },
      details: {
        siret: text("siret"),
        contactEmail: text("contactEmail"),
        contactPhone: text("contactPhone"),
        website: text("website"),
        vatNumber: text("vatNumber"),
        registration: text("registration"),
        shareCapitalCents: capital,
      },
    });
  } catch (error) {
    if (error instanceof InvalidSellerAddressError) return { error: t(`invalidAddress_${error.field}`), values };
    if (error instanceof InvalidAnnualEventVolumeError) return { error: (await getTranslations("SettingsPattern"))("saved.failed"), values };
    if (error instanceof InvalidDocumentDetailsError) return { error: t(DETAIL_ERROR_KEYS[error.field]), values };
    throw error;
  }
  // ONB-01 : se termine tout seul dès que les champs requis sont
  // réunis — pas de bouton « terminer » à part, cohérent avec un
  // questionnaire qu'on peut interrompre et reprendre par morceaux.
  await completeOnboarding(db, organizationId);

  // Lot 74g : « Entreprise et TVA » est devenu deux rubriques.
  revalidatePath("/parametres/entreprise");
  revalidatePath("/parametres/mentions");
  revalidatePath("/devis/parametres/documents");
  return { success: true };
}

export type VatRegimeFormState = { success?: boolean; error?: string };

export async function changeVatRegimeAction(
  _prevState: VatRegimeFormState,
  formData: FormData,
): Promise<VatRegimeFormState> {
  const { organizationId, userId } = await requireOrganization();

  const newRegime = formData.get("newRegime") === "assujetti" ? "assujetti" : ("franchise" as VatRegime);
  const effectiveDate = String(formData.get("effectiveDate") ?? "");

  if (!effectiveDate) {
    const t = await getTranslations("Settings");
    return { error: t("missingEffectiveDate") };
  }

  const db = appDatabase();
  await changeVatRegime(db, { organizationId, userId, newRegime, effectiveDate });
  await completeOnboarding(db, organizationId);

  // Lot 74g : « Entreprise et TVA » est devenu deux rubriques.
  revalidatePath("/parametres/entreprise");
  revalidatePath("/parametres/mentions");
  return { success: true };
}

// Lot 13 (L13-HUB-15) — délais de relance (titulaire et membres de l'équipe).
export type FollowUpFormState = { error?: string; success?: boolean };

export async function saveFollowUpDelaysAction(_prev: FollowUpFormState, formData: FormData): Promise<FollowUpFormState> {
  const t = await getTranslations("Settings");
  const { organizationId } = await requireOrganization();
  const quoteFollowUpDays = Number(formData.get("quoteFollowUpDays"));
  const prospectFollowUpDays = Number(formData.get("prospectFollowUpDays"));
  const db = appDatabase();
  try {
    await saveFollowUpDelays(db, organizationId, { quoteFollowUpDays, prospectFollowUpDays });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("followUpDelaysInvalid") };
    throw error;
  }
  revalidatePath("/");
  revalidatePath("/parametres/relances");
  return { success: true };
}

// Lot 31a (JUR-09, décision D4) — informations du professionnel reprises sur les devis :
// assurance de responsabilité civile professionnelle, médiateur de la consommation,
// conditions générales de vente.
export type ProfessionalMentionsFormState = { error?: string; success?: boolean };

const PROFESSIONAL_ERROR_KEYS = {
  insurer: "errorInsurer",
  insurancePolicy: "errorInsurancePolicy",
  insuranceCoverage: "errorInsuranceCoverage",
  mediatorName: "errorMediatorName",
  mediatorUrl: "errorMediatorUrl",
  generalTerms: "errorGeneralTerms",
} as const;

export async function saveProfessionalMentionsAction(_prev: ProfessionalMentionsFormState, formData: FormData): Promise<ProfessionalMentionsFormState> {
  const t = await getTranslations("Settings");
  const { organizationId } = await requireOrganization();
  const text = (name: string) => String(formData.get(name) ?? "") || null;
  try {
    await saveProfessionalMentions(appDatabase(), organizationId, {
      insurer: text("insurer"),
      insurancePolicy: text("insurancePolicy"),
      insuranceCoverage: text("insuranceCoverage"),
      mediatorName: text("mediatorName"),
      mediatorUrl: text("mediatorUrl"),
      generalTerms: text("generalTerms"),
    });
  } catch (error) {
    if (error instanceof InvalidProfessionalMentionError) return { error: t(PROFESSIONAL_ERROR_KEYS[error.field]) };
    throw error;
  }
  // Lot 74g : « Entreprise et TVA » est devenu deux rubriques.
  revalidatePath("/parametres/entreprise");
  revalidatePath("/parametres/mentions");
  return { success: true };
}

// Lot 41 (JUR-02, D10) — option pour le paiement de la TVA d'après les débits, datée, réservée au
// régime assujetti ; chaque facture la fige à sa date d'émission.
export type VatOnDebitsFormState = { error?: string; success?: boolean };

export async function saveVatOnDebitsAction(_prev: VatOnDebitsFormState, formData: FormData): Promise<VatOnDebitsFormState> {
  const t = await getTranslations("Settings");
  const { organizationId } = await requireOrganization();
  const choice = String(formData.get("vatOnDebits") ?? "");
  if (choice !== "yes" && choice !== "no") return { error: t("vatOnDebitsChoose") };
  const from = String(formData.get("vatOnDebitsFrom") ?? "").trim() || null;
  if (choice === "yes" && !from) return { error: t("missingEffectiveDate") };
  try {
    await saveVatOnDebits(appDatabase(), organizationId, { enabled: choice === "yes", from });
  } catch (error) {
    if (error instanceof VatOnDebitsNotApplicableError) return { error: t("vatOnDebitsFranchise") };
    if (error instanceof RangeError) return { error: t("missingEffectiveDate") };
    throw error;
  }
  // Lot 74g : « Entreprise et TVA » est devenu deux rubriques.
  revalidatePath("/parametres/entreprise");
  revalidatePath("/parametres/mentions");
  return { success: true };
}
