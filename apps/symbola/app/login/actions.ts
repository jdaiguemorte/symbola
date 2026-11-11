"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { login } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { getTrustedDeviceToken, setSessionCookie } from "@/lib/auth-context";
import { checkFailures, checkRateLimit, clearAccountFailures, longestWait, rateLimitMessage, recordFailure, requestClientIp } from "@/lib/rate-limit";

export type LoginFormState = { error?: string };

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // L16-SEC-02 (ADR 0044) : par adresse et par compte, avant tout contrôle du mot
  // de passe. Lot 24b (SEC-04) : après dix échecs, un délai qui double à chaque
  // nouvel échec. Le message donne le plus long des deux délais.
  const backoff = await checkFailures("login", { account: email });
  const limited = await checkRateLimit("login", { account: email });
  const wait = longestWait(backoff, limited);
  if (wait !== null) return { error: await rateLimitMessage(wait) };

  // L16-SEC-03 : un appareil de confiance de ce compte dispense du code.
  const trustedDeviceToken = await getTrustedDeviceToken();
  const db = appDatabase();
  const result = await login(db, email, password, { trustedDeviceToken, clientIp: await requestClientIp() });

  if (result.outcome === "invalid_credentials" || result.outcome === "locked") await recordFailure("login", { account: email });

  if (result.outcome === "invalid_credentials") {
    const t = await getTranslations("Login");
    return { error: t("invalidCredentials") };
  }

  if (result.outcome === "locked") {
    const t = await getTranslations("Login");
    return { error: t("locked") };
  }

  await clearAccountFailures("login", email);
  await setSessionCookie(result.sessionToken);
  redirect(result.requiresMfa ? "/mfa" : "/");
}
