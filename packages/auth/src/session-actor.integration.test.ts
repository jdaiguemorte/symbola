// Lot 23 (partie B ; DAT-06, SEC-19 ; ADR 0060) — l'auteur des écritures se
// lit dans la session, sans la modifier, et seulement une fois la double
// authentification passée pour un rôle professionnel.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { sessions } from "@symbola/db/schema/hub";
import { confirmTotp, createOrganization, createUser, findSessionActor, login, setupTotp } from "./service";
import { hashSessionToken } from "./session-token";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

// Lot 26a : tout compte est professionnel ; « confirmed » passe la double
// authentification, sinon la session attend le code.
async function signIn(role: "owner" | "member", confirmed = true) {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const email = `${role}-${randomUUID()}@example.test`;
  const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-de-test", role });
  const result = await login(db, email, "mot-de-passe-de-test");
  if (result.outcome !== "success") throw new Error("connexion attendue");
  if (!confirmed) return { userId: user.id, token: result.sessionToken };
  const { secret } = await setupTotp(db, user.id);
  const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();
  const verified = await confirmTotp(db, { sessionToken: result.sessionToken, token: code });
  if (verified.outcome !== "confirmed") throw new Error("double authentification attendue");
  return { userId: user.id, token: verified.sessionToken };
}

describe("SEC-19 — Auteur des écritures d'après la session", () => {
  it("donne le compte connecté, sans repousser l'expiration de la session", async () => {
    const { userId, token } = await signIn("member");
    const [before] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(await findSessionActor(db, token)).toEqual({ kind: "member", id: userId });
    const [after] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(after!.expiresAt.getTime()).toBe(before!.expiresAt.getTime());
  });

  it("aucun auteur sans session, avec une session expirée, ou avant la double authentification", async () => {
    expect(await findSessionActor(db, undefined)).toBeNull();
    expect(await findSessionActor(db, "jeton-inconnu")).toBeNull();
    const professional = await signIn("owner", false);
    expect(await findSessionActor(db, professional.token)).toBeNull();
    const member = await signIn("member");
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.tokenHash, hashSessionToken(member.token)));
    expect(await findSessionActor(db, member.token)).toBeNull();
  });
});
