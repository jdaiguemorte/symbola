"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { login } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { getTrustedDeviceToken, setSessionCookie } from "@/lib/auth-context";

export type LoginFormState = { error?: string };

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // SEC-03 : un appareil de confiance de ce compte dispense du code.
  const trustedDeviceToken = await getTrustedDeviceToken();
  const { sql, db } = createAppConnection();
  let result;
  try {
    result = await login(db, email, password, { trustedDeviceToken });
  } finally {
    await sql.end();
  }

  if (result.outcome === "invalid_credentials") {
    const t = await getTranslations("Login");
    return { error: t("invalidCredentials") };
  }

  if (result.outcome === "locked") {
    const t = await getTranslations("Login");
    return { error: t("locked") };
  }

  await setSessionCookie(result.sessionToken);
  redirect(result.requiresMfa ? "/mfa" : "/");
}
