// Lot 24b (SEC-06, décision D3) — équipe de l'organisation, retrait d'un accès, déconnexion de
// tous les appareils. Lot 33 (HUB-02, D6) : par adhésion ; le retrait ne touche que
// l'organisation qui retire. PostgreSQL réel.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { sessions } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createOrganization, createUser, requireUser, signInWithIdentity } from "./service";
import { listTeam, removeMember, revokeOtherSessions } from "./team";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function team() {
  const organization = await createOrganization(db, `Équipe ${randomUUID()}`);
  const make = async (role: "owner" | "member", label: string) => {
    const email = `${label}-${randomUUID()}@example.test`;
    const user = await createUser(db, { organizationId: organization.id, email, role });
    return { id: user.id, email };
  };
  return { organizationId: organization.id, owner: await make("owner", "titulaire"), member: await make("member", "planner"), other: await make("member", "assistante") };
}

async function signIn(email: string) {
  const outcome = await signInWithIdentity(db, { subject: `sub-${email}`, email, mfa: true });
  if (outcome.outcome !== "signed_in") throw new Error("session attendue");
  return outcome.sessionToken;
}

describe("SEC-06 — Équipe de l'organisation (lot 24b, D3 ; lot 33, adhésions)", () => {
  it("liste la titulaire puis les collaborateurs de cette organisation seulement", async () => {
    const { organizationId, owner, member, other } = await team();
    await team();
    const listed = await listTeam(db, organizationId);
    expect(listed[0]).toMatchObject({ id: owner.id, role: "owner", disabledAt: null });
    expect(listed.slice(1).map((entry) => entry.id).sort()).toEqual([member.id, other.id].sort());
  });

  it("retirer un collaborateur ferme ses sessions sur l'organisation et le journalise ; la titulaire ne se retire pas", async () => {
    const { organizationId, owner, member } = await team();
    const token = await signIn(member.email);
    expect(await removeMember(db, { organizationId, userId: owner.id, removedByUserId: owner.id })).toBe("not_removable");
    expect(await removeMember(db, { organizationId, userId: member.id, removedByUserId: owner.id })).toBe("removed");
    expect(await removeMember(db, { organizationId, userId: member.id, removedByUserId: owner.id })).toBe("already_removed");
    expect(await requireUser(db, token)).toEqual({ status: "unauthenticated" });
    expect(await db.select().from(sessions).where(eq(sessions.userId, member.id))).toEqual([]);
    const [entry] = await withOrganization(db, organizationId, (tx) =>
      tx.select().from(auditEntries).where(and(eq(auditEntries.organizationId, organizationId), eq(auditEntries.action, "hub.member.removed"))),
    );
    expect(entry).toMatchObject({ objectId: member.id, actorId: owner.id });
    expect((await listTeam(db, organizationId)).find((entry) => entry.id === member.id)?.disabledAt).toBeInstanceOf(Date);
  });

  it("refuse un compte d'une autre organisation (même réponse qu'un compte inconnu)", async () => {
    const first = await team();
    const second = await team();
    expect(await removeMember(db, { organizationId: first.organizationId, userId: second.member.id, removedByUserId: first.owner.id })).toBe("not_found");
    expect(await removeMember(db, { organizationId: first.organizationId, userId: randomUUID(), removedByUserId: first.owner.id })).toBe("not_found");
  });

  it("« déconnecter tous mes appareils » ferme les autres sessions du compte, garde la session en cours", async () => {
    const { member } = await team();
    const current = await signIn(member.email);
    const other = await signIn(member.email);
    expect(await revokeOtherSessions(db, { userId: member.id, currentSessionToken: current })).toBe(1);
    expect((await requireUser(db, current)).status).toBe("authenticated");
    expect(await requireUser(db, other)).toEqual({ status: "unauthenticated" });
  });
});
