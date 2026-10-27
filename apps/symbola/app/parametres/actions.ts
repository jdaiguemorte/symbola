"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import {
  changeVatRegime,
  completeOnboarding,
  saveOnboardingStep,
  type LegalForm,
  type Metier,
  type VatRegime,
} from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";

async function requireOrganization() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
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

  const { sql, db } = createAppConnection();
  try {
    await saveOnboardingStep(db, organizationId, { siren, address, legalForm, metier, metierPrecision });
    // ONB-01 : se termine tout seul dès que les champs requis sont
    // réunis — pas de bouton « terminer » à part, cohérent avec un
    // questionnaire qu'on peut interrompre et reprendre par morceaux.
    await completeOnboarding(db, organizationId);
  } finally {
    await sql.end();
  }

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

  const { sql, db } = createAppConnection();
  try {
    await changeVatRegime(db, { organizationId, userId, newRegime, effectiveDate });
    await completeOnboarding(db, organizationId);
  } finally {
    await sql.end();
  }

  revalidatePath("/parametres");
  return { success: true };
}
