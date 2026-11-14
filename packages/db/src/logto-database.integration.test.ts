// Lot 33, ADR 0067 — la base du fournisseur d'identité est dédiée : son propre rôle, qui peut
// créer les rôles de Logto (logto_tenant_*) mais aucun rôle privilégié ; le rôle applicatif
// symbola_app ne peut pas s'y connecter. PostgreSQL réel.
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseAdminEnv } from "../scripts/admin-env";
import { ensureDedicatedDatabase } from "../scripts/dedicated-database";

const env = parseAdminEnv(process.env);
const suffix = randomUUID().slice(0, 8);
const target = { role: `logto_test_${suffix}`, password: `mdp-${randomUUID()}`, database: `logto_test_${suffix}`, appRole: env.POSTGRES_APP_USER, createRole: true };
const createdRole = `logto_test_${suffix}_tenant`;
let admin: postgres.Sql;

function connect(database: string, username: string, password: string) {
  return postgres({ host: env.POSTGRES_HOST, port: env.POSTGRES_PORT, database, username, password, max: 1, connect_timeout: 5 });
}

beforeAll(() => {
  admin = connect(env.POSTGRES_DB, env.POSTGRES_ADMIN_USER, env.POSTGRES_ADMIN_PASSWORD);
});

afterAll(async () => {
  await admin.unsafe(`DROP DATABASE IF EXISTS "${target.database}" WITH (FORCE)`);
  await admin.unsafe(`DROP ROLE IF EXISTS "${createdRole}"`);
  await admin.unsafe(`DROP ROLE IF EXISTS "${target.role}"`);
  await admin.end();
});

describe("SEC-01 — Base dédiée du fournisseur d'identité (bootstrap, PostgreSQL réel)", () => {
  it("crée la base et son rôle, de façon rejouable : CREATEROLE seul, sans autre privilège", async () => {
    await ensureDedicatedDatabase(admin, target);
    await ensureDedicatedDatabase(admin, target);
    const [database] = await admin<[{ owner: string }]>`
      select pg_get_userbyid(datdba) as owner from pg_database where datname = ${target.database}
    `;
    expect(database?.owner).toBe(target.role);
    const [role] = await admin<[{ rolsuper: boolean; rolbypassrls: boolean; rolcreatedb: boolean; rolcreaterole: boolean }]>`
      select rolsuper, rolbypassrls, rolcreatedb, rolcreaterole from pg_roles where rolname = ${target.role}
    `;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: true });
  });

  it("son rôle crée un rôle sans privilège, mais jamais un rôle qui contourne le RLS", async () => {
    await ensureDedicatedDatabase(admin, target);
    const logto = connect(target.database, target.role, target.password);
    try {
      await logto.unsafe(`CREATE ROLE "${createdRole}" NOLOGIN`);
      await expect(logto.unsafe(`ALTER ROLE "${createdRole}" BYPASSRLS`)).rejects.toThrow(/permission denied|must have the BYPASSRLS/i);
      await expect(logto.unsafe(`CREATE ROLE "${createdRole}_super" SUPERUSER`)).rejects.toThrow(/permission denied|must be superuser/i);
    } finally {
      await logto.end();
    }
  });

  it("le rôle applicatif de Symbola ne peut pas se connecter à la base du fournisseur", async () => {
    await ensureDedicatedDatabase(admin, target);
    const app = connect(target.database, env.POSTGRES_APP_USER, env.POSTGRES_APP_PASSWORD);
    await expect(app`select 1`).rejects.toThrow(/permission denied/);
    await app.end().catch(() => undefined);
  });
});
