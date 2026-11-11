// Lot 24b — SEC-06 (décision D3) : la titulaire retire l'accès d'un
// collaborateur, et la session de celui-ci est refusée dès la requête suivante ;
// « Déconnecter tous mes appareils » ferme les autres sessions. SEC-05 : une
// session sans activité depuis 8 heures est refusée. PostgreSQL réel.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { sessions, trustedDevices } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { requestPasswordReset } from "./recovery";
import { createOrganization, createUser, login, requireUser } from "./service";
import { hashSessionToken } from "./session-token";
import { listTeam, removeMember, revokeOtherSessions } from "./team";

const { sql, db } = createAppConnection();
const PASSWORD = "mot-de-passe-de-test";

afterAll(async () => {
  await sql.end();
});

async function team() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const account = async (role: "owner" | "member" | "client") => {
    const email = `${role}-${randomUUID()}@example.test`;
    const user = await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role });
    return { id: user.id, email };
  };
  return { organizationId: organization.id, owner: await account("owner"), member: await account("member"), client: await account("client") };
}

async function signIn(email: string): Promise<string> {
  const result = await login(db, email, PASSWORD);
  if (result.outcome !== "success") throw new Error("connexion attendue");
  return result.sessionToken;
}

function journal(organizationId: string, action: string) {
  return withOrganization(db, organizationId, (tx) =>
    tx.select().from(auditEntries).where(and(eq(auditEntries.organizationId, organizationId), eq(auditEntries.action, action))),
  );
}

describe("SEC-06 — Révocation immédiate : retrait d'un membre, déconnexion à distance", () => {
  it("l'équipe liste la titulaire et les collaborateurs de l'organisation, sans les mariés ni les autres organisations", async () => {
    const mine = await team();
    await team();
    const listed = await listTeam(db, mine.organizationId);
    expect(listed.map((member) => [member.role, member.email])).toEqual([
      ["owner", mine.owner.email],
      ["member", mine.member.email],
    ]);
  });

  it("un collaborateur retiré : sa session est refusée à la requête suivante, il ne se connecte plus, aucun lien ne lui est envoyé", async () => {
    const { organizationId, owner, member } = await team();
    const token = await signIn(member.email);
    expect((await requireUser(db, token)).status).toBe("mfa_required");

    expect(await removeMember(db, { organizationId, userId: member.id, removedByUserId: owner.id })).toBe("removed");
    expect(await requireUser(db, token)).toEqual({ status: "unauthenticated" });
    expect(await db.select().from(sessions).where(eq(sessions.userId, member.id))).toEqual([]);
    expect(await login(db, member.email, PASSWORD)).toEqual({ outcome: "invalid_credentials" });
    expect(await requestPasswordReset(db, member.email)).toBeNull();

    const [removed] = await journal(organizationId, "hub.member.removed");
    expect(removed).toMatchObject({ category: "droits", objectId: member.id, actorKind: "member", actorId: owner.id });
    const [refused] = await journal(organizationId, "hub.session.failed");
    expect(refused!.details).toEqual({ reason: "disabled" });
    expect((await listTeam(db, organizationId)).find((entry) => entry.id === member.id)?.disabledAt).toBeInstanceOf(Date);
  });

  it("ni la titulaire, ni un marié, ni le compte d'une autre organisation ne se retirent depuis l'équipe", async () => {
    const mine = await team();
    const other = await team();
    expect(await removeMember(db, { organizationId: mine.organizationId, userId: mine.owner.id, removedByUserId: mine.owner.id })).toBe("not_removable");
    expect(await removeMember(db, { organizationId: mine.organizationId, userId: mine.client.id, removedByUserId: mine.owner.id })).toBe("not_found");
    expect(await removeMember(db, { organizationId: mine.organizationId, userId: other.member.id, removedByUserId: mine.owner.id })).toBe("not_found");
    expect(await removeMember(db, { organizationId: mine.organizationId, userId: mine.member.id, removedByUserId: mine.owner.id })).toBe("removed");
    expect(await removeMember(db, { organizationId: mine.organizationId, userId: mine.member.id, removedByUserId: mine.owner.id })).toBe("already_removed");
  });

  it("« Déconnecter tous mes appareils » ferme les autres sessions et oublie les appareils de confiance, pas la session en cours", async () => {
    const { organizationId, owner } = await team();
    const current = await signIn(owner.email);
    const elsewhere = await signIn(owner.email);
    await db.insert(trustedDevices).values({ userId: owner.id, tokenHash: hashSessionToken(randomUUID()), expiresAt: new Date(Date.now() + 86_400_000) });

    expect(await revokeOtherSessions(db, { userId: owner.id, currentSessionToken: current })).toBe(1);
    expect((await requireUser(db, elsewhere)).status).toBe("unauthenticated");
    expect((await requireUser(db, current)).status).toBe("mfa_required");
    expect(await db.select().from(trustedDevices).where(eq(trustedDevices.userId, owner.id))).toEqual([]);
    const [revoked] = await journal(organizationId, "hub.sessions.revoked");
    expect(revoked).toMatchObject({ category: "connexion", actorId: owner.id, details: { count: 1 } });
  });
});

describe("SEC-05 — Expiration à l'inactivité", () => {
  it("une session sans activité depuis 8 heures est refusée", async () => {
    const { owner } = await team();
    const token = await signIn(owner.email);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(await requireUser(db, token)).toEqual({ status: "unauthenticated" });
  });
});
