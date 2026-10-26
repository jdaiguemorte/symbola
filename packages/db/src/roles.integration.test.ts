// SOC-05 — vérifie contre un vrai PostgreSQL (pas de mock possible pour du
// RLS) que le rôle applicatif n'est ni propriétaire des tables, ni
// BYPASSRLS, et que la RLS est active et forcée sur hello.greetings.
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

  it("n'est pas propriétaire de hello.greetings", async () => {
    const [table] = await sql<[{ tableowner: string }]>`
      select tableowner from pg_tables where schemaname = 'hello' and tablename = 'greetings'
    `;

    expect(table.tableowner).not.toBe(env.POSTGRES_APP_USER);
  });

  it("a Row-Level Security activée et forcée sur hello.greetings", async () => {
    const [table] = await sql<[{ relrowsecurity: boolean; relforcerowsecurity: boolean }]>`
      select relrowsecurity, relforcerowsecurity
      from pg_class
      where relname = 'greetings' and relnamespace = 'hello'::regnamespace
    `;

    expect(table.relrowsecurity).toBe(true);
    expect(table.relforcerowsecurity).toBe(true);
  });
});
