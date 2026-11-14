"use server";

// Lot 33 (HUB-01, HUB-02, ADR 0067) — invitation acceptée sans mot de passe : le compte (créé s'il
// n'existe pas) reçoit l'adhésion, puis un lien de connexion part à l'adresse invitée.
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { acceptInvitation } from "@/modules/hub/service";
import { isHoneypotFilled } from "@/lib/honeypot";
import { sendMagicLink } from "@/lib/identity";

export type AcceptInvitationFormState = { error?: string; sent?: boolean };

export async function acceptInvitationAction(_previous: AcceptInvitationFormState, formData: FormData): Promise<AcceptInvitationFormState> {
  const t = await getTranslations("Invitation");
  // Lot 24b (SEC-22) : envoi d'un robot, ignoré.
  if (isHoneypotFilled(formData)) return { error: t("invalidOrExpired") };
  const result = await acceptInvitation(appDatabase(), { token: String(formData.get("token") ?? "") });
  if (result.outcome === "invalid_or_expired") return { error: t("invalidOrExpired") };
  if (result.outcome === "already_accepted") return { error: t("alreadyAccepted") };
  await sendMagicLink(result.email, (await getLocale()) === "en" ? "en" : "fr");
  return { sent: true };
}
