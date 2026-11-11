// Lot 23 — SEC-19 : connexions, échecs, verrouillage et déconnexion au journal
// d'audit ; décision D5 : l'adresse IP est gardée à part, illisible par
// l'app, purgée après la durée réglée. PostgreSQL réel.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { purgeConnectionTraces } from "./connection-journal";
import { createOrganization, createUser, destroySession, login } from "./service";

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
  const email = `marie-${randomUUID()}@example.test`;
  const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-du-marie", role: "client" });
  return { organizationId: organization.id, userId: user.id, email };
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
  it("une connexion réussie, puis la déconnexion, au journal de l'organisation du compte", async () => {
    const account = await couple();
    const result = await login(db, account.email, "mot-de-passe-du-marie", { clientIp: "203.0.113.7" });
    if (result.outcome !== "success") throw new Error("connexion attendue");
    await destroySession(db, result.sessionToken);
    const entries = await connections(account.organizationId);
    expect(entries.map((entry) => entry.action)).toEqual(["hub.session.opened", "hub.session.closed"]);
    expect(entries[0]).toMatchObject({ actorKind: "member", actorId: account.userId, objectId: account.userId, details: { method: "password" } });
  });

  it("un mot de passe faux est un échec sans auteur ; le cinquième verrouille le compte", async () => {
    const account = await couple();
    for (let attempt = 0; attempt < 5; attempt += 1) await login(db, account.email, "mauvais-mot-de-passe");
    const entries = await connections(account.organizationId);
    expect(entries.map((entry) => entry.action)).toEqual([...Array(4).fill("hub.session.failed"), "hub.account.locked"]);
    expect(entries[0]).toMatchObject({ actorKind: "system", actorId: null, details: { reason: "password" } });
    await login(db, account.email, "mot-de-passe-du-marie");
    expect((await connections(account.organizationId)).at(-1)).toMatchObject({ action: "hub.session.failed", details: { reason: "locked" } });
  });

  it("aucune ligne pour une adresse e-mail inconnue (aucune organisation à qui l'écrire)", async () => {
    expect(await login(db, `inconnu-${randomUUID()}@example.test`, "x")).toEqual({ outcome: "invalid_credentials" });
  });
});

describe("Décision D5 — Adresse IP des connexions, à part et purgée", () => {
  it("l'adresse est gardée à part du journal, liée à sa ligne ; aucune ligne sans adresse", async () => {
    const account = await couple();
    await login(db, account.email, "mauvais-mot-de-passe", { clientIp: "198.51.100.23" });
    await login(db, account.email, "mauvais-mot-de-passe");
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
