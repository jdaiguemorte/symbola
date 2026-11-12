// Lot 9 (ADR 0029) — vue d'assistance de l'Admin sur les comptes, seule
// lecture de hub.users pour lui (ADR 0013). Comptes de l'équipe d'une
// organisation (titulaire, membres) : adresse et état de connexion, pour
// débloquer quelqu'un. Comptes mariés : seulement des nombres — l'Admin n'a
// aucun lien avec eux.
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { users } from "@symbola/db/schema/hub";

export type TeamAccountStatus = {
  userId: string;
  organizationId: string;
  email: string;
  role: "owner" | "member";
  mfaConfigured: boolean;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
};

export type OrganizationAccountCounts = {
  organizationId: string;
  teamAccounts: number;
  // Comptes de l'équipe connectés depuis la date demandée (lot 26a : plus de
  // compte de marié).
  activeAccounts: number;
  lastLoginAt: Date | null;
};

export async function listTeamAccounts(db: AppDatabase): Promise<TeamAccountStatus[]> {
  const rows = await db
    .select({
      userId: users.id,
      organizationId: users.organizationId,
      email: users.email,
      role: users.role,
      mfaConfigured: users.mfaEnabled,
      lockedUntil: users.lockedUntil,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(inArray(users.role, ["owner", "member"]), isNotNull(users.organizationId)))
    .orderBy(users.createdAt);
  return rows.map((row) => ({ ...row, organizationId: row.organizationId!, role: row.role as "owner" | "member" }));
}

export async function countAccountsByOrganization(db: AppDatabase, activeSince: Date): Promise<OrganizationAccountCounts[]> {
  const rows = await db
    .select({
      organizationId: users.organizationId,
      teamAccounts: sql<number>`count(*) filter (where ${users.role} in ('owner', 'member'))::int`,
      activeAccounts: sql<number>`count(*) filter (where ${users.lastLoginAt} >= ${activeSince.toISOString()})::int`,
      lastLoginAt: sql<string | null>`max(${users.lastLoginAt})`,
    })
    .from(users)
    .where(isNotNull(users.organizationId))
    .groupBy(users.organizationId);
  return rows.map((row) => ({
    organizationId: row.organizationId!,
    teamAccounts: row.teamAccounts,
    activeAccounts: row.activeAccounts,
    lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
  }));
}

/** Organisation d'un compte d'équipe (contrôle avant une action d'assistance). */
export async function findTeamAccountOrganization(db: AppDatabase, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(and(eq(users.id, userId), inArray(users.role, ["owner", "member"])));
  return row?.organizationId ?? null;
}

