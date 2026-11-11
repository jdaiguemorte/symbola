// Lot 24b (SEC-06, décision D3) — équipe de l'organisation : les comptes de la
// titulaire et des collaborateurs, et le retrait d'un accès. Un accès retiré
// coupe tout de suite les sessions et les appareils de confiance du compte : la
// session est relue en base à chaque requête (requireUser), et un compte retiré
// ne se connecte plus. « Déconnecter tous mes appareils » ferme les autres
// sessions d'un compte. Les mariés ne font pas partie de l'équipe : leur accès
// se retire depuis l'événement.
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { sessions, trustedDevices, users } from "@symbola/db/schema/hub";
import { journalConnection } from "./connection-journal";
import { hashSessionToken } from "./session-token";

const TEAM_ROLES = ["owner", "member"] as const;

export type TeamMember = {
  id: string;
  email: string;
  role: (typeof TEAM_ROLES)[number];
  lastLoginAt: Date | null;
  disabledAt: Date | null;
};

export async function listTeam(db: AppDatabase, organizationId: string): Promise<TeamMember[]> {
  const rows = await db
    .select({ id: users.id, email: users.email, role: users.role, lastLoginAt: users.lastLoginAt, disabledAt: users.disabledAt })
    .from(users)
    .where(and(eq(users.organizationId, organizationId), inArray(users.role, [...TEAM_ROLES])))
    .orderBy(asc(users.role), asc(users.email));
  return rows.map((row) => ({ ...row, role: row.role === "owner" ? "owner" : "member" }));
}

export type RemoveMemberOutcome = "removed" | "already_removed" | "not_removable" | "not_found";

// Seul un collaborateur se retire ; la titulaire ne se retire pas elle-même.
export async function removeMember(
  db: AppDatabase,
  input: { organizationId: string; userId: string; removedByUserId: string; now?: Date },
): Promise<RemoveMemberOutcome> {
  const [member] = await db
    .select({ id: users.id, role: users.role, disabledAt: users.disabledAt })
    .from(users)
    .where(and(eq(users.id, input.userId), eq(users.organizationId, input.organizationId)));
  if (!member || (member.role !== "member" && member.role !== "owner")) return "not_found";
  if (member.role !== "member" || member.id === input.removedByUserId) return "not_removable";
  if (member.disabledAt) return "already_removed";

  await db.transaction(async (tx) => {
    await tx.update(users).set({ disabledAt: input.now ?? new Date() }).where(eq(users.id, member.id));
    await tx.delete(sessions).where(eq(sessions.userId, member.id));
    await tx.delete(trustedDevices).where(eq(trustedDevices.userId, member.id));
  });
  await recordAudit(db, {
    organizationId: input.organizationId,
    action: "hub.member.removed",
    objectId: member.id,
    actor: { kind: "member", id: input.removedByUserId },
  });
  return "removed";
}

// Ferme toutes les sessions du compte sauf celle en cours, et oublie ses
// appareils de confiance. Renvoie le nombre de sessions fermées.
export async function revokeOtherSessions(db: AppDatabase, input: { userId: string; currentSessionToken: string | undefined }): Promise<number> {
  const keep = input.currentSessionToken ? hashSessionToken(input.currentSessionToken) : null;
  const closed = await db
    .delete(sessions)
    .where(keep ? and(eq(sessions.userId, input.userId), ne(sessions.tokenHash, keep)) : eq(sessions.userId, input.userId))
    .returning({ id: sessions.id });
  await db.delete(trustedDevices).where(eq(trustedDevices.userId, input.userId));
  const [account] = await db.select({ id: users.id, organizationId: users.organizationId, role: users.role }).from(users).where(eq(users.id, input.userId));
  if (account) await journalConnection(db, account, "hub.sessions.revoked", { details: { count: closed.length } });
  return closed.length;
}
