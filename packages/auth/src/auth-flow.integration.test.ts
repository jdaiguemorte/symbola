// SOC-04 — flux complet contre un vrai PostgreSQL : un rôle professionnel
// sans MFA doit configurer un TOTP avant que requireUser() ne le laisse
// passer ; un rôle client (marié) y accède directement sans TOTP. Vérifie
// aussi que la session reste valide entre plusieurs appels (« navigue
// entre les modules sans se reconnecter »).
import { randomUUID } from "node:crypto";
import * as OTPAuth from "otpauth";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { confirmTotp, createOrganization, createUser, login, requireUser, setupTotp } from "./service";

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
});
