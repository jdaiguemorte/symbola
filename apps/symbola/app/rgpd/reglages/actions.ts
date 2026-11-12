"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { PrivacyRequestInvalidError, updateLinkPrivacyNotice, updatePrivacySettings } from "@/modules/hub/service";
import { ownerContext } from "../owner-access";

export type SettingsFormState = { error?: string; success?: boolean };

const positive = z.coerce.number().int().min(1).max(1200);
const settingsSchema = z.object({
  requestAlertDays: positive,
  prospectRetentionMonths: positive,
  clientRetentionMonths: positive,
  accountingRetentionMonths: positive,
  inactiveAccountMonths: positive,
  signedQuoteRetentionMonths: positive,
  // RGPD-09 : preuve d'une demande close (nom de la personne).
  requestProofRetentionMonths: positive,
});

export async function savePrivacySettingsAction(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };
  const parsed = settingsSchema.safeParse(Object.fromEntries(Object.keys(settingsSchema.shape).map((key) => [key, formData.get(key)])));
  if (!parsed.success) return { error: t("settingsInvalid") };
  const db = appDatabase();
  try {
    await updatePrivacySettings(db, owner.organizationId, parsed.data);
  } catch (error) {
    if (error instanceof PrivacyRequestInvalidError) return { error: t("settingsInvalid") };
    throw error;
  }
  revalidatePath("/rgpd/reglages");
  return { success: true };
}

// Lot 26a (RGP-03) : la titulaire adapte la mention d'information des pages à
// lien personnel, ou revient au texte de départ.
export async function saveLinkNoticeAction(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };
  const notice = formData.get("intent") === "reset" ? null : String(formData.get("notice") ?? "");
  try {
    await updateLinkPrivacyNotice(appDatabase(), owner.organizationId, notice);
  } catch (error) {
    if (error instanceof PrivacyRequestInvalidError) return { error: t("linkNoticeInvalid") };
    throw error;
  }
  revalidatePath("/rgpd/reglages");
  return { success: true };
}
