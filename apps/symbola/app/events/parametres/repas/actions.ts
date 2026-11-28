"use server";

// Lot 50 (INV-06 ; D5) — types de repas de l'organisation : renommer (vide : le libellé de départ),
// masquer ou afficher, ajouter. La titulaire et les membres de l'équipe (guestsAccess).
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { addMealType, renameMealType, SeatingInvalidError, setMealTypeHidden } from "@/modules/guests/service";
import { guestsAccess } from "@/app/events/[id]/invites/access";
import { guestErrorKey } from "@/app/events/[id]/invites/form-schemas";

export type MealTypeState = { error?: string; success?: string };

const PATH = "/events/parametres/regimes";

async function failure(error: unknown): Promise<MealTypeState> {
  const key = guestErrorKey(error);
  if (!key) throw error;
  const t = await getTranslations("Guests.errors");
  return { error: t.has(key) ? t(key) : t("generic") };
}

export async function addMealTypeAction(_prev: MealTypeState, formData: FormData): Promise<MealTypeState> {
  const access = await guestsAccess();
  const t = await getTranslations("Guests.errors");
  if (!access) return { error: t("denied") };
  try {
    await addMealType(access.organizationId, String(formData.get("label") ?? ""), (await getLocale()) === "en" ? "en" : "fr");
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PATH);
  return { success: (await getTranslations("Guests.mealTypes"))("added") };
}

export async function renameMealTypeAction(_prev: MealTypeState, formData: FormData): Promise<MealTypeState> {
  const access = await guestsAccess();
  const t = await getTranslations("Guests.errors");
  if (!access) return { error: t("denied") };
  const parsed = z.object({ mealTypeId: z.uuid(), label: z.string().max(200) }).safeParse({ mealTypeId: formData.get("mealTypeId"), label: String(formData.get("label") ?? "") });
  if (!parsed.success) return failure(new SeatingInvalidError("meal_label"));
  try {
    await renameMealType(access.organizationId, parsed.data.mealTypeId, formData.get("reset") === "1" ? null : parsed.data.label);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(PATH);
  return { success: (await getTranslations("Guests.mealTypes"))("saved") };
}

export async function toggleMealTypeAction(formData: FormData): Promise<MealTypeState> {
  const access = await guestsAccess();
  const parsed = z.object({ mealTypeId: z.uuid() }).safeParse({ mealTypeId: formData.get("mealTypeId") });
  if (!access || !parsed.success) return { error: (await getTranslations("Guests.errors"))("denied") };
  await setMealTypeHidden(access.organizationId, parsed.data.mealTypeId, formData.get("hidden") === "true");
  revalidatePath(PATH);
  return {};
}
