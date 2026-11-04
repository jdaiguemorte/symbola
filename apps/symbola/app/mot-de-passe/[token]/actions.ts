"use server";

import { getTranslations } from "next-intl/server";
import { resetPassword } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";

export type ResetPasswordFormState = { done?: boolean; error?: string };

export async function resetPasswordAction(_prevState: ResetPasswordFormState, formData: FormData): Promise<ResetPasswordFormState> {
  const t = await getTranslations("PasswordReset");
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmation") ?? "")) return { error: t("mismatch") };

  const { sql, db } = createAppConnection();
  let outcome;
  try {
    outcome = await resetPassword(db, { token, password });
  } finally {
    await sql.end();
  }
  if (outcome === "password_too_short") return { error: t("tooShort") };
  if (outcome === "invalid_or_expired") return { error: t("invalidOrExpired") };
  return { done: true };
}
