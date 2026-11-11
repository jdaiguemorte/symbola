// Lot 23 — DAT-06 : date de création, date de modification et auteur sur
// chaque ligne ; SEC-19 : toute suppression d'une ligne métier va au journal.
// Parcourt toutes les tables de la base (aucune n'échappe sans motif écrit
// dans row-stamps.ts), puis vérifie le comportement sur PostgreSQL réel.
import { randomUUID } from "node:crypto";
import { and, eq, sql as rawSql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { withActor } from "./actor";
import { createAppConnection } from "./client";
import { APPEND_ONLY_TABLES, DELETION_NOT_JOURNALED, TECHNICAL_TABLES } from "./row-stamps";
import { auditEntries } from "./schema/core";
import { programTemplateItems, programTemplates, prospectSources } from "./schema/events";
import { invitations, organizations } from "./schema/hub";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

const SCHEMAS = ["core", "hub", "events", "budget", "quotes", "vendors"];

async function tables(): Promise<Map<string, Set<string>>> {
  const rows = await sql<{ name: string; column: string }[]>`
    select c.table_schema || '.' || c.table_name as name, c.column_name as column
    from information_schema.columns c
    join information_schema.tables t using (table_schema, table_name)
    where c.table_schema in ${sql(SCHEMAS)} and t.table_type = 'BASE TABLE'`;
  const result = new Map<string, Set<string>>();
  for (const row of rows) result.set(row.name, (result.get(row.name) ?? new Set()).add(row.column));
  return result;
}

async function triggers(): Promise<Map<string, string>> {
  const rows = await sql<{ name: string; trigger: string; action: string }[]>`
    select event_object_schema || '.' || event_object_table as name, trigger_name as trigger, action_statement as action
    from information_schema.triggers where event_object_schema in ${sql(SCHEMAS)}`;
  return new Map(rows.map((row) => [`${row.name}/${row.trigger}`, row.action]));
}

const alice = { kind: "member" as const, id: randomUUID() };
const bruno = { kind: "member" as const, id: randomUUID() };

function journal(organizationId: string) {
  return withOrganization(db, organizationId, (tx) =>
    tx.select().from(auditEntries).where(and(eq(auditEntries.organizationId, organizationId), eq(auditEntries.category, "suppression"))),
  );
}

describe("DAT-06 — Dates et auteur sur chaque ligne", () => {
  it("chaque table a ses quatre colonnes et son déclencheur, sauf exception motivée", async () => {
    const all = await tables();
    const installed = await triggers();
    const unexplained: string[] = [];
    for (const [name, columns] of all) {
      if (name in TECHNICAL_TABLES) continue;
      const table = name.split(".")[1];
      const appendOnly = APPEND_ONLY_TABLES[name];
      const required = appendOnly ? ["created_by", appendOnly.createdAtColumn] : ["created_at", "created_by", "updated_at", "updated_by"];
      for (const column of required) if (!columns.has(column)) unexplained.push(`${name} : colonne ${column}`);
      const stamp = installed.get(`${name}/${table}_stamp`) ?? "";
      if (!stamp.includes(appendOnly ? "stamp_created_row" : "stamp_row")) unexplained.push(`${name} : déclencheur ${table}_stamp`);
      if (!(name in DELETION_NOT_JOURNALED) && !installed.has(`${name}/${table}_journal_deletion`)) {
        unexplained.push(`${name} : suppression non journalisée`);
      }
    }
    expect(unexplained).toEqual([]);
    for (const name of [...Object.keys(TECHNICAL_TABLES), ...Object.keys(APPEND_ONLY_TABLES)]) expect(all.has(name), name).toBe(true);
  });

  it("l'auteur de la création et celui de la dernière modification sont ceux du contexte ; created_* ne se réécrit pas", async () => {
    const organizationId = randomUUID();
    const [created] = await withActor(alice, () =>
      withOrganization(db, organizationId, (tx) => tx.insert(prospectSources).values({ organizationId, label: "Salon" }).returning()),
    );
    expect(created).toMatchObject({ createdBy: alice.id, updatedBy: alice.id });

    const [updated] = await withActor(bruno, () =>
      withOrganization(db, organizationId, (tx) =>
        tx
          .update(prospectSources)
          .set({ label: "Salon du mariage", createdBy: bruno.id, createdAt: new Date("2020-01-01") })
          .where(eq(prospectSources.id, created!.id))
          .returning(),
      ),
    );
    expect(updated).toMatchObject({ label: "Salon du mariage", createdBy: alice.id, updatedBy: bruno.id });
    expect(updated!.createdAt.getTime()).toBe(created!.createdAt.getTime());
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created!.updatedAt.getTime());
  });

  it("une tâche de fond laisse l'auteur vide (« Symbola ») ; une date de modification fixée par l'appelant est gardée", async () => {
    const organizationId = randomUUID();
    const [row] = await withActor(alice, () =>
      withOrganization(db, organizationId, (tx) => tx.insert(prospectSources).values({ organizationId, label: "Bouche-à-oreille" }).returning()),
    );
    const simulated = new Date("2027-03-26T01:30:00Z");
    const [updated] = await withOrganization(db, organizationId, (tx) =>
      tx.update(prospectSources).set({ label: "Recommandation", updatedAt: simulated }).where(eq(prospectSources.id, row!.id)).returning(),
    );
    expect(updated).toMatchObject({ createdBy: alice.id, updatedBy: null });
    expect(updated!.updatedAt.toISOString()).toBe(simulated.toISOString());
  });
});

describe("SEC-19 — Suppressions journalisées", () => {
  it("une suppression laisse une ligne au journal, avec son auteur et l'objet supprimé", async () => {
    const organizationId = randomUUID();
    const [row] = await withOrganization(db, organizationId, (tx) => tx.insert(prospectSources).values({ organizationId, label: "Instagram" }).returning());
    await withActor(bruno, () => withOrganization(db, organizationId, (tx) => tx.delete(prospectSources).where(eq(prospectSources.id, row!.id))));
    expect(await journal(organizationId)).toMatchObject([
      { action: "events.prospect_sources.deleted", objectType: "events.prospect_sources", objectId: row!.id, actorKind: "member", actorId: bruno.id },
    ]);
  });

  it("une suppression en cascade ne journalise que l'objet supprimé", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, async (tx) => {
      const [template] = await tx.insert(programTemplates).values({ organizationId, name: "Cérémonie laïque" }).returning();
      await tx.insert(programTemplateItems).values([
        { organizationId, templateId: template!.id, startTime: "15:00", label: "Accueil" },
        { organizationId, templateId: template!.id, startTime: "15:30", label: "Échange des vœux" },
      ]);
      await tx.delete(programTemplates).where(eq(programTemplates.id, template!.id));
    });
    expect((await journal(organizationId)).map((entry) => entry.action)).toEqual(["events.program_templates.deleted"]);
  });

  it("une purge en masse (app.audit_bulk) n'écrit pas une ligne par ligne effacée", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, async (tx) => {
      await tx.insert(prospectSources).values([{ organizationId, label: "A" }, { organizationId, label: "B" }]);
      await tx.execute(rawSql`select set_config('app.audit_bulk', 'on', true)`);
      await tx.delete(prospectSources).where(eq(prospectSources.organizationId, organizationId));
    });
    expect(await journal(organizationId)).toEqual([]);
  });

  it("une table du hub supprimée hors contexte d'organisation journalise dans l'organisation de la ligne", async () => {
    const [organization] = await db.insert(organizations).values({ name: `Org ${randomUUID()}` }).returning();
    const [invitation] = await db
      .insert(invitations)
      .values({ organizationId: organization!.id, email: `invitation-${randomUUID()}@example.test`, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) })
      .returning();
    await db.delete(invitations).where(eq(invitations.id, invitation!.id));
    expect((await journal(organization!.id)).map((entry) => entry.objectId)).toEqual([invitation!.id]);
  });
});
