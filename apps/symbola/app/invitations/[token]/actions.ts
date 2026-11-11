"use server";

import { getTranslations } from "next-intl/server";
import { checkPassword } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { acceptInvitation } from "@/modules/hub/service";
import { isHoneypotFilled } from "@/lib/honeypot";

export type AcceptInvitationFormState = { error?: string; success?: boolean };

export async function acceptInvitationAction(
  _prevState: AcceptInvitationFormState,
  formData: FormData,
): Promise<AcceptInvitationFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const t = await getTranslations("Invitation");
  // Lot 24b (SEC-22) : envoi d'un robot, ignoré.
  if (isHoneypotFilled(formData)) return { error: t("invalidOrExpired") };

  if (!password) {
    return { error: t("missingPassword") };
  }
  // Lot 24b (SEC-03) : douze caractères au moins, pas de mot de passe compromis.
  const verdict = checkPassword(password);
  if (verdict === "too_short") return { error: t("passwordTooShort") };
  if (verdict === "compromised") return { error: t("passwordCompromised") };

  const db = appDatabase();
  const result = await acceptInvitation(db, { token, password });

  if (result.outcome === "invalid_or_expired") {
    return { error: t("invalidOrExpired") };
  }
  if (result.outcome === "already_accepted") {
    return { error: t("alreadyAccepted") };
  }

  return { success: true };
}
