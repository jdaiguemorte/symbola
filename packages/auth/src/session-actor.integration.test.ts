// Lot 23 (partie B ; DAT-06, SEC-19 ; ADR 0060) — l'auteur des écritures se
// lit dans la session, sans la modifier, et seulement une fois la double
// authentification passée pour un rôle professionnel.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { sessions } from "@symbola/db/schema/hub";
import { createOrganization, createUser, findSessionActor, login } from "./service";
import { hashSessionToken } from "./session-token";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function signIn(role: "owner" | "client") {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const email = `${role}-${randomUUID()}@example.test`;
  const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-de-test", role });
  const result = await login(db, email, "mot-de-passe-de-test");
  if (result.outcome !== "success") throw new Error("connexion attendue");
  return { userId: user.id, token: result.sessionToken };
}

describe("SEC-19 — Auteur des écritures d'après la session", () => {
  it("donne le compte connecté, sans repousser l'expiration de la session", async () => {
    const { userId, token } = await signIn("client");
    const [before] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(await findSessionActor(db, token)).toEqual({ kind: "member", id: userId });
    const [after] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(after!.expiresAt.getTime()).toBe(before!.expiresAt.getTime());
  });

  it("aucun auteur sans session, avec une session expirée, ou avant la double authentification", async () => {
    expect(await findSessionActor(db, undefined)).toBeNull();
    expect(await findSessionActor(db, "jeton-inconnu")).toBeNull();
    const professional = await signIn("owner");
    expect(await findSessionActor(db, professional.token)).toBeNull();
    const client = await signIn("client");
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.tokenHash, hashSessionToken(client.token)));
    expect(await findSessionActor(db, client.token)).toBeNull();
  });
});
