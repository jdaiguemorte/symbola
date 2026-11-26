"use server";

import { cookies } from "next/headers";
import { appDatabase } from "@symbola/db/client";
import { getUserNames, PersonNamesInvalidError, setUserLanguage, setUserNames } from "@symbola/auth";
import { revalidatePath } from "next/cache";
import { NAMES_PROMPT_COOKIE } from "./names-prompt-cookie";
import { getAuthContext } from "@/lib/auth-context";
import { LOCALE_COOKIE } from "../../middleware";

export type ProfileFormState = { success?: boolean };

export async function setLanguageAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return {};

  const language = formData.get("language") === "en" ? "en" : "fr";

  const db = appDatabase();
  await setUserLanguage(db, auth.user.id, language);

  (await cookies()).set(LOCALE_COOKIE, language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  return { success: true };
}

// Lot 70a (CHR-02 ; A1, D7 de la porte 2) — prénom ou nom, chacun enregistré seul (réglage isolé :
// « Enregistré » à côté du champ). La personne ne règle que les siens ; un compte d'exploitation n'en a pas.
export type NameFieldState = { saved?: boolean; error?: boolean; nonce?: number };

export async function saveNameFieldAction(_prev: NameFieldState, formData: FormData): Promise<NameFieldState> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || auth.user.role === "admin") return { error: true };
  const field = formData.get("field");
  if (field !== "firstName" && field !== "lastName") return { error: true };
  const value = String(formData.get("value") ?? "");
  const db = appDatabase();
  const current = await getUserNames(db, auth.user.id);
  try {
    await setUserNames(db, auth.user.id, { firstName: current.firstName ?? "", lastName: current.lastName ?? "", [field]: value });
  } catch (error) {
    if (error instanceof PersonNamesInvalidError) return { error: true, nonce: Date.now() };
    throw error;
  }
  revalidatePath("/", "layout");
  return { saved: true, nonce: Date.now() };
}

// La ligne « Indiquez votre prénom » de l'accueil, fermée par la personne (sur cet appareil).
export async function dismissNamesPromptAction(): Promise<void> {
  (await cookies()).set(NAMES_PROMPT_COOKIE, "ferme", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  revalidatePath("/");
}
