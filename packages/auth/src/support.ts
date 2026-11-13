// Lot 9 (ADR 0029) — vue d'assistance de l'Exploitation sur les comptes, seule lecture des
// comptes pour elle (ADR 0013). Comptes de l'équipe d'une organisation (titulaire, membres) :
// adresse et dernière connexion, pour aider quelqu'un. Lot 33 (HUB-02) : par adhésion ; la
// double authentification et les verrous sont tenus par le fournisseur d'identité.
import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { memberships, users } from "@symbola/db/schema/hub";

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
