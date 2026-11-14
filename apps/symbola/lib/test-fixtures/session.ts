// Lot 33 (ADR 0067) — fabrique de test : un compte et sa session Symbola, ouverte comme après le
// fournisseur d'identité (déclarations fictives, double authentification déclarée). Jamais
// appelée par l'app : aucune route d'essai n'ouvre de session.
import { randomUUID } from "node:crypto";
import { createUser, signInWithIdentity, type Role } from "@symbola/auth";
import type { AppDatabase } from "@symbola/db/client";

export async function signedInAccount(
  db: AppDatabase,
  input: { organizationId: string | null; role: Role; email?: string; mfa?: boolean },
): Promise<{ userId: string; email: string; token: string }> {
  const email = input.email ?? `${input.role}-${randomUUID()}@example.test`;
  const user = await createUser(db, { organizationId: input.organizationId, email, role: input.role });
  const outcome = await signInWithIdentity(db, { subject: `sub-${user.id}`, email, mfa: input.mfa ?? true });
  if (outcome.outcome !== "signed_in") throw new Error("session de test attendue");
  return { userId: user.id, email, token: outcome.sessionToken };
}
