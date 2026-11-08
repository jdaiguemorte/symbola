"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { confirmTotp, requireUser, resumeTotpSetup, type ConfirmTotpResult } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { getSessionToken, setSessionCookie, setTrustedDeviceCookie } from "@/lib/auth-context";
import { sendMfaLockMail } from "@/lib/mfa-lock-mail";
import { totpSetupDisplay } from "@/lib/totp-qr";

export async function getMfaSetupState() {
  const token = await getSessionToken();
  const { sql, db } = createAppConnection();
  try {
    const result = await requireUser(db, token);
    if (result.status !== "mfa_required") return null;

    // SEC-03 : jamais d'appareil de confiance pour l'Admin.
    const allowRememberDevice = result.role !== "admin";
    if (!result.totpConfirmed) {
      const { provisioningUri } = await resumeTotpSetup(db, result.userId);
      return { setup: totpSetupDisplay(provisioningUri), allowRememberDevice };
    }

    return { setup: null, allowRememberDevice };
  } finally {
    await sql.end();
  }
}

export type MfaFormState = { error?: string };

export async function confirmMfaAction(
  _prevState: MfaFormState,
  formData: FormData,
): Promise<MfaFormState> {
  const token = await getSessionToken();
  if (!token) redirect("/login");

  const code = String(formData.get("code") ?? "");
  const { sql, db } = createAppConnection();
  let result: ConfirmTotpResult;
  try {
    result = await confirmTotp(db, { sessionToken: token, token: code, rememberDevice: formData.get("rememberDevice") === "on" });
  } finally {
    await sql.end();
  }

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
