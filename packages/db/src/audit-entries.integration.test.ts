// Lot 23 — ARC-16 et SEC-19 : le journal d'audit commun est en ajout seul,
// pour le rôle applicatif comme pour le rôle propriétaire ; il est isolé par
// organisation (RLS) ; chaque ligne porte l'auteur du contexte (partie B).
// PostgreSQL réel (socle de dev, base migrée).
import { randomUUID } from "node:crypto";
import { eq, sql as rawSql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { parseAdminEnv } from "../scripts/admin-env";
import { withActor } from "./actor";
import { appendAudit, recordAudit } from "./audit";
import { createAppConnection } from "./client";
import { auditEntries } from "./schema/core";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();
const env = parseAdminEnv(process.env);
const admin = postgres({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  username: env.POSTGRES_ADMIN_USER,
  password: env.POSTGRES_ADMIN_PASSWORD,
  max: 1,
  onnotice: () => {},
});

afterAll(async () => {
  await sql.end();
  await admin.end();
});

async function failure(action: Promise<unknown>): Promise<string> {
  try {
    await action;
  } catch (error) {
    return String((error as { cause?: { message?: string } }).cause?.message ?? (error as Error).message);
  }
  return "aucune erreur";
}

function entriesOf(organizationId: string) {
  return withOrganization(db, organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.organizationId, organizationId)));
}

async function seedEntry(organizationId: string, isDemo = false): Promise<string> {
  const objectId = randomUUID();
  await withOrganization(db, organizationId, (tx) =>
    appendAudit(tx, { organizationId, action: "quotes.quote.sent", objectId, details: { number: "D-2027-001" }, isDemo }),
  );
  const [row] = (await entriesOf(organizationId)).filter((entry) => entry.objectId === objectId);
  return row!.id;
}

describe("ARC-16 — Journal d'audit commun en ajout seul", () => {
  it("le rôle applicatif ne peut ni modifier ni supprimer une ligne", async () => {
    const organizationId = randomUUID();
    const id = await seedEntry(organizationId);
    const update = await failure(
      withOrganization(db, organizationId, (tx) => tx.update(auditEntries).set({ action: "falsifié" }).where(eq(auditEntries.id, id))),
    );
    expect(update).toMatch(/permission denied|ajout seul/);
    // La RLS ne montre à la suppression que les lignes d'essai : rien ne part.
    const removed = await withOrganization(db, organizationId, (tx) => tx.delete(auditEntries).where(eq(auditEntries.id, id)).returning());
    expect(removed).toEqual([]);
    expect((await entriesOf(organizationId)).map((entry) => entry.action)).toEqual(["quotes.quote.sent"]);
  });

  it("le rôle propriétaire non plus : modification, suppression et vidage échouent", async () => {
    const organizationId = randomUUID();
    const id = await seedEntry(organizationId);
    await expect(admin`update core.audit_entries set action = 'falsifié' where id = ${id}`).rejects.toThrow(/ajout seul/);
    await expect(admin`delete from core.audit_entries where id = ${id}`).rejects.toThrow(/ajout seul/);
    await expect(admin`truncate core.audit_entries`).rejects.toThrow(/ajout seul/);
    expect(await entriesOf(organizationId)).toHaveLength(1);
  });

  it("une ligne d'essai guidé se purge avec l'essai, et seulement dans son organisation", async () => {
    const organizationId = randomUUID();
    const demoId = await seedEntry(organizationId, true);
    await seedEntry(organizationId);
    const other = await failure(
      withOrganization(db, randomUUID(), (tx) => tx.delete(auditEntries).where(eq(auditEntries.id, demoId)).returning()),
    );
    expect(other).toBe("aucune erreur");
    expect(await entriesOf(organizationId)).toHaveLength(2);
    await withOrganization(db, organizationId, (tx) => tx.delete(auditEntries).where(eq(auditEntries.isDemo, true)));
    expect((await entriesOf(organizationId)).map((entry) => entry.isDemo)).toEqual([false]);
  });

  it("refuse une famille inconnue et un accès d'exploitation sans motif", async () => {
    await expect(admin`insert into core.audit_entries (action, category) values ('x.y.z', 'inconnue')`).rejects.toThrow(/category_check/);
    await expect(
      admin`insert into core.audit_entries (action, category, reason) values ('ops.database.opened', 'exploitation', '  ')`,
    ).rejects.toThrow(/operations_reason_check/);
  });
});

describe("SEC-10 — Journal d'audit isolé par organisation", () => {
  it("une organisation ne lit ni n'écrit le journal d'une autre", async () => {
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    await seedEntry(organizationB);
    const seenFromA = await withOrganization(db, organizationA, (tx) =>
      tx.select().from(auditEntries).where(eq(auditEntries.organizationId, organizationB)),
    );
    expect(seenFromA).toEqual([]);
    const writeIntoB = await failure(
      withOrganization(db, organizationA, (tx) => appendAudit(tx, { organizationId: organizationB, action: "quotes.quote.sent" })),
    );
    expect(writeIntoB).toMatch(/row-level security/);
  });

  it("un accès d'exploitation se lit dans chaque organisation ; un réglage de la plateforme dans aucune", async () => {
    const marker = randomUUID();
    await recordAudit(db, { organizationId: null, action: "ops.database.opened", reason: `contrôle ${marker}`, actor: { kind: "operator", id: null } });
    await recordAudit(db, { organizationId: null, action: "hub.platform_settings.updated", objectId: marker, actor: { kind: "admin", id: randomUUID() } });
    const seen = await withOrganization(db, randomUUID(), (tx) =>
      tx.select().from(auditEntries).where(rawSql`${auditEntries.reason} = ${`contrôle ${marker}`} or ${auditEntries.objectId} = ${marker}`),
    );
    expect(seen.map((entry) => entry.action)).toEqual(["ops.database.opened"]);
    expect(seen[0]).toMatchObject({ category: "exploitation", actorKind: "operator", organizationId: null });
  });
});

describe("SEC-19 — Auteur de chaque ligne du journal", () => {
  it("prend l'auteur du contexte (withActor), sinon « system »", async () => {
    const organizationId = randomUUID();
    const memberId = randomUUID();
    await withActor({ kind: "member", id: memberId }, () =>
      withOrganization(db, organizationId, (tx) => appendAudit(tx, { organizationId, action: "quotes.quote.sent" })),
    );
    await withOrganization(db, organizationId, (tx) => appendAudit(tx, { organizationId, action: "quotes.signature.requested" }));
    const rows = await entriesOf(organizationId);
    expect(rows.find((row) => row.action === "quotes.quote.sent")).toMatchObject({ actorKind: "member", actorId: memberId, category: "partage" });
    expect(rows.find((row) => row.action === "quotes.signature.requested")).toMatchObject({ actorKind: "system", actorId: null });
  });

  it("une ligne disparaît avec le geste qui échoue (même transaction)", async () => {
    const organizationId = randomUUID();
    await failure(
      withOrganization(db, organizationId, async (tx) => {
        await appendAudit(tx, { organizationId, action: "quotes.quote.sent" });
        throw new Error("geste refusé");
      }),
    );
    expect(await entriesOf(organizationId)).toEqual([]);
  });
});
