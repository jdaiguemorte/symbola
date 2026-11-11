"use server";

import { getTranslations } from "next-intl/server";
import { resetPassword } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";

export type ResetPasswordFormState = { done?: boolean; error?: string };

export async function resetPasswordAction(_prevState: ResetPasswordFormState, formData: FormData): Promise<ResetPasswordFormState> {
  const t = await getTranslations("PasswordReset");
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmation") ?? "")) return { error: t("mismatch") };

  const db = appDatabase();
  const outcome = await resetPassword(db, { token, password });
  if (outcome === "password_too_short") return { error: t("tooShort") };
  // Lot 24b (SEC-03) : mot de passe connu comme compromis.
  if (outcome === "password_compromised") return { error: t("compromised") };
  if (outcome === "invalid_or_expired") return { error: t("invalidOrExpired") };
  return { done: true };
}
