// Lot 52 (SEC-08, SEC-19 ; D6 ; ADR 0094) — réception du webhook du fournisseur d'identité, contre un vrai
// PostgreSQL ; le fournisseur (clé de signature, facteurs) et l'envoi sont simulés. Un appel non signé ou
// mal signé est refusé et journalisé ; un changement d'adresse alerte l'ancienne adresse ; un appel
// rejoué n'alerte pas deux fois ; un compte inconnu ne se distingue pas d'un compte connu.
import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser, signInWithIdentity, type IdentityAlert } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { users } from "@symbola/db/schema/hub";
import { handleIdentityWebhook, type IdentityWebhookDeps } from "./identity-webhook";

const KEY = "cle-de-signature-de-test";

function call(body: object, signature: string | null = null): { headers: Headers; rawBody: string } {
  const rawBody = JSON.stringify(body);
  const headers = new Headers({ "content-type": "application/json" });
  const signed = signature === null ? createHmac("sha256", KEY).update(rawBody).digest("hex") : signature;
  if (signed) headers.set("logto-signature-sha-256", signed);
  return { headers, rawBody };
}

function deps(fingerprint: string | null = null): IdentityWebhookDeps & { sent: IdentityAlert[] } {
  const sent: IdentityAlert[] = [];
  return { sent, signingKey: async () => KEY, factorsFingerprint: async () => fingerprint, sendAlert: async (alert) => (sent.push(alert), true) };
}

async function planner() {
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`);
    const email = `planner-${randomUUID()}@example.test`;
    await createUser(db, { organizationId: organization.id, email, role: "member" });
    const subject = `sub-${randomUUID()}`;
    await signInWithIdentity(db, { subject, email, mfa: false });
    return { email, subject };
  } finally {
    await sql.end();
  }
}

// Les lignes sans organisation du journal ne se lisent que par un accès d'exploitation (SEC-09).
const admin = postgres({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "symbola",
  username: process.env.POSTGRES_ADMIN_USER ?? "postgres",
  password: process.env.POSTGRES_ADMIN_PASSWORD ?? "",
  max: 1,
  onnotice: () => {},
});

afterAll(async () => {
  await admin.end();
});

async function refusals(since: Date): Promise<number> {
  const rows = await admin<{ count: number }[]>`select count(*)::int as count from core.audit_entries where action = 'hub.identity_webhook.refused' and occurred_at >= ${since}`;
  return rows[0]!.count;
}

describe("SEC-08 (D6) — Changement d'adresse ou de facteur annoncé par le webhook signé", () => {
  it("un changement d'adresse alerte l'ancienne adresse ; l'adresse du compte devient la nouvelle", async () => {
    const account = await planner();
    const fresh = `nouvelle-${randomUUID()}@example.test`;
    const fake = deps();
    expect(await handleIdentityWebhook(call({ event: "User.Data.Updated", createdAt: new Date().toISOString(), data: { id: account.subject, primaryEmail: fresh } }), fake)).toEqual({ status: 204 });
    expect(fake.sent).toEqual([expect.objectContaining({ kind: "email", to: account.email })]);
    const { sql, db } = createAppConnection();
    try {
      expect((await db.select({ email: users.email }).from(users).where(eq(users.idpSubject, account.subject)))[0]!.email).toBe(fresh);
    } finally {
      await sql.end();
    }
  });

  it("un appel rejoué par le fournisseur n'alerte pas deux fois", async () => {
    const account = await planner();
    const body = { event: "User.Data.Updated", createdAt: new Date().toISOString(), data: { id: account.subject, primaryEmail: `n-${randomUUID()}@example.test` } };
    const fake = deps();
    await handleIdentityWebhook(call(body), fake);
    await handleIdentityWebhook(call(body), fake);
    expect(fake.sent).toHaveLength(1);
  });

  it("un facteur ajouté alerte, à partir de la deuxième empreinte ; un mot de passe réinitialisé aussi", async () => {
    const account = await planner();
    const first = deps("empreinte-1");
    await handleIdentityWebhook(call({ event: "User.Data.Updated", createdAt: "1", data: { id: account.subject, primaryEmail: account.email } }), first);
    expect(first.sent).toEqual([]);
    const second = deps("empreinte-2");
    await handleIdentityWebhook(call({ event: "User.Data.Updated", createdAt: "2", data: { id: account.subject, primaryEmail: account.email } }), second);
    expect(second.sent.map((alert) => alert.kind)).toEqual(["mfa"]);
    const reset = deps();
    await handleIdentityWebhook(call({ event: "PostResetPassword", createdAt: "3", userId: account.subject }), reset);
    expect(reset.sent.map((alert) => [alert.kind, alert.to])).toEqual([["password", account.email]]);
  });

  it("un appel non signé, ou mal signé, est refusé (401) et journalisé, sans rien changer", async () => {
    const account = await planner();
    const since = new Date(Date.now() - 1000);
    const body = { event: "User.Data.Updated", createdAt: "x", data: { id: account.subject, primaryEmail: `pirate-${randomUUID()}@example.test` } };
    const fake = deps();
    expect(await handleIdentityWebhook(call(body, ""), fake)).toEqual({ status: 401 });
    expect(await handleIdentityWebhook(call(body, "0".repeat(64)), fake)).toEqual({ status: 401 });
    expect(await handleIdentityWebhook({ ...call(body), rawBody: JSON.stringify({ ...body, data: { id: account.subject, primaryEmail: "autre@example.test" } }) }, fake)).toEqual({ status: 401 });
    expect(fake.sent).toEqual([]);
    expect(await refusals(since)).toBeGreaterThanOrEqual(3);
  });

  it("un compte inconnu de Symbola reçoit la même réponse qu'un compte connu", async () => {
    expect(await handleIdentityWebhook(call({ event: "User.Data.Updated", createdAt: "y", data: { id: `inconnu-${randomUUID()}`, primaryEmail: "x@example.test" } }), deps())).toEqual({ status: 204 });
  });
});
