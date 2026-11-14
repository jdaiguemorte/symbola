// Lot 9 (ADR 0029) — vue d'assistance de l'Exploitation sur les comptes, seule lecture des
// comptes pour elle (ADR 0013). Comptes de l'équipe d'une organisation (titulaire, membres) :
// adresse et dernière connexion, pour aider quelqu'un. Lot 33 (HUB-02) : par adhésion ; la
// double authentification et les verrous sont tenus par le fournisseur d'identité.
import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { memberships, sessions, users } from "@symbola/db/schema/hub";
import type { ManagementClient } from "./identity/management";

export type TeamAccountStatus = {
  userId: string;
  organizationId: string;
  email: string;
  role: "owner" | "member";
  lastLoginAt: Date | null;
  createdAt: Date;
};

export type OrganizationAccountCounts = {
  organizationId: string;
  teamAccounts: number;
  // Comptes de l'équipe connectés depuis la date demandée.
  activeAccounts: number;
  lastLoginAt: Date | null;
};

export async function listTeamAccounts(db: AppDatabase): Promise<TeamAccountStatus[]> {
  return db
    .select({
      userId: users.id,
      organizationId: memberships.organizationId,
      email: users.email,
      role: memberships.role,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .orderBy(users.createdAt);
}

export async function countAccountsByOrganization(db: AppDatabase, activeSince: Date): Promise<OrganizationAccountCounts[]> {
  const rows = await db
    .select({
      organizationId: memberships.organizationId,
      teamAccounts: sql<number>`count(*)::int`,
      activeAccounts: sql<number>`count(*) filter (where ${users.lastLoginAt} >= ${activeSince.toISOString()})::int`,
      lastLoginAt: sql<string | null>`max(${users.lastLoginAt})`,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .groupBy(memberships.organizationId);
  return rows.map((row) => ({
    organizationId: row.organizationId,
    teamAccounts: row.teamAccounts,
    activeAccounts: row.activeAccounts,
    lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
  }));
}

/** Organisation d'un compte d'équipe (contrôle avant une action d'assistance) ; la première. */
export async function findTeamAccountOrganization(db: AppDatabase, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId)))
    .orderBy(memberships.createdAt)
    .limit(1);
  return row?.organizationId ?? null;
}

export class MfaResetNotAllowedError extends Error {
  constructor() {
    super("réinitialisation refusée : compte sans organisation ou jamais connecté par le fournisseur d'identité");
    this.name = "MfaResetNotAllowedError";
  }
}

// Assistance (ADR 0029, lot 33) : une personne a perdu son second facteur. Ses seconds facteurs
// sont retirés chez le fournisseur d'identité et ses sessions Symbola fermées ; à la connexion
// suivante, la page « Sécurisez votre compte » lui en fait installer un nouveau. Refusé pour un
// compte sans organisation (l'Exploitation) ou jamais connecté par le fournisseur.
export async function resetIdentityMfa(db: AppDatabase, management: Pick<ManagementClient, "listMfaVerifications" | "deleteMfaVerification">, userId: string): Promise<{ email: string; language: "fr" | "en" | null }> {
  const [account] = await db.select({ email: users.email, language: users.language, idpSubject: users.idpSubject, operator: users.operator }).from(users).where(eq(users.id, userId));
  if (!account || account.operator || !account.idpSubject || !(await findTeamAccountOrganization(db, userId))) throw new MfaResetNotAllowedError();
  for (const verification of await management.listMfaVerifications(account.idpSubject)) {
    await management.deleteMfaVerification(account.idpSubject, verification.id);
  }
  await db.delete(sessions).where(eq(sessions.userId, userId));
  return { email: account.email, language: account.language };
}
