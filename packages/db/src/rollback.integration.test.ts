// Lot 15 (DB-01, ADR 0036) — migrations des lots 14 et 15 annulables, contre un
// vrai PostgreSQL, sur une base temporaire dédiée : aller (migrations), retour
// (scripts d'annulation, refus quand des données en dépendent ou dans le
// désordre), aller (migrations rejouées).
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseAdminEnv } from "../scripts/admin-env";
import { rollbackMigration, RollbackRefusedError } from "../scripts/rollback-migration";

const env = parseAdminEnv(process.env);
const database = `symbola_rollback_${randomUUID().slice(0, 8)}`;
const folders = {
  migrations: new URL("../drizzle", import.meta.url).pathname,
  rollbacks: new URL("../drizzle-rollback", import.meta.url).pathname,
};
let admin: postgres.Sql;
let target: postgres.Sql;

function connect(name: string) {
  return postgres({ host: env.POSTGRES_HOST, port: env.POSTGRES_PORT, database: name, username: env.POSTGRES_ADMIN_USER, password: env.POSTGRES_ADMIN_PASSWORD, max: 1, onnotice: () => {} });
}

async function migrateAll() {
  await migrate(drizzle(target), { migrationsFolder: folders.migrations });
}

async function entityTypes(): Promise<string[]> {
  const rows = await target<{ label: string }[]>`
    select e.enumlabel as label from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'hub' and t.typname = 'import_entity_type' order by e.enumsortorder`;
  return rows.map((row) => row.label);
}

async function hasColumn(schema: string, table: string, column: string): Promise<boolean> {
  const rows = await target`select 1 from information_schema.columns where table_schema = ${schema} and table_name = ${table} and column_name = ${column}`;
  return rows.length > 0;
}

const rollback = (tag: string) => rollbackMigration(target, tag, folders);

beforeAll(async () => {
  admin = connect(env.POSTGRES_DB);
  await admin.unsafe(`CREATE DATABASE "${database}"`);
  target = connect(database);
  await migrateAll();
}, 120_000);

afterAll(async () => {
  await target?.end();
  await admin.unsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await admin.end();
});

describe("DB-01 — Migrations des types énumérés annulables (lots 14 et 15)", () => {
  it("seule la dernière migration appliquée s'annule", async () => {
    await expect(rollback("0070_lot14_import_vendors")).rejects.toBeInstanceOf(RollbackRefusedError);
    await expect(rollback("0074_lot15_grant_import_jobs")).rejects.toBeInstanceOf(RollbackRefusedError);
    await expect(rollback("0099_inconnue")).rejects.toBeInstanceOf(RollbackRefusedError);
  });

  it("lot 16 (ADR 0045) — l'annulation de 0080 retire les types d'événement", async () => {
    await expect(rollback("0079_lot16_drop_hello")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("events", "events", "event_type_id")).toBe(true);
    await rollback("0080_lot16_event_types");
    expect(await hasColumn("events", "events", "event_type_id")).toBe(false);
    expect(await hasColumn("events", "event_types", "audience")).toBe(false);
    expect(await hasColumn("events", "events", "status")).toBe(true);
  });

  it("lot 16 (ADR 0045) — l'annulation de 0079 recrée la table témoin hello.greetings, vide", async () => {
    await expect(rollback("0078_lot16_rate_limit")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("hello", "greetings", "message")).toBe(false);
    await rollback("0079_lot16_drop_hello");
    expect(await hasColumn("hello", "greetings", "message")).toBe(true);
  });

  it("SEC-02 (lot 16) — l'annulation de 0078 retire la limitation de débit", async () => {
    await expect(rollback("0077_lot16_vendor_families")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("core", "rate_limit_events", "key_hash")).toBe(true);
    await rollback("0078_lot16_rate_limit");
    expect(await hasColumn("core", "rate_limit_events", "key_hash")).toBe(false);
  });

  it("PRE-14 (lot 16) — l'annulation de 0077 retire les familles de types ; les types restent", async () => {
    await expect(rollback("0076_lot16_trusted_devices")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("vendors", "vendor_families", "label")).toBe(true);
    expect(await hasColumn("vendors", "vendor_types", "family_id")).toBe(true);
    await rollback("0077_lot16_vendor_families");
    expect(await hasColumn("vendors", "vendor_families", "label")).toBe(false);
    for (const column of ["family_id", "starter_key"]) expect(await hasColumn("vendors", "vendor_types", column)).toBe(false);
    expect(await hasColumn("vendors", "vendor_settings", "families_seeded_at")).toBe(false);
    expect(await hasColumn("vendors", "vendor_types", "label")).toBe(true);
  });

  it("SEC-03 (lot 16) — l'annulation de 0076 retire les appareils de confiance", async () => {
    await expect(rollback("0075_lot16_mfa_protection")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("hub", "trusted_devices", "token_hash")).toBe(true);
    await rollback("0076_lot16_trusted_devices");
    expect(await hasColumn("hub", "trusted_devices", "token_hash")).toBe(false);
  });

  it("SEC-01 (lot 16) — l'annulation de 0075 retire le compteur, le verrouillage et l'anti-rejeu de la double authentification", async () => {
    expect(await hasColumn("hub", "users", "mfa_failed_attempts")).toBe(true);
    await rollback("0075_lot16_mfa_protection");
    for (const column of ["mfa_failed_attempts", "mfa_locked_until", "totp_last_used_step"]) {
      expect(await hasColumn("hub", "users", column)).toBe(false);
    }
    expect(await hasColumn("hub", "users", "totp_secret")).toBe(true);
  });

  it("un import qui utilise la valeur bloque l'annulation, sans rien modifier ; sinon le type est recréé sans elle", async () => {
    await rollback("0074_lot15_grant_import_jobs");
    await rollback("0073_lot15_import_jobs");
    const [row] = await target<{ id: string }[]>`
      insert into hub.imports (organization_id, created_by_user_id, entity_type, file_name, file_format, file_size_bytes, header_row_index, headers, row_count, expires_at)
      values (${randomUUID()}, ${randomUUID()}, 'event_sheets', 'fiche.pdf', 'pdf', 1, 0, '[]'::jsonb, 0, now())
      returning id`;
    await expect(rollback("0072_lot14_import_event_sheets")).rejects.toThrow(/event_sheets/);
    expect(await entityTypes()).toContain("event_sheets");
    expect(await hasColumn("hub", "platform_settings", "import_max_sheets")).toBe(true);

    await target`delete from hub.imports where id = ${row!.id}`;
    await rollback("0072_lot14_import_event_sheets");
    await rollback("0071_lot14_event_clients_contact");
    await rollback("0070_lot14_import_vendors");
    await rollback("0069_lot14_vendor_links");
    expect(await entityTypes()).not.toContain("event_sheets");
    expect(await entityTypes()).not.toContain("vendors");
    expect(await entityTypes()).toContain("events");
    expect(await hasColumn("events", "event_clients", "email")).toBe(false);
    expect(await hasColumn("vendors", "vendors", "siret")).toBe(false);
  });

  it("après annulation, les migrations se rejouent à l'identique", async () => {
    await migrateAll();
    expect(await entityTypes()).toEqual(expect.arrayContaining(["vendors", "event_sheets"]));
    expect(await hasColumn("hub", "import_jobs", "payload")).toBe(true);
    expect(await hasColumn("events", "event_clients", "email")).toBe(true);
    expect(await hasColumn("hub", "users", "totp_last_used_step")).toBe(true);
    expect(await hasColumn("hub", "trusted_devices", "expires_at")).toBe(true);
    const [rls] = await target<{ relforcerowsecurity: boolean }[]>`select relforcerowsecurity from pg_class where oid = 'hub.import_jobs'::regclass`;
    expect(rls?.relforcerowsecurity).toBe(true);
  });
});
