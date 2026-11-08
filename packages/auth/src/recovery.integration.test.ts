// Lot 9 (ADR 0029) — retrouver l'accès à son compte, contre un vrai
// PostgreSQL : lien de mot de passe oublié et réinitialisation de la double
// authentification par l'Admin.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { sessions, users } from "@symbola/db/schema/hub";
import {
  isPasswordResetTokenValid,
  MfaResetNotAllowedError,
  requestPasswordReset,
  resetPassword,
  resetUserMfa,
} from "./recovery";
import { confirmTotp, createOrganization, createUser, login, requireUser, resumeTotpSetup } from "./service";

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

async function planner(role: "owner" | "client" | "admin" = "owner") {
  const organization = role === "admin" ? null : await createOrganization(db, `Org ${randomUUID()}`);
  const email = `lot9-${role}-${randomUUID()}@symbola.test`;
  const user = await createUser(db, { organizationId: organization?.id ?? null, email, password: "ancien-mot-de-passe", role });
  return { user, email };
}

async function sessionCount(userId: string) {
  return (await db.select().from(sessions).where(eq(sessions.userId, userId))).length;
}

describe("Lot 9 — Mot de passe oublié", () => {
  it("une adresse inconnue ne donne aucun lien (et l'appelant répond pareil)", async () => {
    expect(await requestPasswordReset(db, `inconnu-${randomUUID()}@symbola.test`)).toBeNull();
  });

  it("le lien remplace le mot de passe une seule fois, ferme les sessions et lève le verrouillage", async () => {
    const { user, email } = await planner();
    await login(db, email, "ancien-mot-de-passe");
    await db.update(users).set({ lockedUntil: new Date(Date.now() + 60_000) }).where(eq(users.id, user.id));
    expect(await sessionCount(user.id)).toBe(1);

    const request = await requestPasswordReset(db, email);
    expect(request).toMatchObject({ email });
    expect(request!.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
    expect(await isPasswordResetTokenValid(db, request!.token)).toBe(true);

    expect(await resetPassword(db, { token: request!.token, password: "court" })).toBe("password_too_short");
    expect(await resetPassword(db, { token: request!.token, password: "nouveau-mot-de-passe" })).toBe("success");
    expect(await sessionCount(user.id)).toBe(0);
    expect(await isPasswordResetTokenValid(db, request!.token)).toBe(false);
    expect(await resetPassword(db, { token: request!.token, password: "encore-un-autre-mdp" })).toBe("invalid_or_expired");

    expect((await login(db, email, "ancien-mot-de-passe")).outcome).toBe("invalid_credentials");
    const relogin = await login(db, email, "nouveau-mot-de-passe");
    expect(relogin.outcome).toBe("success");
    // La double authentification reste exigée après la réinitialisation.
    expect(relogin.outcome === "success" && relogin.requiresMfa).toBe(true);
  });

  it("un lien expire après 30 minutes (veille et minute exacte)", async () => {
    const { email } = await planner();
    const now = new Date("2026-11-04T10:00:00Z");
    const request = await requestPasswordReset(db, email, now);
    expect(await isPasswordResetTokenValid(db, request!.token, new Date("2026-11-04T10:29:59Z"))).toBe(true);
    expect(await resetPassword(db, { token: request!.token, password: "nouveau-mot-de-passe", now: new Date("2026-11-04T10:30:00Z") })).toBe(
      "invalid_or_expired",
    );
  });

  it("une seconde demande dans les 5 minutes n'envoie rien ; plus tard, le nouveau lien invalide l'ancien", async () => {
    const { email } = await planner();
    const first = await requestPasswordReset(db, email, new Date("2026-11-04T10:00:00Z"));
    expect(await requestPasswordReset(db, email, new Date("2026-11-04T10:04:59Z"))).toBeNull();
    const second = await requestPasswordReset(db, email, new Date("2026-11-04T10:05:01Z"));
    expect(second).not.toBeNull();
    const at = new Date("2026-11-04T10:06:00Z");
    expect(await isPasswordResetTokenValid(db, first!.token, at)).toBe(false);
    expect(await isPasswordResetTokenValid(db, second!.token, at)).toBe(true);
  });
});

describe("Lot 9 — Réinitialisation de la double authentification par l'Admin", () => {
  it("efface la clé et ferme les sessions : à la connexion suivante, un nouveau QR code", async () => {
    const { user, email } = await planner();
    const first = await login(db, email, "ancien-mot-de-passe");
    if (first.outcome !== "success") throw new Error("connexion attendue");
    const { secret } = await resumeTotpSetup(db, user.id);
    const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();
    const confirmed = await confirmTotp(db, { sessionToken: first.sessionToken, token: code });
    if (confirmed.outcome !== "confirmed") throw new Error("validation attendue");

    expect(await resetUserMfa(db, user.id)).toMatchObject({ email });
    expect(await sessionCount(user.id)).toBe(0);
    expect((await requireUser(db, confirmed.sessionToken)).status).toBe("unauthenticated");

    const second = await login(db, email, "ancien-mot-de-passe");
    if (second.outcome !== "success") throw new Error("connexion attendue");
    expect(await requireUser(db, second.sessionToken)).toMatchObject({ status: "mfa_required", totpConfirmed: false });
    expect((await resumeTotpSetup(db, user.id)).secret).not.toBe(secret);
  });

  it("refuse un compte marié et un compte Admin", async () => {
    const client = await planner("client");
    const admin = await planner("admin");
    await expect(resetUserMfa(db, client.user.id)).rejects.toBeInstanceOf(MfaResetNotAllowedError);
    await expect(resetUserMfa(db, admin.user.id)).rejects.toBeInstanceOf(MfaResetNotAllowedError);
    await expect(resetUserMfa(db, randomUUID())).rejects.toBeInstanceOf(MfaResetNotAllowedError);
  });
});
