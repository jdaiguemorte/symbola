// Lot 24b (SEC-06, décision D3) — équipe de l'organisation : la titulaire et les collaborateurs,
// et le retrait d'un accès. Lot 33 (HUB-02, D6) : l'équipe, ce sont les adhésions à
// l'organisation ; un compte peut en avoir ailleurs. Retirer un accès désactive l'adhésion et
// ferme les sessions ouvertes sur cette organisation : la session est relue à chaque requête
// (requireUser), et l'adhésion retirée ne donne plus accès. « Déconnecter tous mes appareils »
// ferme les autres sessions du compte.
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { memberships, sessions, users } from "@symbola/db/schema/hub";
import { journalConnection } from "./connection-journal";
import type { MembershipRole } from "./roles";
import { hashSessionToken } from "./session-token";

export type TeamMember = {
  id: string;
  email: string;
  // Lot 70a (A1) : prénom et nom saisis par la personne (nuls tant qu'elle ne les a pas donnés).
  firstName: string | null;
  lastName: string | null;
  role: MembershipRole;
  lastLoginAt: Date | null;
  disabledAt: Date | null;
};

// Revue du 70a : accepte aussi une transaction, pour vérifier un membre dans la transaction d'écriture.
export async function listTeam(db: Pick<AppDatabase, "select">, organizationId: string): Promise<TeamMember[]> {
  return db
    .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, role: memberships.role, lastLoginAt: users.lastLoginAt, disabledAt: memberships.disabledAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(asc(memberships.role), asc(users.email));
}

export type RemoveMemberOutcome = "removed" | "already_removed" | "not_removable" | "not_found";

// Lot 52 (HUB-04) : ferme les sessions d'un compte chez le fournisseur d'identité (API
// d'administration ; un adaptateur simulé dans les tests).
export type ProviderSessionCloser = (idpSubject: string) => Promise<unknown>;

// Seul un collaborateur (Planner ou, lot 52, Comptable) se retire ; la titulaire ne se retire pas
// elle-même. Lot 52 (HUB-04) : ses sessions Symbola de l'organisation sont supprimées aussitôt (sa
// requête suivante est refusée), puis, s'il n'a plus aucune organisation active, ses sessions chez le
// fournisseur sont fermées. Un échec chez le fournisseur ne rétablit rien : l'accès à Symbola est déjà
// coupé, et le journal technique le note sans donnée personnelle.
export async function removeMember(
  db: AppDatabase,
  input: { organizationId: string; userId: string; removedByUserId: string; now?: Date; closeProviderSessions?: ProviderSessionCloser },
): Promise<RemoveMemberOutcome> {
  const [member] = await db
    .select({ id: memberships.id, userId: memberships.userId, role: memberships.role, disabledAt: memberships.disabledAt })
    .from(memberships)
    .where(and(eq(memberships.userId, input.userId), eq(memberships.organizationId, input.organizationId)));
  if (!member) return "not_found";
  if ((member.role !== "member" && member.role !== "accountant") || member.userId === input.removedByUserId) return "not_removable";
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
  if (input.closeProviderSessions) {
    const stillActive = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.userId, member.userId), isNull(memberships.disabledAt)));
    const [account] = await db.select({ idpSubject: users.idpSubject }).from(users).where(eq(users.id, member.userId));
    if (stillActive.length === 0 && account?.idpSubject) {
      try {
        await input.closeProviderSessions(account.idpSubject);
      } catch (error) {
        console.error("retrait d'un accès : sessions du fournisseur non fermées", error instanceof Error ? error.name : "erreur");
      }
    }
  }
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
