"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createAppConnection } from "@symbola/db/client";
import { PrivacyRequestInvalidError, updatePrivacySettings } from "@/modules/hub/service";
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
});

export async function savePrivacySettingsAction(_prevState: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const t = await getTranslations("Privacy");
  const owner = await ownerContext();
  if (!owner) return { error: t("ownerOnly") };
  const parsed = settingsSchema.safeParse(Object.fromEntries(Object.keys(settingsSchema.shape).map((key) => [key, formData.get(key)])));
  if (!parsed.success) return { error: t("settingsInvalid") };
  const { sql, db } = createAppConnection();
  try {
    await updatePrivacySettings(db, owner.organizationId, parsed.data);
  } catch (error) {
    if (error instanceof PrivacyRequestInvalidError) return { error: t("settingsInvalid") };
    throw error;
  } finally {
    await sql.end();
  }
  revalidatePath("/rgpd/reglages");
  return { success: true };
}
