"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import {
  changeVatRegime,
  completeOnboarding,
  saveFollowUpDelays,
  saveOnboardingStep,
  type LegalForm,
  type Metier,
  type VatRegime,
} from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";

async function requireOrganization() {
  const auth = await requirePlanner();
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

export type ProfileFormState = { success?: boolean };

export async function saveProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { organizationId } = await requireOrganization();

  const siren = String(formData.get("siren") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const legalForm = (String(formData.get("legalForm") ?? "").trim() || null) as LegalForm | null;
  const metier = (String(formData.get("metier") ?? "").trim() || null) as Metier | null;
  const metierPrecision = String(formData.get("metierPrecision") ?? "").trim() || null;

  const db = appDatabase();
  await saveOnboardingStep(db, organizationId, { siren, address, legalForm, metier, metierPrecision });
  // ONB-01 : se termine tout seul dès que les champs requis sont
  // réunis — pas de bouton « terminer » à part, cohérent avec un
  // questionnaire qu'on peut interrompre et reprendre par morceaux.
  await completeOnboarding(db, organizationId);

  revalidatePath("/parametres");
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

  revalidatePath("/parametres");
  return { success: true };
}

// Lot 13 (HUB-15) — délais de relance (titulaire et membres de l'équipe).
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
