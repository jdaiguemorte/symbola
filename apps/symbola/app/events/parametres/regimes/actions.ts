"use server";

// Lot 49 (INV-07, RGP-06 ; D6) — liste fermée des régimes et allergies de l'organisation : masquer
// ou montrer une entrée, en ajouter une (libellé court). L'invité ne fait que cocher.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { addDietaryOption, GuestSettingsInvalidError, setDietaryOptionHidden } from "@/modules/guests/service";
import { guestsAccess } from "@/app/events/[id]/invites/access";
import { isValidId } from "../../module-access";

export type DietaryOptionState = { error?: string; success?: boolean };

export async function addDietaryOptionAction(_prev: DietaryOptionState, formData: FormData): Promise<DietaryOptionState> {
  const t = await getTranslations("Guests.errors");
  const access = await guestsAccess();
  if (!access) return { error: t("denied") };
  const kind = formData.get("kind") === "allergen" ? "allergen" : "diet";
  try {
    await addDietaryOption(access.organizationId, { kind, label: String(formData.get("label") ?? "") }, (await getLocale()) === "en" ? "en" : "fr");
  } catch (error) {
    if (error instanceof GuestSettingsInvalidError) return { error: t("settings.option_label") };
    throw error;
  }
  revalidatePath("/events/parametres/regimes");
  return { success: true };
}

export async function toggleDietaryOptionAction(formData: FormData): Promise<void> {
  const access = await guestsAccess();
  const optionId = String(formData.get("optionId") ?? "");
  if (!access || !isValidId(optionId)) return;
  await setDietaryOptionHidden(access.organizationId, optionId, formData.get("hidden") === "true");
  revalidatePath("/events/parametres/regimes");
}
