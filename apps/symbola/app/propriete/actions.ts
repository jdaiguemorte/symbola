"use server";

// Lot 52 (HUB-04 ; D1 ; ADR 0094) — la Planner désignée confirme : les rôles s'échangent, les deux
// reçoivent un e-mail, le journal d'audit garde la trace. Elle doit être connectée avec sa double
// authentification ; seule elle peut confirmer ; le lien sert une fois, sept jours.
import { getLocale, getTranslations } from "next-intl/server";
import { accountIdentity, confirmOwnershipTransfer, describeOwnershipTransfer } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { getAuthContext } from "@/lib/auth-context";
import { requireMfaAtProvider } from "@/lib/identity";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrganizationContact, sendSymbolaEmail } from "@/modules/hub/service";

export type ConfirmOwnershipState = { outcome?: "transferred" | "invalid" | "not_recipient" | "mfa_required" };

export async function confirmOwnershipAction(_previous: ConfirmOwnershipState, formData: FormData): Promise<ConfirmOwnershipState> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return { outcome: "mfa_required" };
  const token = String(formData.get("token") ?? "");
  const limit = await checkRateLimit("linkCode", { account: auth.user.id });
  if (!limit.allowed) return { outcome: "invalid" };
  const db = appDatabase();
  const transfer = await describeOwnershipTransfer(db, token);
  const result = await confirmOwnershipTransfer(db, { token, userId: auth.user.id, mfaVerified: auth.user.mfaEnabled });
  if (result.outcome !== "transferred" || !transfer) return { outcome: result.outcome };
  // La nouvelle Propriétaire garde la double authentification exigée chez le fournisseur.
  const [newOwner, previousOwner] = await Promise.all([accountIdentity(db, result.toUserId), accountIdentity(db, result.fromUserId)]);
  if (newOwner?.idpSubject) await requireMfaAtProvider(newOwner.idpSubject);
  const organization = (await getOrganizationContact(db, result.organizationId)).name;
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const t = await getTranslations({ locale, namespace: "Emails.fixed.ownershipDone" });
  for (const account of [newOwner, previousOwner]) {
    if (!account) continue;
    try {
      await sendSymbolaEmail({ to: account.email, locale, subject: t("subject", { organization }), body: t("body", { organization, owner: newOwner?.email ?? "" }), organizationId: result.organizationId });
    } catch (error) {
      console.error("transfert de propriété : e-mail de confirmation impossible", error instanceof Error ? error.name : "erreur");
    }
  }
  return { outcome: "transferred" };
}
