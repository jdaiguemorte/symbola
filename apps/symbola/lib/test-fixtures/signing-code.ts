// Lot 43 (SEC-16, D4) — pour les tests qui n'éprouvent pas le code lui-même : le code à usage unique
// est tenu pour vérifié par les signataires de cette adresse (en vrai : confirmSigningCode, depuis le
// lien du signataire, avec le code reçu par e-mail).
import { eq } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { quoteSigners } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";

export async function markSigningCodeVerified(organizationId: string, email: string, now: Date = new Date()): Promise<void> {
  await withOrganization(appDatabase(), organizationId, (tx) => tx.update(quoteSigners).set({ signingCodeVerifiedAt: now }).where(eq(quoteSigners.email, email.trim().toLowerCase())));
}
