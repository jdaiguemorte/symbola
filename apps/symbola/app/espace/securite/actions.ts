"use server";

// EVT-06 — double authentification proposée au marié, jamais imposée.
import { getTranslations } from "next-intl/server";
import { confirmTotp, setupTotp, type ConfirmTotpResult } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { getClientAuthContext, getSessionToken, setSessionCookie } from "@/lib/auth-context";
import { sendMfaLockMail } from "@/lib/mfa-lock-mail";
import { totpSetupDisplay, type TotpSetupDisplay } from "@/lib/totp-qr";

export type ClientMfaFormState = { setup?: TotpSetupDisplay; error?: string; enabled?: boolean };

export async function startClientMfaAction(_prevState: ClientMfaFormState, _formData: FormData): Promise<ClientMfaFormState> {
  const t = await getTranslations("ClientSpace");
  const auth = await getClientAuthContext();
  if (auth.status !== "authenticated") return { error: t("unauthenticated") };
  if (auth.user.mfaEnabled) return { enabled: true };
  const db = appDatabase();
  const { provisioningUri } = await setupTotp(db, auth.user.id);
  return { setup: totpSetupDisplay(provisioningUri) };
}

export async function confirmClientMfaAction(prevState: ClientMfaFormState, formData: FormData): Promise<ClientMfaFormState> {
  const t = await getTranslations("ClientSpace");
  const auth = await getClientAuthContext();
  const sessionToken = await getSessionToken();
  if (auth.status !== "authenticated" || !sessionToken) return { error: t("unauthenticated") };
  const db = appDatabase();
  const result: ConfirmTotpResult = await confirmTotp(db, { sessionToken, token: String(formData.get("code") ?? "") });
  if (result.outcome === "locked") {
    if (result.notify) await sendMfaLockMail(result.notify);
    return { ...prevState, error: t("mfaLocked") };
  }
  if (result.outcome === "invalid") return { ...prevState, error: t("mfaInvalidCode") };
  // SEC-01 : nouveau jeton de session après la double authentification.
  await setSessionCookie(result.sessionToken);
  return { enabled: true };
}
