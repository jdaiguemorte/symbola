// Lot 24a — DAT-01 : chaque table qui porte organization_id l'a obligatoire et
// indexé (un index dont c'est la première colonne : l'isolation par la RLS
// filtre sur elle à chaque requête). PostgreSQL réel, base migrée.
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { parseAdminEnv } from "../scripts/admin-env";

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
  await admin.end();
});

// organization_id facultatif par conception, avec sa raison.
const OPTIONAL_ORGANIZATION: Record<string, string> = {
  "core.audit_entries": "les lignes d'exploitation et de plateforme sont sans organisation (ADR 0060)",
  // Lot 33 (HUB-02) : organisation active de la session.
  "hub.sessions": "la session du compte d'exploitation n'a pas d'organisation active (Q30, SEC-09)",
};

type Column = { table: string; nullable: boolean; indexed: boolean };

async function organizationColumns(): Promise<Column[]> {
  return admin<Column[]>`
    select c.table_schema || '.' || c.table_name as "table",
           c.is_nullable = 'YES' as nullable,
           exists (
             select 1
             from pg_index i
             join pg_class t on t.oid = i.indrelid
             join pg_namespace n on n.oid = t.relnamespace
             join pg_attribute a on a.attrelid = t.oid and a.attnum = i.indkey[0]
             where n.nspname = c.table_schema and t.relname = c.table_name and a.attname = 'organization_id'
           ) as indexed
    from information_schema.columns c
    join information_schema.tables tb using (table_schema, table_name)
    where tb.table_type = 'BASE TABLE' and c.column_name = 'organization_id'
    order by 1`;
}

describe("DAT-01 — organization_id obligatoire et indexé sur chaque table métier", () => {
  it("chaque table qui porte organization_id a un index qui commence par lui", async () => {
    const columns = await organizationColumns();
    expect(columns.length).toBeGreaterThan(50);
    expect(columns.filter((column) => !column.indexed).map((column) => column.table)).toEqual([]);
  });

  it("organization_id est obligatoire, sauf dans les tables où son absence a une raison écrite", async () => {
    const optional = (await organizationColumns()).filter((column) => column.nullable).map((column) => column.table);
    expect(optional.sort()).toEqual(Object.keys(OPTIONAL_ORGANIZATION).sort());
  });
});
