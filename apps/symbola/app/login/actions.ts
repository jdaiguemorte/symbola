"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { login } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { getTrustedDeviceToken, setSessionCookie } from "@/lib/auth-context";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";

export type LoginFormState = { error?: string };

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // SEC-02 (ADR 0044) : par adresse et par compte, avant tout contrôle du mot de passe.
  const limited = await checkRateLimit("login", { account: email });
  if (!limited.allowed) return { error: await rateLimitMessage(limited.retryAfterSeconds) };

  // SEC-03 : un appareil de confiance de ce compte dispense du code.
  const trustedDeviceToken = await getTrustedDeviceToken();
  const db = appDatabase();
  const result = await login(db, email, password, { trustedDeviceToken });

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
