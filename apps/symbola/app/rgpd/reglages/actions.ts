"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { appDatabase } from "@symbola/db/client";
import { isModuleEnabled, PrivacyRequestInvalidError, updateLinkPrivacyNotice, updatePrivacySettings } from "@/modules/hub/service";
import { GuestSettingsInvalidError, updateGuestPrivacyNotice } from "@/modules/guests/service";
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
  // Lot 49 (RGP-08, D9) : purge des invités, en jours ; bornée par la DPO (contrôle du service).
  guestRetentionDays: positive,
  guestDietRetentionDays: positive,
  guestPurgeMaxPostponeDays: positive,
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
    if (error instanceof PrivacyRequestInvalidError) {
      return { error: t(error.code === "signed_quote_retention_too_short" ? "signedQuoteRetentionTooShort" : error.code === "guest_retention_too_long" ? "guestRetentionTooLong" : "settingsInvalid") };
    }
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

// Lot 49 (RGP-03, article 14) : mention d'information de la page de réponse des invités, au nom de
// l'organisation et des mariés ; vide ou « Revenir au texte de départ » : le texte de départ.
export async function saveGuestNoticeAction(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };
  if (!(await isModuleEnabled(appDatabase(), owner.organizationId, "guests"))) return { error: t("settingsInvalid") };
  const reset = formData.get("intent") === "reset";
  const notice = reset ? null : String(formData.get("notice") ?? "");
  try {
    await updateGuestPrivacyNotice(owner.organizationId, notice);
  } catch (error) {
    if (error instanceof GuestSettingsInvalidError) return { error: t("settingsInvalid") };
    throw error;
  }
  revalidatePath("/rgpd/reglages");
  return { success: true };
}
