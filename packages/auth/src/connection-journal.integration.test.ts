// Lot 23 — SEC-19 : connexions et déconnexions au journal d'audit ; décision D5 :
// l'adresse IP est gardée à part, illisible par l'app, purgée après la durée réglée.
// Lot 33 (ADR 0067) : les échecs et les verrous se passent chez le fournisseur
// d'identité, qui les garde dans son propre journal. PostgreSQL réel.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { purgeConnectionTraces } from "./connection-journal";
import { createOrganization, createUser, destroySession, signInWithIdentity } from "./service";

const { sql, db } = createAppConnection();
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
  await sql.end();
  await admin.end();
});

async function couple() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const email = `planner-${randomUUID()}@example.test`;
  const user = await createUser(db, { organizationId: organization.id, email, role: "member" });
  return { organizationId: organization.id, userId: user.id, email };
}

async function signIn(email: string, clientIp?: string) {
  const outcome = await signInWithIdentity(db, { subject: `sub-${email}`, email, mfa: false }, { clientIp: clientIp ?? null });
  if (outcome.outcome !== "signed_in") throw new Error("session attendue");
  return outcome.sessionToken;
}

function connections(organizationId: string) {
  return withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(auditEntries)
      .where(and(eq(auditEntries.organizationId, organizationId), eq(auditEntries.category, "connexion")))
      .orderBy(auditEntries.occurredAt),
  );
}

async function tracesOf(auditEntryId: string) {
  return admin<{ ip: string }[]>`select ip from hub.connection_traces where audit_entry_id = ${auditEntryId}`;
}

describe("SEC-19 — Connexions au journal d'audit", () => {
  it("une connexion par le fournisseur, puis la déconnexion, au journal de l'organisation du compte", async () => {
    const account = await couple();
    const token = await signIn(account.email);
    await destroySession(db, token);
    const entries = await connections(account.organizationId);
    expect(entries.map((entry) => entry.action)).toEqual(["hub.session.opened", "hub.session.closed"]);
    expect(entries[0]).toMatchObject({ actorKind: "member", actorId: account.userId, objectId: account.userId, details: { method: "identity" } });
  });

  it("aucune ligne pour un jeton de session inconnu", async () => {
    const account = await couple();
    await destroySession(db, "jeton-inconnu");
    expect(await connections(account.organizationId)).toEqual([]);
  });

  it("l'adresse est gardée à part du journal, liée à sa ligne ; aucune ligne sans adresse", async () => {
    const account = await couple();
    await signIn(account.email, "198.51.100.23");
    await signIn(account.email);
    const [withIp, withoutIp] = await connections(account.organizationId);
    expect(await tracesOf(withIp!.id)).toEqual([{ ip: "198.51.100.23" }]);
    expect(await tracesOf(withoutIp!.id)).toEqual([]);
    expect(JSON.stringify(withIp)).not.toContain("198.51.100.23");
  });

  it("l'app écrit l'adresse mais ne peut pas la relire", async () => {
    await expect(sql`select ip from hub.connection_traces limit 1`).rejects.toThrow(/permission denied/);
    await expect(sql`select audit_entry_id from hub.connection_traces limit 1`).rejects.toThrow(/permission denied/);
  });

  it("la purge efface les adresses plus anciennes que la date limite, et elles seules", async () => {
    const old = randomUUID();
    const recent = randomUUID();
    await admin`insert into hub.connection_traces (audit_entry_id, ip, created_at) values (${old}, '192.0.2.1', now() - interval '13 months')`;
    await admin`insert into hub.connection_traces (audit_entry_id, ip, created_at) values (${recent}, '192.0.2.2', now() - interval '11 months')`;
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
    expect(await purgeConnectionTraces(db, cutoff)).toBeGreaterThanOrEqual(1);
    expect(await tracesOf(old)).toEqual([]);
    expect(await tracesOf(recent)).toEqual([{ ip: "192.0.2.2" }]);
  });
});
