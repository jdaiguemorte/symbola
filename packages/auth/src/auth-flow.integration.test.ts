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
import { sessions } from "@symbola/db/schema/hub";
import {
  confirmTotp,
  createOrganization,
  createUser,
  findAccountByEmail,
  login,
  requireUser,
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
    expect(beforeMfa.hasTotpSecret).toBe(false);

    const { secret } = await setupTotp(db, beforeMfa.userId);
    const confirmed = await confirmTotp(db, {
      sessionToken: loginResult.sessionToken,
      token: currentCodeFor(secret),
    });
    expect(confirmed).toBe(true);

    const afterMfa = await requireUser(db, loginResult.sessionToken);
    expect(afterMfa.status).toBe("authenticated");
    if (afterMfa.status !== "authenticated") return;
    expect(afterMfa.user.email).toBe(email);

    // Navigue entre plusieurs « modules » sans se reconnecter : la même
    // session reste pleinement authentifiée à un second appel.
    const secondCall = await requireUser(db, loginResult.sessionToken);
    expect(secondCall.status).toBe("authenticated");
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

  it("EVT-06 — un marié qui active la double authentification la passe à chaque connexion suivante", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `marie-mfa-${randomUUID()}@example.test`;
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-du-marie", role: "client" });

    const first = await login(db, email, "mot-de-passe-du-marie");
    if (first.outcome !== "success") throw new Error("connexion attendue");
    const before = await requireUser(db, first.sessionToken);
    expect(before.status === "authenticated" && before.user.mfaEnabled).toBe(false);

    // Activation volontaire depuis son espace, sur une session déjà ouverte.
    const { secret } = await setupTotp(db, user.id);
    expect(await confirmTotp(db, { sessionToken: first.sessionToken, token: currentCodeFor(secret) })).toBe(true);
    const enabled = await requireUser(db, first.sessionToken);
    expect(enabled.status === "authenticated" && enabled.user.mfaEnabled).toBe(true);

    const second = await login(db, email, "mot-de-passe-du-marie");
    if (second.outcome !== "success") throw new Error("connexion attendue");
    expect(second.requiresMfa).toBe(true);
    const pending = await requireUser(db, second.sessionToken);
    expect(pending).toMatchObject({ status: "mfa_required", hasTotpSecret: true });

    expect(await confirmTotp(db, { sessionToken: second.sessionToken, token: currentCodeFor(secret) })).toBe(true);
    expect((await requireUser(db, second.sessionToken)).status).toBe("authenticated");
  });

  it("EVT-06 — retrouve un compte par son e-mail, sans rien en exposer d'autre que rôle et organisation", async () => {
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

  it("HUB-01 — prolonge la session à chaque activité (8h glissantes, pas depuis la connexion)", async () => {
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
});

async function expiresAtFor(sessionToken: string): Promise<Date> {
  const [row] = await db
    .select({ expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(sessionToken)));
  if (!row) throw new Error("session introuvable");
  return row.expiresAt;
}
