// SOC-04 — flux complet contre un vrai PostgreSQL : un rôle professionnel
// sans MFA doit configurer un TOTP avant que requireUser() ne le laisse
// passer ; un rôle client (marié) y accède directement sans TOTP. Vérifie
// aussi que la session reste valide entre plusieurs appels (« navigue
// entre les modules sans se reconnecter »).
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { sessions, users } from "@symbola/db/schema/hub";
import {
  confirmTotp,
  createOrganization,
  createUser,
  findAccountByEmail,
  login,
  requireUser,
  resumeTotpSetup,
  setupTotp,
} from "./service";
import { hashSessionToken } from "./session-token";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

function currentCodeFor(secret: string): string {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate();
}

function codeAt(secret: string, timestamp: number): string {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate({ timestamp });
}

describe("SOC-04 — Parcours de connexion (PostgreSQL réel)", () => {
  it("impose la configuration TOTP à un rôle professionnel avant d'accéder au hub", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `planner-${randomUUID()}@example.test`;
    await createUser(db, {
      organizationId: organization.id,
      email,
      password: "mot-de-passe-de-la-planner",
      role: "owner",
    });

    const loginResult = await login(db, email, "mot-de-passe-de-la-planner");
    expect(loginResult.outcome).toBe("success");
    if (loginResult.outcome !== "success") return;
    expect(loginResult.requiresMfa).toBe(true);

    const beforeMfa = await requireUser(db, loginResult.sessionToken);
    expect(beforeMfa.status).toBe("mfa_required");
    if (beforeMfa.status !== "mfa_required") return;
    expect(beforeMfa.totpConfirmed).toBe(false);

    const { secret } = await setupTotp(db, beforeMfa.userId);
    const confirmed = await confirmTotp(db, {
      sessionToken: loginResult.sessionToken,
      token: currentCodeFor(secret),
    });
    if (confirmed.outcome !== "confirmed") throw new Error("validation attendue");
    // L16-SEC-01 : la validation remplace le jeton de session.
    const sessionToken = confirmed.sessionToken;

    const afterMfa = await requireUser(db, sessionToken);
    expect(afterMfa.status).toBe("authenticated");
    if (afterMfa.status !== "authenticated") return;
    expect(afterMfa.user.email).toBe(email);

    // Navigue entre plusieurs « modules » sans se reconnecter : la même
    // session reste pleinement authentifiée à un second appel.
    const secondCall = await requireUser(db, sessionToken);
    expect(secondCall.status).toBe("authenticated");
  });

  it("une configuration abandonnée avant le premier code reprend à la connexion suivante, avec la même clé", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `planner-reprise-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-de-la-planner", role: "owner" });

    // Première connexion : l'écran affiche la clé, la planner part sans valider de code.
    const first = await login(db, email, "mot-de-passe-de-la-planner");
    if (first.outcome !== "success") throw new Error("connexion attendue");
    const pendingFirst = await requireUser(db, first.sessionToken);
    if (pendingFirst.status !== "mfa_required") throw new Error("double authentification attendue");
    const shown = await resumeTotpSetup(db, pendingFirst.userId);
    // Un rechargement de l'écran réaffiche la même clé.
    expect((await resumeTotpSetup(db, pendingFirst.userId)).secret).toBe(shown.secret);

    // Connexion suivante : la configuration reste à faire, la même clé est réaffichée.
    const second = await login(db, email, "mot-de-passe-de-la-planner");
    if (second.outcome !== "success") throw new Error("connexion attendue");
    const pendingSecond = await requireUser(db, second.sessionToken);
    expect(pendingSecond).toMatchObject({ status: "mfa_required", totpConfirmed: false });
    const again = await resumeTotpSetup(db, pendingFirst.userId);
    expect(again.secret).toBe(shown.secret);
    expect(again.provisioningUri).toContain(`secret=${shown.secret}`);

    const confirmed = await confirmTotp(db, { sessionToken: second.sessionToken, token: currentCodeFor(shown.secret) });
    if (confirmed.outcome !== "confirmed") throw new Error("validation attendue");
    expect((await requireUser(db, confirmed.sessionToken)).status).toBe("authenticated");

    // Une fois confirmée, la clé n'est plus jamais réaffichée : seule la vérification reste.
    const third = await login(db, email, "mot-de-passe-de-la-planner");
    if (third.outcome !== "success") throw new Error("connexion attendue");
    expect(await requireUser(db, third.sessionToken)).toMatchObject({ status: "mfa_required", totpConfirmed: true });
    await expect(resumeTotpSetup(db, pendingFirst.userId)).rejects.toThrow("déjà confirmée");
  });

  it("n'impose pas le TOTP à un rôle client (marié)", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `marie-${randomUUID()}@example.test`;
    await createUser(db, {
      organizationId: organization.id,
      email,
      password: "mot-de-passe-du-marie",
      role: "client",
    });

    const loginResult = await login(db, email, "mot-de-passe-du-marie");
    expect(loginResult.outcome).toBe("success");
    if (loginResult.outcome !== "success") return;
    expect(loginResult.requiresMfa).toBe(false);

    const result = await requireUser(db, loginResult.sessionToken);
    expect(result.status).toBe("authenticated");
  });

  it("PRD-EVT-06 — un marié qui active la double authentification la passe à chaque connexion suivante", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `marie-mfa-${randomUUID()}@example.test`;
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-du-marie", role: "client" });

    const first = await login(db, email, "mot-de-passe-du-marie");
    if (first.outcome !== "success") throw new Error("connexion attendue");
    const before = await requireUser(db, first.sessionToken);
    expect(before.status === "authenticated" && before.user.mfaEnabled).toBe(false);

    // Activation volontaire depuis son espace, sur une session déjà ouverte.
    const { secret } = await setupTotp(db, user.id);
    const activated = await confirmTotp(db, { sessionToken: first.sessionToken, token: currentCodeFor(secret) });
    if (activated.outcome !== "confirmed") throw new Error("activation attendue");
    const enabled = await requireUser(db, activated.sessionToken);
    expect(enabled.status === "authenticated" && enabled.user.mfaEnabled).toBe(true);

    const second = await login(db, email, "mot-de-passe-du-marie");
    if (second.outcome !== "success") throw new Error("connexion attendue");
    expect(second.requiresMfa).toBe(true);
    const pending = await requireUser(db, second.sessionToken);
    expect(pending).toMatchObject({ status: "mfa_required", totpConfirmed: true });

    // Le code de l'activation ne resert pas (L16-SEC-01) : celui de la période suivante.
    const next = Date.now() + 30_000;
    const reconfirmed = await confirmTotp(db, { sessionToken: second.sessionToken, token: codeAt(secret, next), now: new Date(next) });
    if (reconfirmed.outcome !== "confirmed") throw new Error("validation attendue");
    expect((await requireUser(db, reconfirmed.sessionToken)).status).toBe("authenticated");
  });

  it("PRD-EVT-06 — retrouve un compte par son e-mail, sans rien en exposer d'autre que rôle et organisation", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `compte-${randomUUID()}@example.test`;
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe", role: "client" });

    expect(await findAccountByEmail(db, email.toUpperCase())).toEqual({
      id: user.id,
      role: "client",
      organizationId: organization.id,
    });
    expect(await findAccountByEmail(db, `inconnu-${randomUUID()}@example.test`)).toBeNull();
  });

  it("refuse un mot de passe incorrect", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `test-${randomUUID()}@example.test`;
    await createUser(db, {
      organizationId: organization.id,
      email,
      password: "le-bon-mot-de-passe",
      role: "member",
    });

    const loginResult = await login(db, email, "un-mauvais-mot-de-passe");
    expect(loginResult.outcome).toBe("invalid_credentials");
  });

  it("refuse une session inexistante ou expirée", async () => {
    const result = await requireUser(db, "jeton-qui-n-existe-pas");
    expect(result.status).toBe("unauthenticated");
  });

  it("PRD-HUB-01 — prolonge la session à chaque activité (8h glissantes, pas depuis la connexion)", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `glissante-${randomUUID()}@example.test`;
    await createUser(db, {
      organizationId: organization.id,
      email,
      password: "mot-de-passe",
      role: "client", // pas de MFA requis, pour isoler le comportement de session
    });

    const loginResult = await login(db, email, "mot-de-passe");
    expect(loginResult.outcome).toBe("success");
    if (loginResult.outcome !== "success") return;

    const firstExpiry = await expiresAtFor(loginResult.sessionToken);
    await requireUser(db, loginResult.sessionToken);
    const secondExpiry = await expiresAtFor(loginResult.sessionToken);

    expect(secondExpiry.getTime()).toBeGreaterThan(firstExpiry.getTime());
  });

  it("RGPD-05 : une connexion réussie enregistre la dernière connexion ; un mot de passe faux, non", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `marie-${randomUUID()}@example.test`;
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-du-marie", role: "client" });
    const lastLogin = async () => (await db.select({ at: users.lastLoginAt }).from(users).where(eq(users.id, user.id)))[0]?.at ?? null;
    expect(await lastLogin()).toBeNull();
    await login(db, email, "mauvais-mot-de-passe");
    expect(await lastLogin()).toBeNull();
    const before = Date.now();
    expect((await login(db, email, "mot-de-passe-du-marie")).outcome).toBe("success");
    expect((await lastLogin())!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});

async function expiresAtFor(sessionToken: string): Promise<Date> {
  const [row] = await db
    .select({ expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(sessionToken)));
  if (!row) throw new Error("session introuvable");
  return row.expiresAt;
}
