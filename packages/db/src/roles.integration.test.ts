// SOC-05 — vérifie contre un vrai PostgreSQL (pas de mock possible pour du
// RLS) que le rôle applicatif n'est ni propriétaire des tables, ni
// BYPASSRLS, et que la RLS est active et forcée sur chaque table métier.
// Lot 16 (ADR 0045) : la table témoin hello.greetings est supprimée ; le
// contrôle porte désormais sur toutes les tables des modules.
// Prérequis : socle de dev démarré + bootstrap + migrate (voir CLAUDE.md §9).
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseAdminEnv } from "../scripts/admin-env";

const env = parseAdminEnv(process.env);
let sql: postgres.Sql;

beforeAll(() => {
  sql = postgres({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    username: env.POSTGRES_ADMIN_USER,
    password: env.POSTGRES_ADMIN_PASSWORD,
    max: 1,
  });
});

afterAll(async () => {
  await sql.end();
});

describe("SOC-05 — Rôle applicatif et RLS (PostgreSQL réel)", () => {
  it("n'a ni SUPERUSER, ni CREATEDB, ni CREATEROLE, ni BYPASSRLS", async () => {
    const [role] = await sql<
      [{ rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean; rolbypassrls: boolean }]
    >`
      select rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
      from pg_roles
      where rolname = ${env.POSTGRES_APP_USER}
    `;

    expect(role).toBeDefined();
    expect(role.rolsuper).toBe(false);
    expect(role.rolcreatedb).toBe(false);
    expect(role.rolcreaterole).toBe(false);
    expect(role.rolbypassrls).toBe(false);
  });

  it("n'est propriétaire d'aucune table", async () => {
    const owned = await sql<{ table: string }[]>`
      select schemaname || '.' || tablename as table from pg_tables
      where tableowner = ${env.POSTGRES_APP_USER}
    `;

    expect(owned.map((row) => row.table)).toEqual([]);
  });

  it("a Row-Level Security activée et forcée sur chaque table métier qui porte organization_id", async () => {
    const tables = await sql<{ table: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      select n.nspname || '.' || c.relname as table, c.relrowsecurity, c.relforcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname in ('events', 'budget', 'quotes', 'vendors')
        and exists (select 1 from information_schema.columns col where col.table_schema = n.nspname and col.table_name = c.relname and col.column_name = 'organization_id')
      order by 1
    `;

    expect(tables.length).toBeGreaterThan(10);
    expect(tables.filter((table) => !table.relrowsecurity || !table.relforcerowsecurity).map((table) => table.table)).toEqual([]);
  });
});
