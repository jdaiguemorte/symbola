// DEV-02, ADR 0021 — la base de DocuSeal est dédiée : son propre rôle, et
// le rôle applicatif symbola_app ne peut pas s'y connecter. PostgreSQL réel.
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseAdminEnv } from "../scripts/admin-env";
import { ensureDocusealDatabase } from "../scripts/docuseal-database";

const env = parseAdminEnv(process.env);
const suffix = randomUUID().slice(0, 8);
const target = { role: `docuseal_test_${suffix}`, password: `mdp-${randomUUID()}`, database: `docuseal_test_${suffix}`, appRole: env.POSTGRES_APP_USER };
let admin: postgres.Sql;

function connect(database: string, username: string, password: string) {
  return postgres({ host: env.POSTGRES_HOST, port: env.POSTGRES_PORT, database, username, password, max: 1, connect_timeout: 5 });
}

beforeAll(() => {
  admin = connect(env.POSTGRES_DB, env.POSTGRES_ADMIN_USER, env.POSTGRES_ADMIN_PASSWORD);
});

afterAll(async () => {
  await admin.unsafe(`DROP DATABASE IF EXISTS "${target.database}" WITH (FORCE)`);
  await admin.unsafe(`DROP ROLE IF EXISTS "${target.role}"`);
  await admin.end();
});

describe("DEV-02 — Base dédiée de DocuSeal (bootstrap, PostgreSQL réel)", () => {
  it("crée la base et son rôle sans privilège, de façon rejouable", async () => {
    await ensureDocusealDatabase(admin, target);
    await ensureDocusealDatabase(admin, target);
    const [database] = await admin<[{ owner: string }]>`
      select pg_get_userbyid(datdba) as owner from pg_database where datname = ${target.database}
    `;
    expect(database?.owner).toBe(target.role);
    const [role] = await admin<[{ rolsuper: boolean; rolbypassrls: boolean; rolcreatedb: boolean }]>`
      select rolsuper, rolbypassrls, rolcreatedb from pg_roles where rolname = ${target.role}
    `;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false, rolcreatedb: false });

    const docuseal = connect(target.database, target.role, target.password);
    await docuseal`create table probe (id int)`;
    await docuseal.end();
  });

  it("le rôle applicatif de Symbola ne peut pas se connecter à la base de DocuSeal", async () => {
    await ensureDocusealDatabase(admin, target);
    const app = connect(target.database, env.POSTGRES_APP_USER, env.POSTGRES_APP_PASSWORD);
    await expect(app`select 1`).rejects.toThrow(/permission denied/);
    await app.end().catch(() => undefined);
  });
});
