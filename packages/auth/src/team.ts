// Lot 24b (SEC-06, décision D3) — équipe de l'organisation : la titulaire et les collaborateurs,
// et le retrait d'un accès. Lot 33 (HUB-02, D6) : l'équipe, ce sont les adhésions à
// l'organisation ; un compte peut en avoir ailleurs. Retirer un accès désactive l'adhésion et
// ferme les sessions ouvertes sur cette organisation : la session est relue à chaque requête
// (requireUser), et l'adhésion retirée ne donne plus accès. « Déconnecter tous mes appareils »
// ferme les autres sessions du compte.
import { and, asc, eq, ne } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { memberships, sessions, users } from "@symbola/db/schema/hub";
import { journalConnection } from "./connection-journal";
import { hashSessionToken } from "./session-token";

export type TeamMember = {
  id: string;
  email: string;
  role: "owner" | "member";
  lastLoginAt: Date | null;
  disabledAt: Date | null;
};

export async function listTeam(db: AppDatabase, organizationId: string): Promise<TeamMember[]> {
  return db
    .select({ id: users.id, email: users.email, role: memberships.role, lastLoginAt: users.lastLoginAt, disabledAt: memberships.disabledAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(asc(memberships.role), asc(users.email));
}

export type RemoveMemberOutcome = "removed" | "already_removed" | "not_removable" | "not_found";

// Seul un collaborateur se retire ; la titulaire ne se retire pas elle-même.
export async function removeMember(
  db: AppDatabase,
  input: { organizationId: string; userId: string; removedByUserId: string; now?: Date },
): Promise<RemoveMemberOutcome> {
  const [member] = await db
    .select({ id: memberships.id, userId: memberships.userId, role: memberships.role, disabledAt: memberships.disabledAt })
    .from(memberships)
    .where(and(eq(memberships.userId, input.userId), eq(memberships.organizationId, input.organizationId)));
  if (!member) return "not_found";
  if (member.role !== "member" || member.userId === input.removedByUserId) return "not_removable";
  if (member.disabledAt) return "already_removed";

  await db.transaction(async (tx) => {
    await tx.update(memberships).set({ disabledAt: input.now ?? new Date() }).where(eq(memberships.id, member.id));
    await tx.delete(sessions).where(and(eq(sessions.userId, member.userId), eq(sessions.organizationId, input.organizationId)));
  });
  await recordAudit(db, {
    organizationId: input.organizationId,
    action: "hub.member.removed",
    objectId: member.userId,
    actor: { kind: "member", id: input.removedByUserId },
  });
  return "removed";
}

// Ferme toutes les sessions du compte sauf celle en cours. Renvoie le nombre de sessions fermées.
export async function revokeOtherSessions(db: AppDatabase, input: { userId: string; currentSessionToken: string | undefined }): Promise<number> {
  const keep = input.currentSessionToken ? hashSessionToken(input.currentSessionToken) : null;
  const closed = await db
    .delete(sessions)
    .where(keep ? and(eq(sessions.userId, input.userId), ne(sessions.tokenHash, keep)) : eq(sessions.userId, input.userId))
    .returning({ id: sessions.id });
  const [current] = keep ? await db.select({ organizationId: sessions.organizationId }).from(sessions).where(eq(sessions.tokenHash, keep)) : [];
  const [account] = await db.select({ operator: users.operator }).from(users).where(eq(users.id, input.userId));
  if (account) {
    await journalConnection(db, { id: input.userId, organizationId: current?.organizationId ?? null, role: account.operator ? "admin" : "member" }, "hub.sessions.revoked", {
      details: { count: closed.length },
    });
  }
  return closed.length;
}
