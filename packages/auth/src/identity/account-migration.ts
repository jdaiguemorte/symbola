// Lot 33 (SEC-01, D3, ADR 0067) — reprise des comptes chez le fournisseur d'identité, rejouable :
// chaque compte actif sans identifiant chez le fournisseur y est retrouvé par son adresse, ou
// créé (adresse seule, aucun haché ne quitte la base), puis relié. La double authentification
// devient obligatoire chez le fournisseur pour les titulaires et l'Exploitation (D4) : leur
// première connexion la fera installer. Sans ce script, un compte se relie quand même à sa
// première connexion, par son adresse vérifiée.
import { and, eq, isNull } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { memberships, users } from "@symbola/db/schema/hub";
import { IdentityProviderError, type ManagementClient } from "./management";

export type AccountMigrationReport = { linked: number; created: number; mfaRequired: number; alreadyLinked: number; relinked: number };

const isUnknownAtProvider = (error: unknown) => error instanceof IdentityProviderError && error.status === 404;

export async function migrateAccounts(
  db: AppDatabase,
  management: Pick<ManagementClient, "findUserByEmail" | "createUser" | "requireMfa">,
): Promise<AccountMigrationReport> {
  const report: AccountMigrationReport = { linked: 0, created: 0, mfaRequired: 0, alreadyLinked: 0, relinked: 0 };
  const accounts = await db.select({ id: users.id, email: users.email, idpSubject: users.idpSubject, operator: users.operator }).from(users).where(isNull(users.disabledAt));
  const owners = new Set(
    (await db.select({ userId: memberships.userId }).from(memberships).where(and(eq(memberships.role, "owner"), isNull(memberships.disabledAt)))).map((row) => row.userId),
  );
  const link = async (account: { id: string; email: string }): Promise<string> => {
    const found = await management.findUserByEmail(account.email);
    const identity = found ?? (await management.createUser(account.email));
    if (!found) report.created += 1;
    await db.update(users).set({ idpSubject: identity.id }).where(eq(users.id, account.id));
    report.linked += 1;
    return identity.id;
  };
  for (const account of accounts) {
    let subject = account.idpSubject;
    if (subject) report.alreadyLinked += 1;
    else subject = await link(account);
    if (account.operator || owners.has(account.id)) {
      try {
        await management.requireMfa(subject);
      } catch (error) {
        // Identifiant inconnu du fournisseur (sa base restaurée depuis une sauvegarde plus
        // ancienne, par exemple) : le compte est relié de nouveau par son adresse.
        if (!isUnknownAtProvider(error)) throw error;
        report.relinked += 1;
        await management.requireMfa(await link(account));
      }
      report.mfaRequired += 1;
    }
  }
  return report;
}
