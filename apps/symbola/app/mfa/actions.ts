"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { confirmTotp, requireUser, resumeTotpSetup, type ConfirmTotpResult } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { getSessionToken, setSessionCookie, setTrustedDeviceCookie } from "@/lib/auth-context";
import { sendMfaLockMail } from "@/lib/mfa-lock-mail";
import { checkRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { totpSetupDisplay } from "@/lib/totp-qr";

export async function getMfaSetupState() {
  const token = await getSessionToken();
  const db = appDatabase();
  const result = await requireUser(db, token);
  if (result.status !== "mfa_required") return null;

  // SEC-03 : jamais d'appareil de confiance pour l'Admin.
  const allowRememberDevice = result.role !== "admin";
  if (!result.totpConfirmed) {
    const { provisioningUri } = await resumeTotpSetup(db, result.userId);
    return { setup: totpSetupDisplay(provisioningUri), allowRememberDevice };
  }

  return { setup: null, allowRememberDevice };
}

export type MfaFormState = { error?: string };

export async function confirmMfaAction(
  _prevState: MfaFormState,
  formData: FormData,
): Promise<MfaFormState> {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const code = String(formData.get("code") ?? "");
  const db = appDatabase();
  // SEC-02 (ADR 0044) : par adresse et par compte, en plus du verrouillage après 5 échecs.
  const session = await requireUser(db, token);
  const limited = await checkRateLimit("mfa", { account: session.status === "mfa_required" ? session.userId : null });
  if (!limited.allowed) return { error: await rateLimitMessage(limited.retryAfterSeconds) };
  const result: ConfirmTotpResult = await confirmTotp(db, { sessionToken: token, token: code, rememberDevice: formData.get("rememberDevice") === "on" });

  if (result.outcome === "locked") {
    if (result.notify) await sendMfaLockMail(result.notify);
    const t = await getTranslations("Mfa");
    return { error: t("locked") };
  }
  if (result.outcome === "invalid") {
    const t = await getTranslations("Mfa");
    return { error: t("invalidCode") };
  }

  // SEC-01 : nouveau jeton de session après la double authentification.
  await setSessionCookie(result.sessionToken);
  // SEC-03 : « se souvenir de cet appareil » coché.
  if (result.deviceToken) await setTrustedDeviceCookie(result.deviceToken);
  redirect("/");
}
