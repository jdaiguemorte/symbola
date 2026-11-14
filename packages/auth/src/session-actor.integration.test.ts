// Lot 23 (partie B ; DAT-06, SEC-19 ; ADR 0060) — l'auteur des écritures se lit dans la session,
// sans la modifier, et seulement quand la session donne accès (lot 33 : double authentification
// de la Propriétaire, adhésion active).
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { sessions } from "@symbola/db/schema/hub";
import { createOrganization, createUser, findSessionActor, signInWithIdentity } from "./service";
import { hashSessionToken } from "./session-token";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function signIn(role: "owner" | "member", mfa = true) {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const email = `${role}-${randomUUID()}@example.test`;
  const user = await createUser(db, { organizationId: organization.id, email, role });
  const outcome = await signInWithIdentity(db, { subject: `sub-${randomUUID()}`, email, mfa }, { now: new Date(Date.now() + 2 * 60 * 1000) });
  if (outcome.outcome !== "signed_in") throw new Error("session attendue");
  return { userId: user.id, token: outcome.sessionToken };
}

describe("SEC-19 — Auteur des écritures d'après la session", () => {
  it("donne le compte connecté, sans repousser l'expiration de la session", async () => {
    const { userId, token } = await signIn("member");
    const [before] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(await findSessionActor(db, token)).toEqual({ kind: "member", id: userId });
    const [after] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(after!.expiresAt.getTime()).toBe(before!.expiresAt.getTime());
  });

  it("aucun auteur sans session, avec une session expirée, ou pour la Propriétaire sans double authentification", async () => {
    expect(await findSessionActor(db, undefined)).toBeNull();
    expect(await findSessionActor(db, "jeton-inconnu")).toBeNull();
    const owner = await signIn("owner", false);
    expect(await findSessionActor(db, owner.token)).toBeNull();
    const member = await signIn("member");
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.tokenHash, hashSessionToken(member.token)));
    expect(await findSessionActor(db, member.token)).toBeNull();
  });
});
