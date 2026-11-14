"use server";

// Lot 33 (D4) — la double authentification devient obligatoire chez le fournisseur, puis un lien de
// connexion part à l'adresse du compte : le fournisseur fait installer le second facteur s'il
// manque, le demande, et la session repart avec la double authentification.
import { getLocale } from "next-intl/server";
import { accountIdentity } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { requirePendingMfa } from "@/lib/guards";
import { requireMfaAtProvider, sendMagicLink } from "@/lib/identity";

export type SecurityLinkState = { sent?: boolean };

export async function sendSecurityLinkAction(_previous: SecurityLinkState): Promise<SecurityLinkState> {
  const pending = await requirePendingMfa();
  const account = await accountIdentity(appDatabase(), pending.userId);
  if (account?.idpSubject) await requireMfaAtProvider(account.idpSubject);
  if (account) await sendMagicLink(account.email, (await getLocale()) === "en" ? "en" : "fr");
  return { sent: true };
}
