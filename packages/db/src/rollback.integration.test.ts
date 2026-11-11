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

  it("lot 23 (décision D5) — l'annulation de 0093 retire les adresses IP des connexions et leur durée", async () => {
    await expect(rollback("0092_lot23_vendors_row_stamps")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("hub", "connection_traces", "ip")).toBe(true);
    await rollback("0093_lot23_connection_traces");
    expect(await hasColumn("hub", "connection_traces", "ip")).toBe(false);
    expect(await hasColumn("hub", "platform_settings", "connection_trace_retention_months")).toBe(false);
  });

  it("lot 23 (DAT-06) — l'annulation de 0092 à 0088 retire auteurs, dates ajoutées et déclencheurs, module par module", async () => {
    const steps: [string, string, string, string][] = [
      ["0092_lot23_vendors_row_stamps", "vendors", "vendors", "0091_lot23_quotes_row_stamps"],
      ["0091_lot23_quotes_row_stamps", "quotes", "quotes", "0090_lot23_budget_row_stamps"],
      ["0090_lot23_budget_row_stamps", "budget", "budget_lines", "0089_lot23_events_row_stamps"],
      ["0089_lot23_events_row_stamps", "events", "events", "0088_lot23_hub_row_stamps"],
      ["0088_lot23_hub_row_stamps", "hub", "users", "0087_lot23_row_stamps"],
    ];
    for (const [tag, schema, table, previous] of steps) {
      await expect(rollback(previous)).rejects.toBeInstanceOf(RollbackRefusedError);
      expect(await hasColumn(schema, table, "updated_by"), tag).toBe(true);
      await rollback(tag);
      expect(await hasColumn(schema, table, "updated_by"), tag).toBe(false);
      expect(await hasColumn(schema, table, "created_at"), tag).toBe(true);
      const triggers = await target`select 1 from information_schema.triggers where event_object_schema = ${schema} and trigger_name like '%\_stamp' escape '\'`;
      expect(triggers, tag).toHaveLength(0);
    }
  });

  it("lot 23 (DAT-06) — l'annulation de 0087 retire les fonctions communes", async () => {
    await rollback("0087_lot23_row_stamps");
    const functions = await target`select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'core' and p.proname in ('stamp_row', 'stamp_created_row', 'journal_deletion')`;
    expect(functions).toHaveLength(0);
  });

  it("lot 23 (ADR 0060) — l'annulation de 0086 recrée hub.audit_log et y recopie les actions de l'Admin", async () => {
    await expect(rollback("0085_lot23_audit_entries")).rejects.toBeInstanceOf(RollbackRefusedError);
    const [adminUser] = await target<{ id: string }[]>`
      insert into hub.users (email, password_hash, role) values (${`admin-${randomUUID()}@symbola.test`}, 'x', 'admin') returning id`;
    await target`insert into core.audit_entries (actor_kind, actor_id, action, category) values ('admin', ${adminUser!.id}, 'hub.platform_settings.updated', 'administration')`;
    await target`insert into core.audit_entries (actor_kind, action, category) values ('system', 'quotes.quote.sent', 'partage')`;
    expect(await hasColumn("hub", "audit_log", "admin_user_id")).toBe(false);
    await rollback("0086_lot23_hub_audit_log_to_core");
    const copied = await target<{ action: string }[]>`select action from hub.audit_log where admin_user_id = ${adminUser!.id}`;
    expect(copied.map((row) => row.action)).toEqual(["hub.platform_settings.updated"]);
  });

  it("lot 23 (ADR 0060) — l'annulation de 0085 retire le journal commun", async () => {
    await expect(rollback("0084_lot20_tag_groups")).rejects.toBeInstanceOf(RollbackRefusedError);
    await rollback("0085_lot23_audit_entries");
    expect(await hasColumn("core", "audit_entries", "action")).toBe(false);
    expect(await hasColumn("hub", "audit_log", "action")).toBe(true);
  });

  it("lot 20 (ADR 0049) — l'annulation de 0084 retire les groupes d'étiquettes, les étiquettes restent", async () => {
    await expect(rollback("0083_lot19_request_proof")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("vendors", "vendor_tags", "group_id")).toBe(true);
    await rollback("0084_lot20_tag_groups");
    for (const column of ["group_id", "family_ids", "position"]) {
      expect(await hasColumn("vendors", "vendor_tags", column), column).toBe(false);
    }
    expect(await hasColumn("vendors", "vendor_tags", "label")).toBe(true);
    expect(await hasColumn("vendors", "vendor_tag_groups", "label")).toBe(false);
  });

  it("lot 19 (ADR 0048) — l'annulation de 0083 retire le réglage de la preuve des demandes RGPD", async () => {
    await expect(rollback("0082_lot18_privacy_cases")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("hub", "privacy_settings", "request_proof_retention_months")).toBe(true);
    await rollback("0083_lot19_request_proof");
    expect(await hasColumn("hub", "privacy_settings", "request_proof_retention_months")).toBe(false);
    expect(await hasColumn("hub", "privacy_settings", "signed_quote_retention_months")).toBe(true);
  });

  it("lot 18 (ADR 0047) — l'annulation de 0082 retire le suivi des dossiers RGPD", async () => {
    await expect(rollback("0081_lot17_documents")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("hub", "privacy_requests", "response_sent_at")).toBe(true);
    await rollback("0082_lot18_privacy_cases");
    expect(await hasColumn("hub", "privacy_requests", "response_sent_at")).toBe(false);
    expect(await hasColumn("hub", "privacy_requests", "action_done_at")).toBe(false);
    expect(await hasColumn("hub", "privacy_requests", "closed_at")).toBe(true);
  });

  it("lot 17 (ADR 0046) — l'annulation de 0081 retire la fiche et l'apparence des documents", async () => {
    await expect(rollback("0080_lot16_event_types")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("quotes", "quote_settings", "document_font")).toBe(true);
    await rollback("0081_lot17_documents");
    for (const column of ["document_color", "document_font", "iban", "bic", "quote_intro", "quote_terms", "invoice_intro", "document_footer"]) {
      expect(await hasColumn("quotes", "quote_settings", column), column).toBe(false);
    }
    for (const column of ["contact_email", "contact_phone", "website", "vat_number", "registration", "share_capital_cents"]) {
      expect(await hasColumn("hub", "organization_profiles", column), column).toBe(false);
    }
    expect(await hasColumn("quotes", "quote_settings", "invoice_mentions")).toBe(true);
    const fontType = await target`select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'quotes' and t.typname = 'document_font'`;
    expect(fontType).toHaveLength(0);
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

  it("L16-SEC-02 (lot 16) — l'annulation de 0078 retire la limitation de débit", async () => {
    await expect(rollback("0077_lot16_vendor_families")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("core", "rate_limit_events", "key_hash")).toBe(true);
    await rollback("0078_lot16_rate_limit");
    expect(await hasColumn("core", "rate_limit_events", "key_hash")).toBe(false);
  });

  it("L16-PRE-14 (lot 16) — l'annulation de 0077 retire les familles de types ; les types restent", async () => {
    await expect(rollback("0076_lot16_trusted_devices")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("vendors", "vendor_families", "label")).toBe(true);
    expect(await hasColumn("vendors", "vendor_types", "family_id")).toBe(true);
    await rollback("0077_lot16_vendor_families");
    expect(await hasColumn("vendors", "vendor_families", "label")).toBe(false);
    for (const column of ["family_id", "starter_key"]) expect(await hasColumn("vendors", "vendor_types", column)).toBe(false);
    expect(await hasColumn("vendors", "vendor_settings", "families_seeded_at")).toBe(false);
    expect(await hasColumn("vendors", "vendor_types", "label")).toBe(true);
  });

  it("L16-SEC-03 (lot 16) — l'annulation de 0076 retire les appareils de confiance", async () => {
    await expect(rollback("0075_lot16_mfa_protection")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("hub", "trusted_devices", "token_hash")).toBe(true);
    await rollback("0076_lot16_trusted_devices");
    expect(await hasColumn("hub", "trusted_devices", "token_hash")).toBe(false);
  });

  it("L16-SEC-01 (lot 16) — l'annulation de 0075 retire le compteur, le verrouillage et l'anti-rejeu de la double authentification", async () => {
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
