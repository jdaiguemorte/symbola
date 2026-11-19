// Lot 15 (DB-01, ADR 0036) — migrations des lots 14 et 15 annulables, contre un
// vrai PostgreSQL, sur une base temporaire dédiée : aller (migrations), retour
// (scripts d'annulation, refus quand des données en dépendent ou dans le
// désordre), aller (migrations rejouées).
import { randomBytes, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseAdminEnv } from "../scripts/admin-env";
import { runDataSteps } from "../scripts/data-steps";
import { readJournal, rollbackMigration, RollbackRefusedError } from "../scripts/rollback-migration";

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

// Lot 33a : annuler 0129 est refusé tant qu'un compte n'a ni mot de passe ni rôle, ce qui est le
// cas de tous une fois 0130 passée (voulu en vrai). Pour remonter la chaîne des lots plus anciens,
// le banc d'essai remet des valeurs d'avant juste avant d'annuler 0129.
const rollback = async (tag: string) => {
  if (tag === "0129_lot33a_hub_memberships" && (await hasColumn("hub", "users", "password_hash"))) {
    await target`update hub.users set password_hash = 'x' where password_hash is null`;
    await target`update hub.users set role = 'member' where role is null and not operator`;
  }
  return rollbackMigration(target, tag, folders);
};

// Lots 26a à 29b : migrations au-dessus de celles du 28, annulées pour revenir à 0108.
// Lot 47 : prestataires par lien (0162, events), natures d'e-mails des prestataires (0163, hub),
// engagé libéré à l'historique du budget (0164, budget).
const LOT_47 = ["0164_lot47_budget_history_release", "0163_lot47_hub_vendor_email_kinds", "0162_lot47_events_vendor_coordination"];
// Lot 41 : Factur-X et réforme (0154, quotes), adresse du vendeur et TVA sur les débits (0155, hub).
// Lot 50 : plan de table et synthèse pour le traiteur (0159, guests).
// Lot 44 : formulaire de contact et pipeline (0160, events), nature d'e-mail « Nouvelle demande de
// contact » (0161, hub) ; plus récentes que celle du lot 50, elles s'annulent d'abord.
// Lot 43 : proposition et règlement (0167, quotes), payeurs (0168, budget), natures d'e-mails (0169,
// hub) ; les plus récentes, elles s'annulent d'abord.
const LOT_43 = ["0169_lot43_hub_settlement_email_kinds", "0168_lot43_budget_payers", "0167_lot43_quotes_proposal_settlement"];
const LOT_44 = ["0161_lot44_hub_prospect_email_kind", "0160_lot44_events_pipeline_contact"];
// Lot 51 : remises du jour J (0166, budget), jour J de terrain et temps fort de chaque séquence (0165,
// events) ; les plus récentes (après celles du lot 47), elles s'annulent d'abord.
// Lot 45 : messages, relances et questionnaires (0170, events), doublons et fusions de contacts (0171,
// hub), natures d'e-mails de réponse, de relance et de questionnaire (0172, hub) ; les plus récentes de
// toutes, elles s'annulent d'abord.
const LOT_45 = ["0172_lot45_hub_prospect_email_kinds", "0171_lot45_hub_contact_duplicates", "0170_lot45_events_relation_prospects"];
// Lot 48a : IBAN et BIC de la planner chiffrés (0176, quotes, avec son étape de données), notes de
// contact (0175, hub) et d'évènement (0174, events) confidentielles, pièces, IBAN et lieux des
// prestataires (0173, vendors) ; les plus récentes de toutes, elles s'annulent d'abord.
// Lot 48b : honoraires, commissions, modes par ligne, nature des modèles, facture de commission (0177,
// quotes) ; plus récente que celles du lot 48a, elle s'annule d'abord.
// Lot 52 : équipe et accès (0178, hub), équipe d'évènement et renfort du jour J (0179, events), natures
// d'e-mails (0180, hub) ; les plus récentes de toutes, elles s'annulent d'abord.
// Lot 35b : reprise d'un export (0184, hub) et ancre de la chaîne des pièces reprise (0185, quotes) ;
// les plus récentes de toutes, elles s'annulent d'abord.
// Lot 35c : fermeture des espaces (0186, hub et socle) et pièces effaçables au jour de la suppression
// (0187, quotes) ; les plus récentes de toutes, elles s'annulent d'abord.
// Lot 58 : clôture, modèles, évaluations, exports comptables (0188 à 0190) ; les plus récentes, elles
// s'annulent avant celles du lot 35c.
const LOT_58 = ["0190_lot58_quotes_accounting_exports", "0189_lot58_vendors_evaluations", "0188_lot58_events_closing_templates"];
const LOT_35C = ["0187_lot35c_quotes_erasable_pieces", "0186_lot35c_hub_organization_closures"];
const LOT_35B = ["0185_lot35b_quotes_ledger_anchors", "0184_lot35b_hub_organization_imports"];
const LOT_53 = ["0183_lot53_hub_notification_email_kinds", "0182_lot53_events_tasks_vocabulary", "0181_lot53_hub_notifications"];
const LOT_52 = ["0180_lot52_hub_team_email_kinds", "0179_lot52_events_team_day_helper", "0178_lot52_hub_team_access"];
const LOT_48B = ["0177_lot48b_quotes_fees_commissions_modes"];
const LOT_48A = ["0176_lot48a_quotes_sealed_bank_details", "0175_lot48a_hub_confidential_contact_notes", "0174_lot48a_events_confidential_notes", "0173_lot48a_vendors_documents_bank_venue"];
const LOT_51 = ["0166_lot51_budget_handovers", "0165_lot51_events_day_of"];
const LOT_50 = ["0159_lot50_guests_seating"];
const LOT_41 = ["0155_lot41_hub_seller_address_vat_debits", "0154_lot41_quotes_facturx"];
// Lot 49 : module Invités (0153), natures d'e-mails des invités (0152), durées de purge (0151),
// temps forts (0150).
const LOT_49 = ["0153_lot49_guests", "0152_lot49_hub_guest_email_kinds", "0151_lot49_hub_guest_retention", "0150_lot49_events_key_moments"];
// Lot 46 : migration hub des natures d'e-mails de rendez-vous (0158), droits et RLS (0157), module
// Rendez-vous (0156).
const LOT_46 = ["0158_lot46_hub_email_template_kinds", "0157_lot46_grant_appointments", "0156_lot46_appointments"];
const LOT_40B = ["0149_lot40b_hub_jobs"];
const LOT_39B = ["0148_lot39b_hub_form_drafts"];
const LOT_39A = ["0147_lot39a_budget_soft_delete", "0146_lot39a_quotes_soft_delete", "0145_lot39a_hub_soft_delete", "0144_lot39a_events_soft_delete"];
const LOT_38B = ["0143_lot38b_hub_messages_calendar"];
const LOT_38A = ["0142_lot38a_hub_email_templates", "0141_lot38a_events_program_notified"];
const LOT_37B = ["0140_lot37b_quotes_file_sizes", "0139_lot37b_hub_storage_snapshots", "0138_lot37b_events_program_versions"];
const LOT_37A = ["0137_lot37a_events_documents"];
const LOT_36B = ["0136_lot36b_contacts_members"];
const LOT_36A = ["0135_lot36a_contacts"];
// 0140 à 0138 (lot 37b), 0137 (lot 37a), puis 0136 (ses liens pointent vers les contacts), puis 0135.
const LOT_36 = [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49, ...LOT_40B, ...LOT_39B, ...LOT_39A, ...LOT_38B, ...LOT_38A, ...LOT_37B, ...LOT_37A, ...LOT_36B, ...LOT_36A];
const LOT_35A = ["0134_lot35a_hub_organization_exports"];
const LOT_34B = ["0133_lot34b_events_fiche_tasks"];
const LOT_34A = ["0132_lot34a_events_lifecycle"];
const LOT_33B = ["0131_lot33b_hub_onboarding"];
const LOT_33A = ["0130_lot33a_hub_drop_passwords", "0129_lot33a_hub_memberships"];
const LOT_33 = [...LOT_36, ...LOT_35A, ...LOT_34B, ...LOT_34A, ...LOT_33B, ...LOT_33A];
const LOT_32A = ["0128_lot32a_events_activity_vendor", "0127_lot32a_events_activity_vendor_kind"];
const LOT_31C = ["0126_lot31c_quotes_payment_terms_receipts", "0125_lot31c_quotes_receipt_series"];
const LOT_31B = ["0124_lot31b_hub_contract_retention", "0123_lot31b_quotes_contracts", "0122_lot31b_quotes_client_kind"];
const LOT_31A = ["0121_lot31a_hub_professional_mentions", "0120_lot31a_quotes_sections_options_templates"];
const LOT_30B = "0119_lot30b_events_program_responsible";
const LOT_30A = "0118_lot30a_events_day_contacts";
const LOT_29B = "0117_lot29b_events_documents";
const LOT_27B = "0116_lot27b_events_decisions";
const LOT_27A = ["0115_lot27a_budget_payment_declarations", "0114_lot27a_events_task_reminders"];
const LOT_26B = "0113_lot26b_events_vendor_links";
const LOT_26 = [...LOT_33, ...LOT_32A, ...LOT_31C, ...LOT_31B, ...LOT_31A, LOT_30B, LOT_30A, LOT_29B, LOT_27B, ...LOT_27A, LOT_26B, "0112_lot26a_events_drop_client_accesses", "0111_lot26a_hub_roles_notice", "0110_lot26a_core_link_actor", "0109_lot26a_events_links"];
async function rollbackLot26() {
  for (const tag of LOT_26) await rollback(tag);
}

async function roles(): Promise<string[]> {
  const rows = await target<{ label: string }[]>`
    select e.enumlabel as label from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'hub' and t.typname = 'role' order by e.enumsortorder`;
  return rows.map((row) => row.label);
}

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

// Lot 47 : chaque test remonte la chaîne des annulations, qui s'allonge à chaque lot ; la limite par
// défaut (5 s) ne suffit plus sur un poste chargé.
describe("DB-01 — Migrations des types énumérés annulables (lots 14 et 15)", { timeout: 60_000 }, () => {
  it("lot 58 (PAR-09, EVT-08, PRE-08, FAC-11 ; ADR 0097) — 0188 à 0190 : clôture, archivage, modèles d'évènement, évaluations et exports comptables ; annulation refusée tant que des données en dépendent, puis tout est retiré", async () => {
    await migrateAll();
    const organizationId = randomUUID();
    const [event] = await target<{ id: string }[]>`insert into events.events (organization_id, archived_at) values (${organizationId}, now()) returning id`;
    // Le budget figé va avec la clôture ; une demande d'avis a sa nature.
    await expect(target`insert into events.event_closings (organization_id, event_id, closed_at) values (${organizationId}, ${event!.id}, now())`).rejects.toThrow(/event_closings_closed_check/);
    await expect(target`insert into events.event_closings (organization_id, event_id, review_requested_at) values (${organizationId}, ${event!.id}, now())`).rejects.toThrow(/event_closings_review_check/);
    await target`insert into events.event_closings (organization_id, event_id, lessons) values (${organizationId}, ${event!.id}, ${["Plan B pluie"]})`;
    await expect(target`insert into events.closing_settings (organization_id, review_url) values (${organizationId}, 'http://avis.example.test')`).rejects.toThrow(/closing_settings_review_url_check/);
    await target`insert into events.event_templates (organization_id, name, content) values (${organizationId}, 'Mariage champêtre', ${JSON.stringify({ version: 1 })}::jsonb)`;
    const [vendor] = await target<{ id: string }[]>`insert into vendors.vendors (organization_id, name) values (${organizationId}, 'Maison Haddad') returning id`;
    await expect(target`insert into vendors.vendor_evaluations (organization_id, vendor_id, event_id, rating) values (${organizationId}, ${vendor!.id}, ${event!.id}, 6)`).rejects.toThrow(/vendor_evaluations_rating_check/);
    await target`insert into vendors.vendor_evaluations (organization_id, vendor_id, event_id, rating, quality) values (${organizationId}, ${vendor!.id}, ${event!.id}, 4, 5)`;
    await expect(target`insert into quotes.accounting_exports (organization_id, format, period_kind, period_start, period_end, status, invoiced_cents, credited_cents, received_cents, document_count) values (${organizationId}, 'xlsx', 'month', '2027-01-01', '2027-01-31', 'done', 0, 0, 0, 0)`).rejects.toThrow(/accounting_exports_format_check/);
    await target`insert into quotes.accounting_exports (organization_id, format, period_kind, period_start, period_end, status, invoiced_cents, credited_cents, received_cents, document_count) values (${organizationId}, 'fec', 'year', '2027-01-01', '2027-12-31', 'done', 120000, 0, 120000, 1)`;
    await target`insert into quotes.accounting_export_settings (organization_id, fiscal_year_start_month) values (${organizationId}, 7)`;
    await expect(rollback(LOT_58[0]!)).rejects.toThrow(/exports comptables ont été demandés/);
    await target`delete from quotes.accounting_exports where organization_id = ${organizationId}`;
    await expect(rollback(LOT_58[0]!)).rejects.toThrow(/réglages d'export comptable/);
    await target`delete from quotes.accounting_export_settings where organization_id = ${organizationId}`;
    await rollback(LOT_58[0]!);
    await expect(rollback(LOT_58[1]!)).rejects.toThrow(/évaluations de prestataires/);
    await target`delete from vendors.vendor_evaluations where organization_id = ${organizationId}`;
    await rollback(LOT_58[1]!);
    await expect(rollback(LOT_58[2]!)).rejects.toThrow(/clôtures d'évènement/);
    await target`delete from events.event_closings where organization_id = ${organizationId}`;
    await expect(rollback(LOT_58[2]!)).rejects.toThrow(/modèles d'évènement/);
    await target`delete from events.event_templates where organization_id = ${organizationId}`;
    await expect(rollback(LOT_58[2]!)).rejects.toThrow(/évènements sont archivés/);
    await target`update events.events set archived_at = null where id = ${event!.id}`;
    await rollback(LOT_58[2]!);
    for (const name of ["events.event_closings", "events.closing_settings", "events.event_templates", "vendors.vendor_evaluations", "quotes.accounting_exports", "quotes.accounting_export_settings"]) {
      const [table] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(table!.name, name).toBeNull();
    }
    const [column] = await target<{ count: number }[]>`select count(*)::int as count from information_schema.columns where table_schema = 'events' and table_name = 'events' and column_name in ('archived_at', 'archived_by')`;
    expect(column!.count).toBe(0);
    await target`delete from vendors.vendors where id = ${vendor!.id}`;
    await target`delete from events.events where id = ${event!.id}`;
    await migrateAll();
  });

  it("lot 35c (RGP-11, D8 ; ADR 0100) — 0186 et 0187 : fermeture, effacement refusé avant la date, permis après (pièces comprises) ; annulation refusée tant qu'un espace est fermé, puis tout est retiré", async () => {
    await migrateAll();
    for (const tag of LOT_58) await rollback(tag);
    const organizationId = randomUUID();
    await target`insert into hub.organizations (id, name) values (${organizationId}, 'Atelier')`;
    // Une fermeture plus courte que 29 jours est refusée par la contrainte.
    await expect(target`update hub.organizations set closed_at = now(), deletion_due_at = now() + interval '3 days' where id = ${organizationId}`).rejects.toThrow(/organizations_closure_check/);
    await target`update hub.organizations set closed_at = now(), deletion_due_at = now() + interval '30 days' where id = ${organizationId}`;
    await target`insert into events.events (organization_id) values (${organizationId})`;
    await expect(target`select core.erase_organization_schema(${organizationId}::uuid, 'events')`).rejects.toThrow(/non supprimable/);
    await expect(target`select core.erase_organization_schema(${organizationId}::uuid, 'pg_catalog')`).rejects.toThrow(/non effaçable/);
    await rollback(LOT_35C[0]!);
    await expect(rollback(LOT_35C[1]!)).rejects.toThrow(/espaces sont fermés/);
    // À la date : effacement permis, l'organisation part.
    await target`update hub.organizations set closed_at = now() - interval '31 days', deletion_due_at = now() - interval '1 hour' where id = ${organizationId}`;
    await migrateAll();
    await target.begin(async (tx) => {
      await tx`select set_config('app.organization_id', ${organizationId}, true)`;
      const [erased] = await tx`select core.erase_organization_schema(${organizationId}::uuid, 'events') as deleted`;
      expect(Number(erased!.deleted)).toBe(1);
      await tx`select core.erase_organization_identity(${organizationId}::uuid, '{}'::uuid[])`;
    });
    const [gone] = await target`select count(*)::int as count from hub.organizations where id = ${organizationId}`;
    expect(gone!.count).toBe(0);
    for (const tag of [...LOT_58, ...LOT_35C]) await rollback(tag);
    expect(await hasColumn("hub", "organizations", "closed_at")).toBe(false);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('hub.organization_closures')::text as name`;
    expect(table!.name).toBeNull();
    const [fn] = await target<{ name: string | null }[]>`select to_regprocedure('core.erase_organization_schema(uuid, text)')::text as name`;
    expect(fn!.name).toBeNull();
    await migrateAll();
  });

  it("lot 35b (HUB-13, D7 ; ADR 0098) — 0184 et 0185 : reprises d'un export et ancre de la chaîne des pièces ; la première écriture s'accroche à l'ancre, la vérification part d'elle ; l'ancre ne change plus ; annulées, tout est retiré et la chaîne repart de 64 zéros", async () => {
    await migrateAll();
    const organizationId = randomUUID();
    const source = randomUUID();
    const tip = "ab".repeat(32);
    await expect(target`insert into quotes.ledger_anchors (organization_id, previous_hash, source_organization_id, source_last_sequence, source_entries) values (${organizationId}, 'pas-une-empreinte', ${source}, 3, 3)`).rejects.toThrow(/ledger_anchors_previous_hash_check/);
    await target`insert into quotes.ledger_anchors (organization_id, previous_hash, source_organization_id, source_last_sequence, source_entries) values (${organizationId}, ${tip}, ${source}, 3, 3)`;
    await expect(target`update quotes.ledger_anchors set previous_hash = ${"cd".repeat(32)} where organization_id = ${organizationId}`).rejects.toThrow(/pièce inaltérable/);
    const objectId = randomUUID();
    await target.begin(async (tx) => {
      await tx`select set_config('app.ledger_import', 'on', true)`;
      await tx`select quotes.chain_piece(${organizationId}::uuid, 'payment', ${objectId}::uuid, '{"kind":"received"}'::jsonb, false)`;
    });
    const [first] = await target<{ sequence: string; previous_hash: string; is_backfill: boolean }[]>`select sequence, previous_hash, is_backfill from quotes.ledger_entries where organization_id = ${organizationId}`;
    expect(first).toMatchObject({ sequence: "1", previous_hash: tip, is_backfill: true });
    const anomalies = await target<{ anomaly: string }[]>`select anomaly from quotes.verify_ledger(${organizationId}::uuid)`;
    // La pièce n'existe pas (écriture de test) ; le lien avec l'ancre, lui, est juste.
    expect(anomalies.map((row) => row.anomaly)).toEqual(["object_missing"]);
    await target`insert into hub.organization_imports (organization_id, requested_by_user_id) values (${organizationId}, ${randomUUID()})`;
    await expect(target`insert into hub.organization_imports (organization_id, requested_by_user_id) values (${organizationId}, ${randomUUID()})`).rejects.toThrow(/organization_imports_active_idx/);
    await expect(target`update hub.organization_imports set error = 'inconnue' where organization_id = ${organizationId}`).rejects.toThrow(/organization_imports_error_check/);
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B]) await rollback(tag);
    for (const name of ["hub.organization_imports", "quotes.ledger_anchors"]) {
      const [table] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(table!.name, name).toBeNull();
    }
    const other = randomUUID();
    await target`select quotes.chain_piece(${other}::uuid, 'payment', ${randomUUID()}::uuid, '{}'::jsonb, false)`;
    const [genesis] = await target<{ previous_hash: string }[]>`select previous_hash from quotes.ledger_entries where organization_id = ${other}`;
    expect(genesis!.previous_hash).toBe("0".repeat(64));
    await migrateAll();
  });

  it("lot 53 (HUB-15, HUB-28, GC-02, CHR-10, CHR-05, HUB-24 ; ADR 0095) — 0181 à 0183 : notifications, push, automatismes, radar, tâches hors évènement, termes des clients et natures d'e-mails ; annulation refusée tant que des données en dépendent, puis tout est retiré", async () => {
    await migrateAll();
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B]) await rollback(tag);
    const organizationId = randomUUID();
    const [user] = await target<{ id: string }[]>`insert into hub.users (email) values (${`lot53-${organizationId}@example.test`}) returning id`;
    // Une notification ne mène qu'à un écran de l'app ; une sorte inconnue est refusée.
    await expect(target`insert into hub.notifications (organization_id, user_id, type, object_key, href) values (${organizationId}, ${user!.id}, 'quote_signed', 'q1', 'https://ailleurs.test')`).rejects.toThrow(/notifications_href_check/);
    await expect(target`insert into hub.notifications (organization_id, user_id, type, object_key, href) values (${organizationId}, ${user!.id}, 'inconnue', 'q1', '/accueil')`).rejects.toThrow(/notifications_type_check/);
    await target`insert into hub.notifications (organization_id, user_id, type, object_key, href) values (${organizationId}, ${user!.id}, 'quote_signed', 'q1', '/devis')`;
    await expect(target`insert into hub.notifications (organization_id, user_id, type, object_key, href) values (${organizationId}, ${user!.id}, 'quote_signed', 'q1', '/devis')`).rejects.toThrow(/notifications_object_idx/);
    await expect(target`insert into hub.push_subscriptions (organization_id, user_id, endpoint, p256dh, auth, device_label) values (${organizationId}, ${user!.id}, 'http://push.example.test/1', ${"a".repeat(87)}, ${"b".repeat(22)}, 'Mac')`).rejects.toThrow(/push_subscriptions_endpoint_check/);
    await target`insert into hub.automations (organization_id, key, enabled) values (${organizationId}, 'rsvp_reminder', false)`;
    await target`insert into hub.risk_rules (organization_id, rule, enabled, threshold_days) values (${organizationId}, 'vendor_without_contract', true, 30)`;
    // Une tâche hors évènement : ni date relative, ni jalon ; une répétition, seulement hors évènement.
    const [event] = await target<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
    await expect(target`insert into events.event_tasks (organization_id, event_id, label, due_date, recurrence) values (${organizationId}, ${event!.id}, 'Acompte', '2027-01-10', 'monthly')`).rejects.toThrow(/event_tasks_recurrence_check/);
    await expect(target`insert into events.event_tasks (organization_id, label, due_date, offset_days) values (${organizationId}, 'TVA', '2027-01-10', -30)`).rejects.toThrow(/event_tasks_standalone_check/);
    const [task] = await target<{ id: string }[]>`insert into events.event_tasks (organization_id, label, due_date, recurrence) values (${organizationId}, 'Déclaration de TVA', '2027-01-10', 'monthly') returning id`;
    const [eventType] = await target<{ id: string }[]>`insert into events.event_types (organization_id, label) values (${organizationId}, 'Séminaire') returning id`;
    await expect(target`insert into events.event_type_vocabulary (organization_id, event_type_id, locale, term, gender, number) values (${organizationId}, ${eventType!.id}, 'fr', '  ', 'masculine', 'singular')`).rejects.toThrow(/event_type_vocabulary_term_check/);
    await target`insert into events.event_type_vocabulary (organization_id, event_type_id, locale, term, gender, number) values (${organizationId}, ${eventType!.id}, 'fr', 'le commanditaire', 'masculine', 'singular')`;
    const [template] = await target<{ id: string }[]>`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'payment_due_reminder', 'fr', 'Rappel', 'Montant {{montant}}') returning id`;
    await expect(rollback(LOT_53[0]!)).rejects.toThrow(/récapitulatif, de rappel J-7 ou d'alerte/);
    await target`delete from hub.email_templates where id = ${template!.id}`;
    await rollback(LOT_53[0]!);
    await expect(target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'daily_digest', 'fr', 'Objet', 'Texte')`).rejects.toThrow(/email_templates_kind_check/);
    await target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'questionnaire_sent', 'fr', 'Objet', 'Voir {{lien}}')`;
    await target`delete from hub.email_templates where organization_id = ${organizationId}`;
    await expect(rollback(LOT_53[1]!)).rejects.toThrow(/tâches hors évènement/);
    await target`delete from events.event_tasks where id = ${task!.id}`;
    await expect(rollback(LOT_53[1]!)).rejects.toThrow(/termes des clients/);
    await target`delete from events.event_type_vocabulary where organization_id = ${organizationId}`;
    await rollback(LOT_53[1]!);
    await expect(target`insert into events.event_tasks (organization_id, label, due_date) values (${organizationId}, 'TVA', '2027-01-10')`).rejects.toThrow(/event_id/);
    await expect(rollback(LOT_53[2]!)).rejects.toThrow(/automatismes sont coupés/);
    await target`update hub.automations set enabled = true where organization_id = ${organizationId}`;
    await rollback(LOT_53[2]!);
    for (const name of ["hub.notifications", "hub.notification_settings", "hub.notification_preferences", "hub.push_subscriptions", "hub.automations", "hub.automation_runs", "hub.risk_rules", "events.event_type_vocabulary", "events.planning_health_settings"]) {
      const [table] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(table!.name, name).toBeNull();
    }
    await target`delete from events.event_types where organization_id = ${organizationId}`;
    await target`delete from events.events where id = ${event!.id}`;
    await target`delete from hub.users where id = ${user!.id}`;
    await migrateAll();
  });

  it("lot 52 (HUB-04, HUB-05, EVT-06, SEC-08 ; ADR 0094) — 0178 à 0180 : comptable, appareils, transfert, équipe d'évènement, renfort du jour J et natures d'e-mails ; annulation refusée tant qu'un modèle personnalisé existe, puis tout est retiré", async () => {
    await migrateAll();
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53]) await rollback(tag);
    const organizationId = randomUUID();
    await target`insert into hub.organizations (id, name) values (${organizationId}, 'Atelier')`;
    const [visibility] = await target<{ all_planners_see_all_events: boolean }[]>`select all_planners_see_all_events from hub.organizations where id = ${organizationId}`;
    // D2 : activé par défaut, rien ne change pour la pilote.
    expect(visibility!.all_planners_see_all_events).toBe(true);
    const [owner] = await target<{ id: string }[]>`insert into hub.users (email) values (${`p-${organizationId}@example.test`}) returning id`;
    const [accountant] = await target<{ id: string }[]>`insert into hub.users (email) values (${`c-${organizationId}@example.test`}) returning id`;
    await target`insert into hub.memberships (user_id, organization_id, role) values (${owner!.id}, ${organizationId}, 'owner'), (${accountant!.id}, ${organizationId}, 'accountant')`;
    await target`insert into hub.sessions (user_id, organization_id, token_hash, expires_at, device_label, device_id, last_seen_at) values (${accountant!.id}, ${organizationId}, ${`h-${organizationId}`}, now() + interval '1 hour', 'Safari sur iPhone', 'appareil-1', now())`;
    await target`insert into hub.known_devices (user_id, device_id, device_label) values (${owner!.id}, 'appareil-1', 'Firefox sur Mac')`;
    await target`insert into hub.ownership_transfers (organization_id, from_user_id, to_user_id, token_hash, expires_at) values (${organizationId}, ${owner!.id}, ${accountant!.id}, ${`t1-${organizationId}`}, now() + interval '7 days')`;
    // Une seule demande en cours par organisation.
    await expect(target`insert into hub.ownership_transfers (organization_id, from_user_id, to_user_id, token_hash, expires_at) values (${organizationId}, ${owner!.id}, ${accountant!.id}, ${`t2-${organizationId}`}, now() + interval '7 days')`).rejects.toThrow(/ownership_transfers_pending_unique/);
    await expect(target`insert into hub.identity_change_alerts (user_id, kind, delivery_key) values (${owner!.id}, 'phone', ${`k-${organizationId}`})`).rejects.toThrow(/identity_change_alerts_kind_check/);
    await target`insert into hub.identity_change_alerts (user_id, kind, delivery_key, previous_email) values (${owner!.id}, 'email', ${`k-${organizationId}`}, 'ancienne@example.test')`;
    const [event] = await target<{ id: string }[]>`insert into events.events (organization_id, event_date) values (${organizationId}, '2027-06-12') returning id`;
    await target`insert into events.event_team_members (organization_id, event_id, user_id, role) values (${organizationId}, ${event!.id}, ${owner!.id}, 'lead')`;
    // Un seul planner principal par évènement.
    await expect(target`insert into events.event_team_members (organization_id, event_id, user_id, role) values (${organizationId}, ${event!.id}, ${randomUUID()}, 'lead')`).rejects.toThrow(/event_team_members_one_lead/);
    await expect(target`insert into events.event_team_members (organization_id, event_id, user_id, role) values (${organizationId}, ${event!.id}, ${randomUUID()}, 'guest')`).rejects.toThrow(/event_team_members_role_check/);
    // Le renfort n'a aucune rubrique du portail et demande un code à l'ouverture.
    await expect(target`insert into events.event_links (organization_id, event_id, audience, person_name, email, rubrics, otp_required) values (${organizationId}, ${event!.id}, 'day_helper', 'Hugo', 'hugo@example.test', array['budget'], true)`).rejects.toThrow(/event_links_day_helper_check/);
    await expect(target`insert into events.event_links (organization_id, event_id, audience, person_name, email) values (${organizationId}, ${event!.id}, 'day_helper', 'Hugo', 'hugo@example.test')`).rejects.toThrow(/event_links_day_helper_check/);
    const [helper] = await target<{ id: string }[]>`insert into events.event_links (organization_id, event_id, audience, person_name, email, phone, otp_required) values (${organizationId}, ${event!.id}, 'day_helper', 'Hugo', 'hugo@example.test', '0612345678', true) returning id`;
    const [item] = await target<{ id: string }[]>`insert into events.program_items (organization_id, event_id, start_time, label) values (${organizationId}, ${event!.id}, '16:00', 'Cérémonie') returning id`;
    // Un pointage a un seul auteur : un compte, ou le lien du renfort.
    await expect(target`insert into events.day_checkpoints (organization_id, event_id, program_item_id, kind, device_at, user_id, link_id, action_id) values (${organizationId}, ${event!.id}, ${item!.id}, 'started', now(), ${owner!.id}, ${helper!.id}, ${randomUUID()})`).rejects.toThrow(/day_checkpoints_author_check/);
    await target`insert into events.day_checkpoints (organization_id, event_id, program_item_id, kind, device_at, link_id, action_id) values (${organizationId}, ${event!.id}, ${item!.id}, 'started', now(), ${helper!.id}, ${randomUUID()})`;
    await target`insert into events.day_incidents (organization_id, event_id, body, device_at, link_id, action_id) values (${organizationId}, ${event!.id}, 'Retard du traiteur', now(), ${helper!.id}, ${randomUUID()})`;
    const [template] = await target<{ id: string }[]>`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'day_helper_link', 'fr', 'Votre accès du jour J', 'Voir {{lien}}') returning id`;
    await expect(rollback(LOT_52[0]!)).rejects.toThrow(/renfort du jour J personnalisés/);
    await target`delete from hub.email_templates where id = ${template!.id}`;
    await rollback(LOT_52[0]!);
    await expect(target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'new_device_login', 'fr', 'Objet', 'Texte')`).rejects.toThrow(/email_templates_kind_check/);
    await rollback(LOT_52[1]!);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('events.event_team_members')::text as name`;
    expect(table!.name).toBeNull();
    const links = await target<{ id: string }[]>`select id from events.event_links where organization_id = ${organizationId}`;
    expect(links).toEqual([]);
    expect(await target`select 1 from events.day_checkpoints where organization_id = ${organizationId}`).toHaveLength(0);
    expect(await target`select 1 from events.day_incidents where organization_id = ${organizationId}`).toHaveLength(0);
    expect(await hasColumn("events", "event_links", "phone")).toBe(false);
    await rollback(LOT_52[2]!);
    // Le comptable ne devient jamais Planner : son adhésion et sa session disparaissent.
    const memberships = await target<{ user_id: string; role: string }[]>`select user_id, role::text from hub.memberships where organization_id = ${organizationId}`;
    expect(memberships).toEqual([{ user_id: owner!.id, role: "owner" }]);
    expect(await target`select 1 from hub.sessions where organization_id = ${organizationId}`).toHaveLength(0);
    for (const name of ["hub.known_devices", "hub.ownership_transfers", "hub.identity_change_alerts"]) {
      const [gone] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(gone!.name, name).toBeNull();
    }
    await expect(target`insert into hub.memberships (user_id, organization_id, role) values (${accountant!.id}, ${organizationId}, 'accountant')`).rejects.toThrow(/invalid input value for enum/);
    expect(await hasColumn("hub", "sessions", "device_id")).toBe(false);
    expect(await hasColumn("hub", "organizations", "all_planners_see_all_events")).toBe(false);
    await target`delete from events.program_items where event_id = ${event!.id}`;
    await target`delete from events.events where id = ${event!.id}`;
    await target`delete from hub.memberships where organization_id = ${organizationId}`;
    await target`delete from hub.users where id in (${owner!.id}, ${accountant!.id})`;
    await migrateAll();
  });

  it("lot 48b (BUD-08, PRE-07, JUR-10 ; ADR 0093) — 0177 : facture de commission sans devis, une par commission ; annulation refusée tant qu'une commission, des honoraires, un mode intermédiaire ou un modèle non contrat existent, puis tout est retiré", async () => {
    await migrateAll();
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52]) await rollback(tag);
    const organizationId = randomUUID();
    const [commission] = await target<{ id: string }[]>`insert into quotes.vendor_commissions (organization_id, event_id, vendor_name, amount_cents) values (${organizationId}, ${randomUUID()}, 'Fleurs', 45000) returning id`;
    await expect(target`insert into quotes.vendor_commissions (organization_id, event_id, vendor_name, amount_cents, percent_basis_points, base_cents) values (${organizationId}, ${randomUUID()}, 'Fleurs', 45000, 1000, 100)`).rejects.toThrow(/vendor_commissions_amount_check/);
    await expect(target`insert into quotes.planner_fees (organization_id, event_id, kind, flat_cents, percent_basis_points) values (${organizationId}, ${randomUUID()}, 'flat', 1000, 500)`).rejects.toThrow(/planner_fees_terms_check/);
    await expect(rollback(LOT_48B[0]!)).rejects.toThrow(/commissions ou des honoraires/);
    await target`delete from quotes.vendor_commissions where id = ${commission!.id}`;
    await rollback(LOT_48B[0]!);
    for (const name of ["quotes.vendor_commissions", "quotes.planner_fees"]) {
      const [table] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(table!.name, name).toBeNull();
    }
    expect(await hasColumn("quotes", "quote_lines", "supply_mode")).toBe(false);
    await migrateAll();
  });

  it("lot 48a (PRE-05, PRE-10, SEC-27, DAT-08 ; ADR 0093) — 0173 à 0176 : IBAN de la planner chiffré par l'étape de données, remis en clair par l'annulation ; pièces, IBAN et notes confidentielles refusent l'annulation tant qu'ils existent", async () => {
    await migrateAll();
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52]) await rollback(tag);
    const key = randomBytes(32).toString("base64");
    const keyEnv = { DATA_ENCRYPTION_KEY: key };
    const journal = readJournal(folders.migrations);
    // Lot 48b : sa migration, plus récente, s'annule d'abord.
    for (const tag of LOT_48B) await rollback(tag);
    // Une organisation d'avant le lot : IBAN et BIC en clair.
    await rollbackMigration(target, LOT_48A[0]!, folders, keyEnv);
    const organizationId = randomUUID();
    await target`insert into quotes.quote_settings (organization_id, iban, bic) values (${organizationId}, 'FR7630006000011234567890189', 'AGRIFRPP')`;
    await migrateAll();
    await runDataSteps(target, keyEnv, journal);
    const [sealed] = await target<{ iban: string | null; bic: string | null; iban_sealed: string | null; bic_sealed: string | null }[]>`select iban, bic, iban_sealed, bic_sealed from quotes.quote_settings where organization_id = ${organizationId}`;
    expect(sealed).toMatchObject({ iban: null, bic: null });
    expect(sealed!.iban_sealed).toMatch(/^f1:/);
    expect(JSON.stringify(sealed)).not.toContain("30006000011234567890189");
    // Rejouable : une seconde passe ne change rien.
    await runDataSteps(target, keyEnv, journal);
    const [again] = await target<{ iban_sealed: string | null }[]>`select iban_sealed from quotes.quote_settings where organization_id = ${organizationId}`;
    expect(again!.iban_sealed).toBe(sealed!.iban_sealed);
    // migrateAll a remis le lot 52 et le lot 48b au-dessus : ils s'annulent d'abord.
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B]) await rollback(tag);
    // Sans la clé, l'annulation ne perd rien : elle est refusée.
    await expect(rollbackMigration(target, LOT_48A[0]!, folders, {})).rejects.toThrow(/DATA_ENCRYPTION_KEY/);
    await rollbackMigration(target, LOT_48A[0]!, folders, keyEnv);
    const [plain] = await target<{ iban: string | null; bic: string | null }[]>`select iban, bic from quotes.quote_settings where organization_id = ${organizationId}`;
    expect(plain).toEqual({ iban: "FR7630006000011234567890189", bic: "AGRIFRPP" });
    await target`delete from quotes.quote_settings where organization_id = ${organizationId}`;
    // Notes confidentielles : l'annulation est refusée tant qu'il en reste.
    const [contact] = await target<{ id: string }[]>`insert into hub.contacts (organization_id, first_name) values (${organizationId}, 'Léa') returning id`;
    const authorId = randomUUID();
    await expect(target`insert into hub.contact_notes (organization_id, contact_id, author_user_id, body, is_confidential, body_sealed) values (${organizationId}, ${contact!.id}, ${authorId}, 'en clair', true, 'f1:x')`).rejects.toThrow(/contact_notes_body_check/);
    await target`insert into hub.contact_notes (organization_id, contact_id, author_user_id, is_confidential, body_sealed) values (${organizationId}, ${contact!.id}, ${authorId}, true, 'f1:x')`;
    await expect(rollback(LOT_48A[1]!)).rejects.toThrow(/notes de contact sont confidentielles/);
    await target`delete from hub.contact_notes where contact_id = ${contact!.id}`;
    await rollback(LOT_48A[1]!);
    await target`delete from hub.contacts where id = ${contact!.id}`;
    const [event] = await target<{ id: string }[]>`insert into events.events (organization_id, notes_sealed, notes_confidential_by) values (${organizationId}, 'f1:x', ${authorId}) returning id`;
    await expect(rollback(LOT_48A[2]!)).rejects.toThrow(/notes d'évènement sont confidentielles/);
    await target`delete from events.events where id = ${event!.id}`;
    await rollback(LOT_48A[2]!);
    // Pièces, journal des IBAN, IBAN chiffré : refus tant qu'ils existent.
    const [vendor] = await target<{ id: string }[]>`insert into vendors.vendors (organization_id, name, iban_sealed, iban_masked) values (${organizationId}, 'Fleurs', 'f1:x', 'FR76 •••• •••• 0189') returning id`;
    await expect(target`insert into vendors.vendors (organization_id, name, iban_sealed) values (${organizationId}, 'Sans masque', 'f1:x')`).rejects.toThrow(/vendors_sealed_fields_check/);
    const [kind] = await target<{ id: string }[]>`insert into vendors.vendor_document_kinds (organization_id, label) values (${organizationId}, 'Assurance') returning id`;
    await expect(target`insert into vendors.vendor_documents (organization_id, vendor_id, kind_id, status) values (${organizationId}, ${vendor!.id}, ${kind!.id}, 'verified')`).rejects.toThrow(/vendor_documents_file_check/);
    await target`insert into vendors.vendor_documents (organization_id, vendor_id, kind_id, status) values (${organizationId}, ${vendor!.id}, ${kind!.id}, 'requested')`;
    await expect(target`insert into vendors.vendor_bank_changes (organization_id, vendor_id, next_masked) values (${organizationId}, ${vendor!.id}, 'FR76 •••• •••• 0189')`).rejects.toThrow(/vendor_bank_changes_author_check/);
    await target`insert into vendors.vendor_bank_changes (organization_id, vendor_id, next_masked, changed_by_link_id) values (${organizationId}, ${vendor!.id}, 'FR76 •••• •••• 0189', ${randomUUID()})`;
    await expect(rollback(LOT_48A[3]!)).rejects.toThrow(/pièces sont rangées/);
    await target`delete from vendors.vendor_documents where vendor_id = ${vendor!.id}`;
    await expect(rollback(LOT_48A[3]!)).rejects.toThrow(/changements d'IBAN sont tracés/);
    await target`delete from vendors.vendor_bank_changes where vendor_id = ${vendor!.id}`;
    await expect(rollback(LOT_48A[3]!)).rejects.toThrow(/IBAN ou des notes confidentielles/);
    await target`delete from vendors.vendors where id = ${vendor!.id}`;
    await target`delete from vendors.vendor_document_kinds where id = ${kind!.id}`;
    await rollback(LOT_48A[3]!);
    for (const name of ["vendors.vendor_documents", "vendors.vendor_document_kinds", "vendors.vendor_bank_changes"]) {
      const [table] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(table!.name, name).toBeNull();
    }
    expect(await hasColumn("quotes", "quote_settings", "iban_sealed")).toBe(false);
    expect(await hasColumn("vendors", "vendors", "iban_sealed")).toBe(false);
    await migrateAll();
  });

  it("lot 45 (CRM-05 à CRM-09, POR-07 ; ADR 0090) — 0170 à 0172 : messages, relances, questionnaires, doublons, fusions et natures d'e-mails ; annulation refusée tant que des données en dépendent, puis tout est retiré", async () => {
    await migrateAll();
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A]) await rollback(tag);
    const organizationId = randomUUID();
    const [event] = await target<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
    const [first] = await target<{ id: string }[]>`insert into hub.contacts (organization_id, first_name, phone) values (${organizationId}, 'Léa', '0612345678') returning id`;
    const [second] = await target<{ id: string }[]>`insert into hub.contacts (organization_id, first_name, phone) values (${organizationId}, 'Lea', '+33612345678') returning id`;
    const [low, high] = [first!.id, second!.id].sort();
    await expect(target`insert into hub.contact_duplicates (organization_id, first_contact_id, second_contact_id, reason) values (${organizationId}, ${high!}, ${low!}, 'phone')`).rejects.toThrow(/contact_duplicates_order_check/);
    await target`insert into hub.contact_duplicates (organization_id, first_contact_id, second_contact_id, reason) values (${organizationId}, ${low!}, ${high!}, 'phone')`;
    const [merge] = await target<{ id: string }[]>`insert into hub.contact_merges (organization_id, kept_contact_id, absorbed_contact_id, fields_from_absorbed) values (${organizationId}, ${first!.id}, ${second!.id}, array['phone']) returning id`;
    // Une réponse « a répondu » se note, elle ne s'envoie pas ; un message se prépare ou s'envoie.
    await expect(target`insert into events.event_messages (organization_id, event_id, kind, delivery) values (${organizationId}, ${event!.id}, 'answered', 'sent')`).rejects.toThrow(/event_messages_delivery_check/);
    const [message] = await target<{ id: string }[]>`insert into events.event_messages (organization_id, event_id, contact_id, kind, delivery, subject, body) values (${organizationId}, ${event!.id}, ${first!.id}, 'reply', 'sent', 'Bonjour', 'Merci') returning id`;
    await expect(target`insert into events.prospect_follow_ups (organization_id, event_id, anchor_message_id, rank, ready_at, subject, body) values (${organizationId}, ${event!.id}, ${message!.id}, 4, now(), 'Relance', 'Texte')`).rejects.toThrow(/prospect_follow_ups_rank_check/);
    await target`insert into events.prospect_follow_ups (organization_id, event_id, anchor_message_id, rank, ready_at, subject, body) values (${organizationId}, ${event!.id}, ${message!.id}, 1, now(), 'Relance', 'Texte')`;
    await expect(target`insert into events.prospect_follow_ups (organization_id, event_id, anchor_message_id, rank, ready_at, subject, body) values (${organizationId}, ${event!.id}, ${message!.id}, 1, now(), 'Relance', 'Texte')`).rejects.toThrow(/prospect_follow_ups_anchor_rank_idx/);
    const [questionnaire] = await target<{ id: string }[]>`insert into events.event_questionnaires (organization_id, event_id, template_version, name, locale, questions) values (${organizationId}, ${event!.id}, 1, 'Découverte', 'fr', '[{"key":"guests"}]'::jsonb) returning id`;
    await target`insert into events.event_links (organization_id, event_id, audience, person_name, email, rubrics) values (${organizationId}, ${event!.id}, 'client', 'Léa', 'lea@example.test', array['questionnaires'])`;
    const [template] = await target<{ id: string }[]>`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'questionnaire_sent', 'fr', 'Questionnaire', 'Voir {{lien}}') returning id`;
    await expect(rollback(LOT_45[0]!)).rejects.toThrow(/réponse, de relance ou de questionnaire/);
    await target`delete from hub.email_templates where id = ${template!.id}`;
    await rollback(LOT_45[0]!);
    await expect(target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'prospect_reply', 'fr', 'Objet', 'Texte')`).rejects.toThrow(/email_templates_kind_check/);
    await target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'prospect_form_received', 'fr', 'Objet', 'Voir {{lien}}')`;
    await target`delete from hub.email_templates where organization_id = ${organizationId}`;
    await expect(rollback(LOT_45[1]!)).rejects.toThrow(/fusions de contacts sont tracées/);
    await target`delete from hub.contact_merges where id = ${merge!.id}`;
    await rollback(LOT_45[1]!);
    await expect(rollback(LOT_45[2]!)).rejects.toThrow(/messages sont rangés/);
    await target`delete from events.event_messages where id = ${message!.id}`;
    await expect(rollback(LOT_45[2]!)).rejects.toThrow(/questionnaires ont été envoyés/);
    await target`delete from events.event_questionnaires where id = ${questionnaire!.id}`;
    await expect(rollback(LOT_45[2]!)).rejects.toThrow(/rubrique « Questionnaires »/);
    await target`delete from events.event_links where organization_id = ${organizationId}`;
    await rollback(LOT_45[2]!);
    for (const name of ["events.event_messages", "events.prospect_follow_ups", "events.prospect_follow_up_settings", "events.questionnaire_templates", "events.questionnaire_template_items", "events.event_questionnaires", "events.questionnaire_answers", "hub.contact_duplicates", "hub.contact_merges"]) {
      const [table] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(table!.name, name).toBeNull();
    }
    await expect(target`insert into events.event_links (organization_id, event_id, audience, person_name, email, rubrics) values (${organizationId}, ${event!.id}, 'client', 'Léa', 'lea@example.test', array['questionnaires'])`).rejects.toThrow(/event_links_rubrics_check/);
    await target`delete from hub.contacts where organization_id = ${organizationId}`;
    await target`delete from events.events where id = ${event!.id}`;
    await migrateAll();
  });

  it("lot 44 (CRM-01, CRM-02 ; ADR 0084) — 0160 et 0161 : étapes, formulaire, demandes et nature d'e-mail ; annulation refusée tant que des demandes, des passages d'étape, un historique sans auteur ou un modèle personnalisé existent, puis tout est retiré", async () => {
    await migrateAll();
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47]) await rollback(tag);
    const organizationId = randomUUID();
    const [stage] = await target<{ id: string }[]>`insert into events.pipeline_stages (organization_id, label) values (${organizationId}, 'Nouvelle demande') returning id`;
    const [event] = await target<{ id: string }[]>`insert into events.events (organization_id, pipeline_stage_id) values (${organizationId}, ${stage!.id}) returning id`;
    await expect(target`insert into events.contact_forms (organization_id, slug) values (${organizationId}, 'Pas Valide')`).rejects.toThrow(/contact_forms_slug_check/);
    await expect(target`insert into events.contact_forms (organization_id, slug, privacy_policy_url) values (${organizationId}, 'atelier', 'http://non-chiffre.test')`).rejects.toThrow(/contact_forms_privacy_url_check/);
    await expect(target`insert into events.contact_forms (organization_id, slug, hidden_fields) values (${organizationId}, 'atelier', array['email'])`).rejects.toThrow(/contact_forms_hidden_fields_check/);
    await target`insert into events.contact_forms (organization_id, slug, allowed_origins) values (${organizationId}, 'atelier-test', array['https://a.test'])`;
    await expect(target`insert into events.prospect_requests (organization_id, state) values (${organizationId}, 'received')`).rejects.toThrow(/prospect_requests_state_check/);
    const [request] = await target<{ id: string }[]>`insert into events.prospect_requests (organization_id, event_id, state, message) values (${organizationId}, ${event!.id}, 'received', 'Bonjour') returning id`;
    const [history] = await target<{ id: string }[]>`insert into events.event_status_history (organization_id, event_id, to_status) values (${organizationId}, ${event!.id}, 'option') returning id`;
    const [activity] = await target<{ id: string }[]>`insert into events.event_activities (organization_id, event_id, kind, task_label) values (${organizationId}, ${event!.id}, 'stage_changed', 'Rendez-vous') returning id`;
    const [template] = await target<{ id: string }[]>`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'prospect_form_received', 'fr', 'Nouvelle demande', 'Voir {{lien}}') returning id`;
    await expect(rollback(LOT_44[0]!)).rejects.toThrow(/Nouvelle demande de contact/);
    await target`delete from hub.email_templates where id = ${template!.id}`;
    await rollback(LOT_44[0]!);
    await expect(target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'prospect_form_received', 'fr', 'Objet', 'Voir {{lien}}')`).rejects.toThrow(/email_templates_kind_check/);
    await expect(rollback(LOT_44[1]!)).rejects.toThrow(/demandes de contact existent encore/);
    await target`delete from events.prospect_requests where id = ${request!.id}`;
    await expect(rollback(LOT_44[1]!)).rejects.toThrow(/passages d'étape/);
    await target`delete from events.event_activities where id = ${activity!.id}`;
    await expect(rollback(LOT_44[1]!)).rejects.toThrow(/sans auteur/);
    await target`delete from events.event_status_history where id = ${history!.id}`;
    await rollback(LOT_44[1]!);
    expect(await hasColumn("events", "events", "pipeline_stage_id")).toBe(false);
    for (const name of ["events.pipeline_stages", "events.contact_forms", "events.prospect_requests"]) {
      const [table] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(table!.name).toBeNull();
    }
    await expect(target`insert into events.event_status_history (organization_id, event_id, to_status) values (${organizationId}, ${event!.id}, 'option')`).rejects.toThrow(/changed_by_user_id/);
    await target`delete from events.events where id = ${event!.id}`;
    await migrateAll();
  });

  it("lot 43 (FAC-02, FAC-08, FAC-09, FAC-15, BUD-06 ; ADR 0089) — 0167 à 0169 : références sans donnée personnelle, une relance par rang, parts en pourcentage ou en montant, quatre natures d'e-mails ; annulation refusée tant qu'un modèle personnalisé existe, puis tout est retiré", async () => {
    await migrateAll();
    // Lot 45 : ses migrations, plus récentes, s'annulent d'abord.
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45]) await rollback(tag);
    const organizationId = randomUUID();
    const [quote] = await target<{ id: string }[]>`insert into quotes.quotes (organization_id, event_id, number, created_by_user_id) values (${organizationId}, ${randomUUID()}, 'D-2027-0001', ${randomUUID()}) returning id`;
    const [version] = await target<{ id: string }[]>`insert into quotes.quote_versions (organization_id, quote_id, version) values (${organizationId}, ${quote!.id}, 1) returning id`;
    const [item] = await target<{ id: string }[]>`insert into quotes.payment_schedule_items (organization_id, version_id, label, percentage_basis_points, due_date) values (${organizationId}, ${version!.id}, 'Acompte', 3000, '2027-01-10') returning id`;
    // Une référence suit « SYM-<année>-<six caractères> », sans nom ni lettre ambiguë.
    await expect(target`insert into quotes.payment_references (organization_id, schedule_item_id, reference) values (${organizationId}, ${item!.id}, 'SYM-2027-MARTIN')`).rejects.toThrow(/payment_references_reference_check/);
    await expect(target`insert into quotes.payment_references (organization_id, schedule_item_id, reference) values (${organizationId}, ${item!.id}, 'SYM-2027-7KQ4XO')`).rejects.toThrow(/payment_references_reference_check/);
    await target`insert into quotes.payment_references (organization_id, schedule_item_id, reference) values (${organizationId}, ${item!.id}, 'SYM-2027-7KQ4XM')`;
    // Une déclaration est complète ou absente ; une suspension a son motif.
    await expect(target`update quotes.payment_references set declared_at = now() where schedule_item_id = ${item!.id}`).rejects.toThrow(/payment_references_declaration_check/);
    await expect(target`update quotes.payment_references set reminders_suspended_at = now(), reminders_suspension_reason = ' ' where schedule_item_id = ${item!.id}`).rejects.toThrow(/payment_references_suspension_check/);
    await target`insert into quotes.payment_reminders (organization_id, schedule_item_id, rank, due_on, sent_at) values (${organizationId}, ${item!.id}, 1, '2027-01-13', now())`;
    await expect(target`insert into quotes.payment_reminders (organization_id, schedule_item_id, rank, due_on, sent_at) values (${organizationId}, ${item!.id}, 1, '2027-01-13', now())`).rejects.toThrow(/payment_reminders_item_rank_unique/);
    await expect(target`update quotes.quote_settings set payment_reminder_days = array[0, 10] where false`).resolves.toBeDefined();
    await expect(target`insert into quotes.quote_settings (organization_id, payment_reminder_days) values (${organizationId}, array[0, 10])`).rejects.toThrow(/quote_settings_payment_reminder_days_check/);
    await expect(target`insert into quotes.proposal_templates (organization_id, greeting, blocks) values (${organizationId}, 'Bonjour', array['greeting'])`).rejects.toThrow(/proposal_templates_blocks_check/);
    await target`insert into quotes.proposal_templates (organization_id, greeting, blocks) values (${organizationId}, 'Bonjour', array['greeting', 'quote'])`;
    await expect(target`insert into quotes.proposal_templates (organization_id, greeting, blocks) values (${organizationId}, 'Encore', array['quote'])`).rejects.toThrow(/proposal_templates_organization_event_type_unique/);
    const eventId = randomUUID();
    const [line] = await target<{ id: string }[]>`insert into budget.budget_lines (organization_id, event_id, event_vendor_slot_id, label) values (${organizationId}, ${eventId}, ${randomUUID()}, 'Traiteur') returning id`;
    const [payer] = await target<{ id: string }[]>`insert into budget.event_payers (organization_id, event_id, name, kind) values (${organizationId}, ${eventId}, 'Famille Martin', 'family_one') returning id`;
    await expect(target`insert into budget.event_payers (organization_id, event_id, name, kind) values (${organizationId}, ${eventId}, 'Banque', 'bank')`).rejects.toThrow(/event_payers_kind_check/);
    await expect(target`insert into budget.budget_line_payer_shares (organization_id, line_id, payer_id, percentage_basis_points, amount_cents) values (${organizationId}, ${line!.id}, ${payer!.id}, 5000, 100)`).rejects.toThrow(/budget_line_payer_shares_value_check/);
    await target`insert into budget.budget_line_payer_shares (organization_id, line_id, payer_id, percentage_basis_points) values (${organizationId}, ${line!.id}, ${payer!.id}, 5000)`;
    await target`insert into budget.planner_instalment_payers (organization_id, event_id, schedule_item_id, payer_id) values (${organizationId}, ${eventId}, ${item!.id}, ${payer!.id})`;
    for (const kind of ["proposal_sent", "proposal_expiry_reminder", "payment_details", "invoice_reminder"]) {
      await target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, ${kind}, 'fr', 'Objet', 'Texte')`;
    }
    await expect(rollback(LOT_43[0]!)).rejects.toThrow(/proposition ou de règlement personnalisés/);
    await target`delete from hub.email_templates where organization_id = ${organizationId}`;
    await rollback(LOT_43[0]!);
    await expect(target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'invoice_reminder', 'fr', 'Objet', 'Texte')`).rejects.toThrow(/email_templates_kind_check/);
    await target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'prospect_form_received', 'fr', 'Objet', 'Voir {{lien}}')`;
    await target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'vendor_brief', 'fr', 'Objet', 'Voir {{lien}}')`;
    await target`delete from hub.email_templates where organization_id = ${organizationId}`;
    await rollback(LOT_43[1]!);
    expect(await hasColumn("budget", "vendor_payments", "payer_id")).toBe(false);
    await rollback(LOT_43[2]!);
    expect(await hasColumn("quotes", "quote_versions", "proposal_greeting")).toBe(false);
    expect(await hasColumn("quotes", "quote_settings", "payment_reminder_days")).toBe(false);
    for (const name of ["quotes.proposal_templates", "quotes.payment_references", "quotes.payment_reminders", "budget.event_payers", "budget.budget_line_payer_shares", "budget.planner_instalment_payers"]) {
      const [table] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(table!.name).toBeNull();
    }
    await target`delete from budget.budget_lines where id = ${line!.id}`;
    await target`delete from quotes.payment_schedule_items where id = ${item!.id}`;
    await target`delete from quotes.quote_versions where id = ${version!.id}`;
    await target`delete from quotes.quotes where id = ${quote!.id}`;
    await migrateAll();
  });

  it("lot 51 (EVT-04, JRJ-05 à JRJ-09 ; ADR 0091) — 0165 et 0166 : chaque évènement daté qui a un programme garde son chrono le jour de l'évènement, dans un temps fort existant ou créé de lui-même ; l'annulation est refusée tant que le jour J a laissé une trace, puis retire tout", async () => {
    await migrateAll();
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51]) await rollback(tag);
    expect(await hasColumn("events", "program_items", "key_moment_id")).toBe(false);
    const organizationId = randomUUID();
    await target`insert into hub.organizations (id, name, language) values (${organizationId}, 'Atelier', 'en')`;
    // Un mariage d'un jour avec programme ; un week-end dont le samedi a déjà son temps fort ; un
    // évènement sans date ; un évènement sans programme.
    const [single] = await target<{ id: string }[]>`insert into events.events (organization_id, event_date) values (${organizationId}, '2027-06-12') returning id`;
    const [weekend] = await target<{ id: string }[]>`insert into events.events (organization_id, event_date) values (${organizationId}, '2027-07-03') returning id`;
    const [undated] = await target<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
    const [empty] = await target<{ id: string }[]>`insert into events.events (organization_id, event_date) values (${organizationId}, '2027-08-01') returning id`;
    const [friday] = await target<{ id: string }[]>`insert into events.key_moments (organization_id, event_id, name, date) values (${organizationId}, ${weekend!.id}, 'Welcome', '2027-07-02') returning id`;
    const [saturday] = await target<{ id: string }[]>`insert into events.key_moments (organization_id, event_id, name, date, start_time) values (${organizationId}, ${weekend!.id}, 'Ceremony', '2027-07-03', '15:00') returning id`;
    for (const eventId of [single!.id, weekend!.id, undated!.id]) {
      await target`insert into events.program_items (organization_id, event_id, start_time, label) values (${organizationId}, ${eventId}, '16:00', 'Cérémonie'), (${organizationId}, ${eventId}, '20:00', 'Dîner')`;
    }
    await migrateAll();
    // Lot 43 : ses migrations, réappliquées par migrateAll, s'annulent d'abord.
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43]) await rollback(tag);
    const moments = await target<{ event_id: string; name: string; date: string; auto_created: boolean }[]>`select event_id, name, date::text, auto_created from events.key_moments where organization_id = ${organizationId} order by event_id, date`;
    // Le mariage d'un jour : un temps fort unique créé de lui-même, dans la langue de l'organisation.
    expect(moments.filter((moment) => moment.event_id === single!.id)).toEqual([{ event_id: single!.id, name: "Event day", date: "2027-06-12", auto_created: true }]);
    // Le week-end : rien de créé ; ni l'évènement sans date, ni celui sans programme.
    expect(moments.filter((moment) => moment.event_id === weekend!.id).map((moment) => moment.auto_created)).toEqual([false, false]);
    expect(moments.filter((moment) => moment.event_id === undated!.id || moment.event_id === empty!.id)).toEqual([]);
    const items = await target<{ event_id: string; key_moment_id: string | null }[]>`select event_id, key_moment_id from events.program_items where organization_id = ${organizationId}`;
    const auto = (await target<{ id: string }[]>`select id from events.key_moments where event_id = ${single!.id}`)[0]!.id;
    expect(items.filter((item) => item.event_id === single!.id).map((item) => item.key_moment_id)).toEqual([auto, auto]);
    expect(items.filter((item) => item.event_id === weekend!.id).map((item) => item.key_moment_id)).toEqual([saturday!.id, saturday!.id]);
    expect(items.filter((item) => item.event_id === undated!.id).map((item) => item.key_moment_id)).toEqual([null, null]);

    // Contraintes : nature d'un pointage, gravité d'un incident, une action par organisation, une photo
    // stockée a son fichier ; une remise pointée a son heure et sa personne.
    const [item] = await target<{ id: string }[]>`select id from events.program_items where event_id = ${single!.id} limit 1`;
    const action = randomUUID();
    await expect(target`insert into events.day_checkpoints (organization_id, event_id, program_item_id, kind, device_at, user_id, action_id) values (${organizationId}, ${single!.id}, ${item!.id}, 'paused', now(), ${randomUUID()}, ${randomUUID()})`).rejects.toThrow(/day_checkpoints_kind_check/);
    await target`insert into events.day_checkpoints (organization_id, event_id, program_item_id, kind, device_at, user_id, action_id) values (${organizationId}, ${single!.id}, ${item!.id}, 'started', now(), ${randomUUID()}, ${action})`;
    await expect(target`insert into events.day_checkpoints (organization_id, event_id, program_item_id, kind, device_at, user_id, action_id) values (${organizationId}, ${single!.id}, ${item!.id}, 'started', now(), ${randomUUID()}, ${action})`).rejects.toThrow(/day_checkpoints_action_unique/);
    await expect(target`insert into events.day_incidents (organization_id, event_id, body, severity, device_at, user_id, action_id) values (${organizationId}, ${single!.id}, 'Pluie', 'grave', now(), ${randomUUID()}, ${randomUUID()})`).rejects.toThrow(/day_incidents_severity_check/);
    await expect(target`insert into events.day_photos (organization_id, event_id, subject, subject_id, state, taken_at, taken_by, action_id) values (${organizationId}, ${single!.id}, 'incident', ${randomUUID()}, 'stored', now(), ${randomUUID()}, ${randomUUID()})`).rejects.toThrow(/day_photos_state_check/);
    const [line] = await target<{ id: string }[]>`insert into budget.budget_lines (organization_id, event_id, event_vendor_slot_id, label) values (${organizationId}, ${single!.id}, ${randomUUID()}, 'Traiteur') returning id`;
    const [payment] = await target<{ id: string }[]>`insert into budget.vendor_payments (organization_id, event_id, line_id, label, fixed_amount_cents, due_on, handover_on_day, handover_method) values (${organizationId}, ${single!.id}, ${line!.id}, 'Solde', 1000, '2027-06-12', true, 'Chèque') returning id`;
    await expect(target`update budget.vendor_payments set handed_over_at = now() where id = ${payment!.id}`).rejects.toThrow(/vendor_payments_handover_check/);

    // Annulation : refusée tant qu'une remise est marquée, puis tant que le jour J a une trace.
    await expect(rollback(LOT_51[0]!)).rejects.toThrow(/à remettre le jour J/);
    await target`update budget.vendor_payments set handover_on_day = false, handover_method = null where id = ${payment!.id}`;
    await rollback(LOT_51[0]!);
    expect(await hasColumn("budget", "vendor_payments", "handover_on_day")).toBe(false);
    await expect(rollback(LOT_51[1]!)).rejects.toThrow(/pointages, des décalages/);
    await target`delete from events.day_checkpoints where organization_id = ${organizationId}`;
    // Une séquence d'un autre jour que celui de l'évènement : le chrono sur plusieurs jours se perdrait.
    await target`update events.program_items set key_moment_id = ${friday!.id} where event_id = ${weekend!.id}`;
    await expect(rollback(LOT_51[1]!)).rejects.toThrow(/autre jour/);
    await target`update events.program_items set key_moment_id = ${saturday!.id} where event_id = ${weekend!.id}`;
    await rollback(LOT_51[1]!);
    expect(await hasColumn("events", "program_items", "key_moment_id")).toBe(false);
    expect(await hasColumn("events", "key_moments", "auto_created")).toBe(false);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('events.day_checkpoints')::text as name`;
    expect(table!.name).toBeNull();
    // Le temps fort créé de lui-même est retiré ; ceux de la planner restent.
    expect((await target`select 1 from events.key_moments where event_id = ${single!.id}`).length).toBe(0);
    expect((await target`select 1 from events.key_moments where event_id = ${weekend!.id}`).length).toBe(2);
    await target`delete from budget.vendor_payments where organization_id = ${organizationId}`;
    await target`delete from budget.budget_lines where organization_id = ${organizationId}`;
    await target`delete from events.program_items where organization_id = ${organizationId}`;
    await target`delete from events.key_moments where organization_id = ${organizationId}`;
    await target`delete from events.events where organization_id = ${organizationId}`;
    await target`delete from hub.organizations where id = ${organizationId}`;
    await migrateAll();
  });

  it("seule la dernière migration appliquée s'annule", async () => {
    await expect(rollback("0070_lot14_import_vendors")).rejects.toBeInstanceOf(RollbackRefusedError);
    await expect(rollback("0074_lot15_grant_import_jobs")).rejects.toBeInstanceOf(RollbackRefusedError);
    await expect(rollback("0099_inconnue")).rejects.toBeInstanceOf(RollbackRefusedError);
  });

  it("lot 47 (PAR-05, PRE-03, PRE-04, PRE-09, BUD-05 ; ADR 0085) — 0162 à 0164 : réponse et feuille de route contraintes, natures d'e-mails des prestataires ; annulations refusées tant qu'un modèle réécrit, une facture déposée ou une réponse au fil existent, puis tout est retiré", async () => {
    await migrateAll();
    // Lot 43 : ses migrations, plus récentes, s'annulent d'abord.
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43]) await rollback(tag);
    const organizationId = randomUUID();
    const [event] = await target<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
    const [slot] = await target<{ id: string }[]>`insert into events.event_vendor_slots (organization_id, event_id, label) values (${organizationId}, ${event!.id}, 'Fleurs') returning id`;
    const [brief] = await target<{ id: string }[]>`insert into events.vendor_briefs (organization_id, event_id, vendor_slot_id, need, deadline) values (${organizationId}, ${event!.id}, ${slot!.id}, 'Bouquet', '2027-03-01') returning id`;
    const [candidate] = await target<{ id: string }[]>`insert into events.event_vendor_candidates (organization_id, event_id, vendor_slot_id, vendor_name, brief_id) values (${organizationId}, ${event!.id}, ${slot!.id}, 'Atelier', ${brief!.id}) returning id`;
    await expect(target`update events.event_vendor_candidates set availability = 'peut-être' where id = ${candidate!.id}`).rejects.toThrow(/event_vendor_candidates_availability_check/);
    await expect(target`insert into events.vendor_roadmaps (organization_id, candidate_id, stage, sent_at) values (${organizationId}, ${candidate!.id}, 'j15', now())`).rejects.toThrow(/vendor_roadmaps_stage_check/);
    await expect(target`insert into events.vendor_briefs (organization_id, event_id, vendor_slot_id, need, deadline) values (${organizationId}, ${event!.id}, ${slot!.id}, 'Autre', '2027-03-01')`).rejects.toThrow(/vendor_briefs_slot_unique/);
    // 0164 : un engagé libéré (nouvelle valeur vide) est admis à l'historique et bloque l'annulation.
    const [line] = await target<{ id: string }[]>`insert into budget.budget_lines (organization_id, event_id, event_vendor_slot_id, label) values (${organizationId}, ${event!.id}, ${slot!.id}, 'Fleurs') returning id`;
    const [entry] = await target<{ id: string }[]>`insert into budget.budget_line_history (organization_id, line_id, field, old_value_cents, new_value_cents, changed_by_user_id) values (${organizationId}, ${line!.id}, 'committed', 285000, null, ${organizationId}) returning id`;
    // Lot 51 : ses migrations, plus récentes, s'annulent d'abord.
    for (const tag of LOT_51) await rollback(tag);
    await expect(rollback(LOT_47[0]!)).rejects.toThrow(/engagés libérés sont à l'historique/);
    await target`delete from budget.budget_line_history where id = ${entry!.id}`;
    await target`delete from budget.budget_lines where id = ${line!.id}`;
    await rollback(LOT_47[0]!);
    // 0163 : les trois natures sont admises ; un modèle réécrit bloque l'annulation.
    const [template] = await target<{ id: string }[]>`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'vendor_brief', 'fr', 'Brief', 'Bonjour {{lien}}') returning id`;
    await expect(rollback(LOT_47[1]!)).rejects.toThrow(/modèles d'e-mails des prestataires ont été réécrits/);
    await target`delete from hub.email_templates where id = ${template!.id}`;
    await rollback(LOT_47[1]!);
    await expect(target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'vendor_roadmap', 'fr', 'Feuille', 'Bonjour {{lien}}')`).rejects.toThrow(/email_templates_kind_check/);
    // 0162 : une facture déposée par un lien (sans auteur de l'équipe) ou une réponse au fil bloquent.
    const [document] = await target<{ id: string }[]>`insert into events.event_documents (organization_id, event_id, label, file_key, mime, size_bytes) values (${organizationId}, ${event!.id}, 'Facture', 'k', 'application/pdf', 10) returning id`;
    await expect(rollback(LOT_47[2]!)).rejects.toThrow(/factures ont été déposées par des prestataires/);
    await target`delete from events.event_documents where id = ${document!.id}`;
    await target`insert into events.event_activities (organization_id, event_id, kind, task_label, vendor_candidate_id) values (${organizationId}, ${event!.id}, 'vendor_answered', '', ${candidate!.id})`;
    await expect(rollback(LOT_47[2]!)).rejects.toThrow(/réponses de prestataires sont au fil/);
    await target`delete from events.event_activities where event_id = ${event!.id}`;
    await rollback(LOT_47[2]!);
    expect(await hasColumn("events", "event_vendor_candidates", "availability")).toBe(false);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('events.vendor_briefs')::text as name`;
    expect(table!.name).toBeNull();
    await target`delete from events.event_vendor_candidates where event_id = ${event!.id}`;
    await target`delete from events.event_vendor_slots where event_id = ${event!.id}`;
    await target`delete from events.events where id = ${event!.id}`;
    await migrateAll();
  });

  it("lot 50 (INV-05, INV-06 ; ADR 0086) — 0159 : une place à une table de son plan, une par invité ; annulation refusée tant qu'un plan ou un type de repas choisi existe, puis tout est retiré", async () => {
    await migrateAll();
    const organizationId = randomUUID();
    const [event] = await target<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
    const [moment] = await target<{ id: string }[]>`insert into events.key_moments (organization_id, event_id, name, date) values (${organizationId}, ${event!.id}, 'Dîner', '2027-06-12') returning id`;
    const [household] = await target<{ id: string }[]>`insert into guests.households (organization_id, event_id, display_name) values (${organizationId}, ${event!.id}, 'Foyer') returning id`;
    const [guest] = await target<{ id: string }[]>`insert into guests.guests (organization_id, event_id, household_id, kind, first_name) values (${organizationId}, ${event!.id}, ${household!.id}, 'adult', 'Jeanne') returning id`;
    const [plan] = await target<{ id: string }[]>`insert into guests.seating_plans (organization_id, event_id, key_moment_id) values (${organizationId}, ${event!.id}, ${moment!.id}) returning id`;
    const [other] = await target<{ id: string }[]>`insert into guests.seating_plans (organization_id, event_id, key_moment_id) values (${organizationId}, ${event!.id}, ${randomUUID()}) returning id`;
    const [table] = await target<{ id: string }[]>`insert into guests.seating_tables (organization_id, plan_id, name, shape, capacity) values (${organizationId}, ${plan!.id}, 'Table 1', 'round', 10) returning id`;
    await expect(target`insert into guests.seating_tables (organization_id, plan_id, name, shape, capacity) values (${organizationId}, ${plan!.id}, 'Table 2', 'ovale', 10)`).rejects.toThrow(/seating_tables_shape_check/);
    // Une place ne désigne qu'une table de son propre plan, et un invité n'a qu'une place par plan.
    await expect(target`insert into guests.seat_assignments (organization_id, plan_id, table_id, guest_id) values (${organizationId}, ${other!.id}, ${table!.id}, ${guest!.id})`).rejects.toThrow(/seat_assignments_table_fk/);
    await target`insert into guests.seat_assignments (organization_id, plan_id, table_id, guest_id) values (${organizationId}, ${plan!.id}, ${table!.id}, ${guest!.id})`;
    await expect(target`insert into guests.seat_assignments (organization_id, plan_id, table_id, guest_id) values (${organizationId}, ${plan!.id}, ${table!.id}, ${guest!.id})`).rejects.toThrow(/seat_assignments_plan_guest_unique/);
    const [mealType] = await target<{ id: string }[]>`insert into guests.meal_types (organization_id, starter_key) values (${organizationId}, 'adult') returning id`;
    await target`update guests.guests set meal_type_id = ${mealType!.id} where id = ${guest!.id}`;
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44]) await rollback(tag);
    await expect(rollback(LOT_50[0]!)).rejects.toThrow(/plans de table existent encore/);
    await target`delete from guests.seating_plans where organization_id = ${organizationId}`;
    await expect(rollback(LOT_50[0]!)).rejects.toThrow(/type de repas choisi/);
    await target`update guests.guests set meal_type_id = null where id = ${guest!.id}`;
    await rollback(LOT_50[0]!);
    const [tableName] = await target<{ name: string | null }[]>`select to_regclass('guests.seating_tables')::text as name`;
    expect(tableName!.name).toBeNull();
    expect(await hasColumn("guests", "guests", "meal_type_id")).toBe(false);
    await target`delete from guests.households where id = ${household!.id}`;
    await target`delete from events.key_moments where id = ${moment!.id}`;
    await target`delete from events.events where id = ${event!.id}`;
    await migrateAll();
  });

  it("lot 46 (RDV-01 à RDV-04, EVT-10 ; ADR 0082) — 0156 et 0157 : adresse de page unique et lisible, adresse d'agenda chiffrée seulement ; l'annulation est refusée tant qu'un rendez-vous réel existe, puis retire le schéma", async () => {
    await migrateAll();
    // Lots 47, 44 et 50 : leurs migrations, plus récentes, s'annulent d'abord.
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50]) await rollback(tag);
    const organizationId = randomUUID();
    await target`insert into appointments.booking_pages (organization_id, slug) values (${organizationId}, 'atelier-camille')`;
    await expect(target`insert into appointments.booking_pages (organization_id, slug) values (${randomUUID()}, 'atelier-camille')`).rejects.toThrow(/booking_pages_slug_idx/);
    await expect(target`insert into appointments.booking_pages (organization_id, slug) values (${randomUUID()}, 'Pas Lisible!')`).rejects.toThrow(/booking_pages_slug_check/);
    await expect(target`insert into appointments.calendar_sources (organization_id, user_id, label, url_sealed, url_hint) values (${organizationId}, ${randomUUID()}, 'Perso', 'https://example.test/x.ics', 'example.test')`).rejects.toThrow(/calendar_sources_sealed_check/);
    const [appointment] = await target<{ id: string }[]>`insert into appointments.appointments (organization_id, type_name, host_user_id, starts_at, ends_at, location_kind, origin, person_name) values (${organizationId}, 'Découverte', ${randomUUID()}, '2027-03-02T09:00:00Z', '2027-03-02T10:00:00Z', 'video', 'manual', 'Léa') returning id`;
    await expect(target`update appointments.appointments set status = 'cancelled' where id = ${appointment!.id}`).rejects.toThrow(/appointments_cancel_check/);
    await rollback(LOT_46[0]!);
    await rollback(LOT_46[1]!);
    await expect(rollback(LOT_46[2]!)).rejects.toThrow(/des rendez-vous existent/);
    await target`update appointments.appointments set is_demo = true where id = ${appointment!.id}`;
    await rollback(LOT_46[2]!);
    const [schema] = await target<{ name: string | null }[]>`select to_regnamespace('appointments')::text as name`;
    expect(schema!.name).toBeNull();
    await migrateAll();
  });

  it("lot 46 (RDV-03 ; ADR 0082) — 0158 : les natures des rendez-vous rejoignent celles du lot 49, une nature inconnue reste refusée ; l'annulation est refusée tant qu'un modèle de rendez-vous existe, puis rend exactement la liste du lot 49", async () => {
    await migrateAll();
    // Lots 47, 44 et 50 : leurs migrations, plus récentes, s'annulent d'abord.
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50]) await rollback(tag);
    const organizationId = randomUUID();
    const template = (kind: string) => target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, ${kind}, 'fr', 'Objet', 'Texte')`;
    await template("appointment_confirmed");
    await template("client_link");
    await template("guest_invitation");
    await expect(template("appointment_inconnu")).rejects.toThrow(/email_templates_kind_check/);
    await expect(template("nature_inconnue")).rejects.toThrow(/email_templates_kind_check/);
    await expect(rollback(LOT_46[0]!)).rejects.toThrow(/modèles d'e-mails de rendez-vous personnalisés/);
    await target`delete from hub.email_templates where organization_id = ${organizationId} and kind = 'appointment_confirmed'`;
    await rollback(LOT_46[0]!);
    // Retour à la liste du lot 49 : ses natures restent acceptées, celles des rendez-vous non.
    await expect(template("appointment_reminder")).rejects.toThrow(/email_templates_kind_check/);
    await template("guest_reminder");
    await expect(template("nature_inconnue")).rejects.toThrow(/email_templates_kind_check/);
    await target`delete from hub.email_templates where organization_id = ${organizationId}`;
    await migrateAll();
  });

  it("lot 41 (FAC-10, JUR-02, JUR-13 ; ADR 0080) — 0154 et 0155 : nature « service » par défaut, bornes du bon de commande ; annulation refusée tant qu'une pièce Factur-X est émise, puis retire les colonnes", async () => {
    await migrateAll();
    const organizationId = randomUUID();
    const [item] = await target<{ nature: string }[]>`insert into quotes.catalog_items (organization_id, label, unit, unit_price_cents, vat_rate_basis_points) values (${organizationId}, 'Coordination', 'forfait', 100000, 2000) returning nature`;
    expect(item!.nature).toBe("service");
    await expect(target`insert into quotes.catalog_items (organization_id, label, unit, unit_price_cents, vat_rate_basis_points, nature) values (${organizationId}, 'X', 'u', 1, 0, 'autre')`).rejects.toThrow(/catalog_items_nature_check/);
    await target`delete from quotes.catalog_items where organization_id = ${organizationId}`;
    // Lots 50 et 46 : leurs migrations, plus récentes, s'annulent d'abord.
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41]) await rollback(tag);
    const [column] = await target<{ name: string | null }[]>`select column_name as name from information_schema.columns where table_schema = 'quotes' and table_name = 'invoices' and column_name = 'reform_snapshot'`;
    expect(column).toBeUndefined();
    await migrateAll();
  });

  it("lot 49 (D2, D9 ; ADR 0083) — 0150 à 0153 : un enfant n'a ni contact ni lien ; annulation refusée tant que des invités ou des temps forts existent, puis tout est retiré", async () => {
    await migrateAll();
    // Lots 50, 46 et 41 : leurs migrations, plus récentes, s'annulent d'abord.
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41]) await rollback(tag);
    const organizationId = randomUUID();
    const [event] = await target<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
    const [moment] = await target<{ id: string }[]>`insert into events.key_moments (organization_id, event_id, name, date) values (${organizationId}, ${event!.id}, 'Dîner', '2027-06-12') returning id`;
    const [household] = await target<{ id: string }[]>`insert into guests.households (organization_id, event_id, display_name) values (${organizationId}, ${event!.id}, 'Foyer') returning id`;
    await expect(target`insert into guests.guests (organization_id, event_id, household_id, kind, first_name, email) values (${organizationId}, ${event!.id}, ${household!.id}, 'child', 'Léo', 'leo@example.test')`).rejects.toThrow(/guests_child_no_contact_check/);
    const [child] = await target<{ id: string }[]>`insert into guests.guests (organization_id, event_id, household_id, kind, first_name) values (${organizationId}, ${event!.id}, ${household!.id}, 'child', 'Léo') returning id`;
    await expect(target`insert into guests.guest_links (organization_id, event_id, guest_id, token_hash) values (${organizationId}, ${event!.id}, ${child!.id}, ${"c".repeat(64)})`).rejects.toThrow(/guest_links_adult_fk/);
    await expect(rollback(LOT_49[0]!)).rejects.toThrow(/foyers d'invités existent encore/);
    await target`delete from guests.households where id = ${household!.id}`;
    await rollback(LOT_49[0]!);
    const [schema] = await target<{ name: string | null }[]>`select to_regnamespace('guests')::text as name`;
    expect(schema!.name).toBeNull();
    // 0152 : nature d'un modèle réécrit ; une nature inconnue reste refusée.
    const [template] = await target<{ id: string }[]>`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'guest_invitation', 'fr', 'Invitation', 'Bonjour {{prénom}} {{lien}}') returning id`;
    await expect(target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'nature_inconnue', 'fr', 'Objet', 'Texte')`).rejects.toThrow(/email_templates_kind_check/);
    await expect(rollback(LOT_49[1]!)).rejects.toThrow(/modèles d'e-mails des invités ont été réécrits/);
    await target`delete from hub.email_templates where id = ${template!.id}`;
    await rollback(LOT_49[1]!);
    await expect(target`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'guest_reminder', 'fr', 'Relance', 'Bonjour {{lien}}')`).rejects.toThrow(/email_templates_kind_check/);
    await rollback(LOT_49[2]!);
    expect(await hasColumn("hub", "privacy_settings", "guest_retention_days")).toBe(false);
    await expect(rollback(LOT_49[3]!)).rejects.toThrow(/temps forts existent encore/);
    await target`delete from events.key_moments where id = ${moment!.id}`;
    await rollback(LOT_49[3]!);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('events.key_moments')::text as name`;
    expect(table!.name).toBeNull();
    await target`delete from events.events where id = ${event!.id}`;
    await migrateAll();
  });

  it("lot 40b (ARC-10 ; ADR 0076) — 0149 : une clé par organisation ; contenu seulement à faire ou en cours ; l'annulation est refusée tant qu'un e-mail attend, puis retire la file", async () => {
    await migrateAll();
    const organizationId = randomUUID();
    const [job] = await target<{ id: string }[]>`insert into hub.jobs (organization_id, kind, idempotency_key, payload) values (${organizationId}, 'email', 'invitation:1', '{"to":"x"}'::jsonb) returning id`;
    await expect(target`insert into hub.jobs (organization_id, kind, idempotency_key, payload) values (${organizationId}, 'email', 'invitation:1', '{"to":"y"}'::jsonb)`).rejects.toThrow(/jobs_organization_key_idx/);
    await expect(target`insert into hub.jobs (organization_id, kind, idempotency_key, state, payload) values (${organizationId}, 'email', 'fini', 'done', '{"to":"z"}'::jsonb)`).rejects.toThrow(/jobs_payload_check/);
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49]) await rollback(tag);
    await expect(rollback(LOT_40B[0]!)).rejects.toThrow(/des e-mails attendent encore/);
    await target`update hub.jobs set state = 'done', payload = null, finished_at = now() where id = ${job!.id}`;
    for (const tag of LOT_40B) await rollback(tag);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('hub.jobs')::text as name`;
    expect(table!.name).toBeNull();
    await migrateAll();
  });

  it("lot 39b (UX-09 ; ADR 0074) — 0148 : un brouillon par personne et par formulaire ; l'annulation retire les brouillons", async () => {
    await migrateAll();
    const organizationId = randomUUID();
    const [user] = await target<{ id: string }[]>`insert into hub.users (email) values (${`brouillon-${randomUUID()}@example.test`}) returning id`;
    await target`insert into hub.form_drafts (organization_id, user_id, form_key, content) values (${organizationId}, ${user!.id}, 'event-new', '{"clientFirstName1":"Léa"}'::jsonb)`;
    await expect(target`insert into hub.form_drafts (organization_id, user_id, form_key, content) values (${organizationId}, ${user!.id}, 'event-new', '{}'::jsonb)`).rejects.toThrow(/form_drafts_person_form_idx/);
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49, ...LOT_40B, ...LOT_39B]) await rollback(tag);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('hub.form_drafts')::text as name`;
    expect(table!.name).toBeNull();
    await target`delete from hub.users where id = ${user!.id}`;
    await migrateAll();
  });

  it("lot 39a (DAT-03 ; ADR 0073) — 0144 à 0147 : l'annulation est refusée tant qu'une ligne est à la corbeille, puis retire colonnes et politiques", async () => {
    await migrateAll();
    const organizationId = randomUUID();
    const [event] = await target<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
    const [task] = await target<{ id: string }[]>`insert into events.event_tasks (organization_id, event_id, label, due_date, deleted_at) values (${organizationId}, ${event!.id}, 'Envoyer les faire-part', '2027-03-01', now()) returning id`;
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49, ...LOT_40B, ...LOT_39B, ...LOT_39A.slice(0, 3)]) await rollback(tag);
    await expect(rollback("0144_lot39a_events_soft_delete")).rejects.toThrow(/events\.event_tasks sont à la corbeille/);
    await target`update events.event_tasks set deleted_at = null where id = ${task!.id}`;
    await rollback("0144_lot39a_events_soft_delete");
    expect(await hasColumn("events", "event_tasks", "deleted_at")).toBe(false);
    expect(await hasColumn("hub", "contacts", "deleted_by")).toBe(false);
    const [policies] = await target<{ count: number }[]>`select count(*)::int as count from pg_policies where policyname in ('soft_delete_visibility', 'event_visibility', 'line_visibility')`;
    expect(policies!.count).toBe(0);
    await target`delete from events.event_tasks where id = ${task!.id}`;
    await target`delete from events.events where id = ${event!.id}`;
    await migrateAll();
    expect(await hasColumn("budget", "budget_lines", "deleted_at")).toBe(true);
  });

  it("lot 38b (HUB-21, HUB-29 ; D10, D11) — 0143 : un numéro par version d'un modèle de message ; une seule adresse de calendrier active par personne (et par évènement), jeton haché ; l'annulation retire modèles, versions et adresses", async () => {
    await migrateAll();
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const [template] = await inOrganization((tx) => tx<{ id: string }[]>`insert into hub.message_templates (organization_id, name, locale) values (${organizationId}, 'Proposer un rendez-vous', 'fr') returning id`);
    await inOrganization((tx) => tx`insert into hub.message_template_versions (organization_id, template_id, version, subject, body) values (${organizationId}, ${template!.id}, 1, 'Rendez-vous', 'Bonjour {{prénom}}')`);
    await expect(inOrganization((tx) => tx`insert into hub.message_template_versions (organization_id, template_id, version, subject, body) values (${organizationId}, ${template!.id}, 1, 'Autre', 'Autre')`)).rejects.toThrow(/message_template_versions_template_version_unique/);
    await expect(inOrganization((tx) => tx`insert into hub.message_templates (organization_id, name, locale) values (${organizationId}, 'Questionnaire', 'de')`)).rejects.toThrow(/message_templates_locale_check/);
    const [user] = await target<{ id: string }[]>`insert into hub.users (email) values (${`flux-${randomUUID()}@example.test`}) returning id`;
    const hash = (digit: string) => digit.repeat(64);
    await inOrganization((tx) => tx`insert into hub.calendar_feeds (organization_id, user_id, token_hash) values (${organizationId}, ${user!.id}, ${hash("a")})`);
    await expect(inOrganization((tx) => tx`insert into hub.calendar_feeds (organization_id, user_id, token_hash) values (${organizationId}, ${user!.id}, ${hash("b")})`)).rejects.toThrow(/calendar_feeds_person_active_idx/);
    await expect(inOrganization((tx) => tx`insert into hub.calendar_feeds (organization_id, user_id, token_hash) values (${organizationId}, ${user!.id}, 'jeton-en-clair')`)).rejects.toThrow(/calendar_feeds_token_hash_check/);
    await inOrganization((tx) => tx`update hub.calendar_feeds set revoked_at = now() where token_hash = ${hash("a")}`);
    await inOrganization((tx) => tx`insert into hub.calendar_feeds (organization_id, user_id, token_hash) values (${organizationId}, ${user!.id}, ${hash("b")})`);
    const eventId = randomUUID();
    await inOrganization((tx) => tx`insert into hub.calendar_feeds (organization_id, user_id, event_id, token_hash) values (${organizationId}, ${user!.id}, ${eventId}, ${hash("c")})`);
    await expect(inOrganization((tx) => tx`insert into hub.calendar_feeds (organization_id, user_id, event_id, token_hash) values (${organizationId}, ${user!.id}, ${eventId}, ${hash("d")})`)).rejects.toThrow(/calendar_feeds_event_active_idx/);

    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49, ...LOT_40B, ...LOT_39B, ...LOT_39A, ...LOT_38B]) await rollback(tag);
    for (const name of ["hub.message_templates", "hub.message_template_versions", "hub.calendar_feeds"]) {
      const [table] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(table!.name).toBeNull();
    }
    // Le compte d'essai, sans adhésion, gênerait l'annulation des lots plus anciens (0129).
    await target`delete from hub.users where id = ${user!.id}`;
    await migrateAll();
  });

  it("lot 38a (MSG-01 ; D3, D9) — 0141 et 0142 : un modèle par nature et par langue, natures et langues contrôlées ; seules la date et le nombre d'envois d'une version du programme se modifient ; l'annulation retire modèles et envois", async () => {
    await migrateAll();
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    await inOrganization((tx) => tx`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'client_link', 'fr', 'Votre espace', 'Bonjour {{prénom}}, {{lien}}')`);
    await expect(inOrganization((tx) => tx`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'client_link', 'fr', 'Autre', 'Autre {{lien}}')`)).rejects.toThrow(/email_templates_kind_locale_unique/);
    await expect(inOrganization((tx) => tx`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'newsletter', 'fr', 'Nouvelles', 'Texte')`)).rejects.toThrow(/email_templates_kind_check/);
    await expect(inOrganization((tx) => tx`insert into hub.email_templates (organization_id, kind, locale, subject, body) values (${organizationId}, 'client_link', 'de', 'Ihr Bereich', 'Text')`)).rejects.toThrow(/email_templates_locale_check/);
    expect(await hasColumn("events", "program_versions", "notified_at")).toBe(true);

    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49, ...LOT_40B, ...LOT_39B, ...LOT_39A, ...LOT_38B, ...LOT_38A]) await rollback(tag);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('hub.email_templates')::text as name`;
    expect(table!.name).toBeNull();
    expect(await hasColumn("events", "program_versions", "notified_at")).toBe(false);
    expect(await hasColumn("events", "program_versions", "notified_count")).toBe(false);
    await migrateAll();
  });

  it("lot 37b (CHR-07, DAT-14, DOC-12 ; D8, D11, D13) — 0138 à 0140 : le programme existant devient sa version 1, sans note interne, déjà vue par ses liens ; numéros uniques ; relevé au premier du mois ; l'annulation retire versions, relevés et tailles", async () => {
    await migrateAll();
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49, ...LOT_40B, ...LOT_39B, ...LOT_39A, ...LOT_38B, ...LOT_38A, ...LOT_37B]) await rollback(tag);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id, program_updated_at) values (${organizationId}, '2026-10-01T08:00:00Z') returning id`;
      const [empty] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const [slot] = await tx<{ id: string }[]>`insert into events.event_vendor_slots (organization_id, event_id, label) values (${organizationId}, ${event!.id}, 'Traiteur') returning id`;
      const [late] = await tx<{ id: string }[]>`insert into events.program_items (organization_id, event_id, start_time, end_time, label, internal_note) values (${organizationId}, ${event!.id}, '19:00', null, 'Dîner', 'Prévoir les allergies') returning id`;
      const [early] = await tx<{ id: string }[]>`insert into events.program_items (organization_id, event_id, start_time, end_time, label, location, responsible) values (${organizationId}, ${event!.id}, '15:00', '16:30', 'Cérémonie', 'Jardin', 'Camille') returning id`;
      await tx`insert into events.program_item_participants (organization_id, program_item_id, vendor_slot_id, position) values (${organizationId}, ${late!.id}, ${slot!.id}, 0)`;
      await tx`insert into events.program_item_participants (organization_id, program_item_id, free_label, position) values (${organizationId}, ${late!.id}, 'Officiant', 1)`;
      const [link] = await tx<{ id: string }[]>`insert into events.event_links (organization_id, event_id, audience, person_name, email) values (${organizationId}, ${event!.id}, 'client', 'Léa', 'lea@example.test') returning id`;
      return { event: event!.id, empty: empty!.id, slot: slot!.id, early: early!.id, late: late!.id, link: link!.id };
    });

    await migrateAll();
    const versions = await inOrganization((tx) => tx<{ event_id: string; number: number; published_at: Date; published_by_user_id: string | null; items: unknown }[]>`select event_id, number, published_at, published_by_user_id, items from events.program_versions where organization_id = ${organizationId}`);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ event_id: ids.event, number: 1, published_by_user_id: null });
    expect(new Date(versions[0]!.published_at).toISOString()).toBe("2026-10-01T08:00:00.000Z");
    expect(versions[0]!.items).toEqual([
      { id: ids.early, startTime: "15:00", endTime: "16:30", label: "Cérémonie", location: "Jardin", responsible: "Camille", participants: [] },
      { id: ids.late, startTime: "19:00", endTime: null, label: "Dîner", location: null, responsible: null, participants: [{ vendorSlotId: ids.slot, label: "Traiteur" }, { vendorSlotId: null, label: "Officiant" }] },
    ]);
    expect(JSON.stringify(versions[0]!.items)).not.toContain("allergies");
    const [link] = await inOrganization((tx) => tx<{ program_version_seen: number | null }[]>`select program_version_seen from events.event_links where id = ${ids.link}`);
    expect(link!.program_version_seen).toBe(1);
    await expect(inOrganization((tx) => tx`insert into events.program_versions (organization_id, event_id, number, items) values (${organizationId}, ${ids.event}, 1, '[]'::jsonb)`)).rejects.toThrow(/program_versions_event_number_unique/);
    await expect(inOrganization((tx) => tx`insert into hub.storage_snapshots (organization_id, month, nature, file_count, total_bytes) values (${organizationId}, '2026-11-02', 'uploads', 0, 0)`)).rejects.toThrow(/storage_snapshots_month_check/);
    await expect(inOrganization((tx) => tx`insert into hub.storage_snapshots (organization_id, month, nature, file_count, total_bytes) values (${organizationId}, '2026-11-01', 'exports', 0, 0)`)).rejects.toThrow(/storage_snapshots_nature_check/);
    await inOrganization((tx) => tx`insert into hub.storage_snapshots (organization_id, month, nature, file_count, total_bytes) values (${organizationId}, '2026-11-01', 'uploads', 3, 4096)`);
    await expect(inOrganization((tx) => tx`insert into hub.storage_snapshots (organization_id, month, nature, file_count, total_bytes) values (${organizationId}, '2026-11-01', 'uploads', 4, 5000)`)).rejects.toThrow(/storage_snapshots_month_nature_unique/);

    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49, ...LOT_40B, ...LOT_39B, ...LOT_39A, ...LOT_38B, ...LOT_38A, ...LOT_37B]) await rollback(tag);
    for (const name of ["events.program_versions", "hub.storage_snapshots"]) {
      const [table] = await target<{ name: string | null }[]>`select to_regclass(${name})::text as name`;
      expect(table!.name).toBeNull();
    }
    expect(await hasColumn("events", "event_links", "program_version_seen")).toBe(false);
    expect(await hasColumn("hub", "organization_profiles", "logo_size_bytes")).toBe(false);
    expect(await hasColumn("quotes", "signature_requests", "signed_document_size_bytes")).toBe(false);
    expect(await hasColumn("quotes", "contract_evidence", "size_bytes")).toBe(false);
    await migrateAll();
  });

  it("lot 37a (DOC-01, DOC-04 ; D3, D4, D7) — 0137 : chaque document déjà déposé devient sa version 1, sans dossier, non partagé ; versions uniques ; une ouverture de lien au fil bloque l'annulation, qui rend la liste plate", async () => {
    await migrateAll();
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49, ...LOT_40B, ...LOT_39B, ...LOT_39A, ...LOT_38B, ...LOT_38A, ...LOT_37B, ...LOT_37A]) await rollback(tag);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const [document] = await tx<{ id: string }[]>`insert into events.event_documents (organization_id, event_id, label, file_key, mime, size_bytes, uploaded_by_user_id) values (${organizationId}, ${event!.id}, 'Plan de table', 'cle/plan.pdf', 'application/pdf', 1200, ${randomUUID()}) returning id`;
      return { event: event!.id, document: document!.id };
    });

    await migrateAll();
    const [version] = await inOrganization((tx) => tx<{ version: number; file_key: string; size_bytes: number }[]>`select version, file_key, size_bytes from events.event_document_versions where document_id = ${ids.document}`);
    expect(version).toEqual({ version: 1, file_key: "cle/plan.pdf", size_bytes: 1200 });
    const [document] = await inOrganization((tx) => tx<{ folder_id: string | null; shared_with_clients: boolean; shared_with_vendors: boolean }[]>`select folder_id, shared_with_clients, shared_with_vendors from events.event_documents where id = ${ids.document}`);
    expect(document).toEqual({ folder_id: null, shared_with_clients: false, shared_with_vendors: false });
    await expect(inOrganization((tx) => tx`insert into events.event_document_versions (organization_id, document_id, version, file_key, mime, size_bytes, uploaded_by_user_id) values (${organizationId}, ${ids.document}, 1, 'cle/autre.pdf', 'application/pdf', 10, ${randomUUID()})`)).rejects.toThrow(/event_document_versions_unique/);
    await expect(inOrganization((tx) => tx`insert into events.event_document_folders (organization_id, event_id, name) values (${organizationId}, ${ids.event}, '')`)).rejects.toThrow(/event_document_folders_name_check/);

    const [activity] = await inOrganization((tx) => tx<{ id: string }[]>`insert into events.event_activities (organization_id, event_id, kind, task_label) values (${organizationId}, ${ids.event}, 'document_link_opened', 'Plan de table') returning id`);
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49, ...LOT_40B, ...LOT_39B, ...LOT_39A, ...LOT_38B, ...LOT_38A, ...LOT_37B]) await rollback(tag);
    await expect(rollback(LOT_37A[0]!)).rejects.toThrow(/ouvertures de liens de partage/);
    await target`delete from events.event_activities where id = ${activity!.id}`;
    await rollback(LOT_37A[0]!);
    expect(await hasColumn("events", "event_documents", "folder_id")).toBe(false);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('events.event_document_versions')::text as name`;
    expect(table!.name).toBeNull();
    const [kept] = await inOrganization((tx) => tx<{ file_key: string }[]>`select file_key from events.event_documents where id = ${ids.document}`);
    expect(kept!.file_key).toBe("cle/plan.pdf");
    await migrateAll();
  });

  it("lot 36b (CRM-03, HUB-14 ; D2, D11) — 0136 : membres d'un foyer ou d'une entreprise, identifiants d'une entreprise seulement ; un import de contacts bloque l'annulation, qui retire ensuite les liens et les identifiants", async () => {
    await migrateAll();
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids = await inOrganization(async (tx) => {
      const [company] = await tx<{ id: string }[]>`insert into hub.contacts (organization_id, kind, name, company_id_number, vat_number) values (${organizationId}, 'company', 'Maison Lumière', '12345678900012', 'FR12123456789') returning id`;
      const [claire] = await tx<{ id: string }[]>`insert into hub.contacts (organization_id, first_name) values (${organizationId}, 'Claire') returning id`;
      await tx`insert into hub.contact_members (organization_id, group_contact_id, member_contact_id, role) values (${organizationId}, ${company!.id}, ${claire!.id}, 'Assistante de direction')`;
      return { company: company!.id, claire: claire!.id };
    });
    // Les identifiants d'entreprise : sur une entreprise seulement, SIREN (9) ou SIRET (14 chiffres).
    await expect(inOrganization((tx) => tx`update hub.contacts set company_id_number = '123456789' where id = ${ids.claire}`)).rejects.toThrow(/contacts_company_ids_check/);
    await expect(inOrganization((tx) => tx`update hub.contacts set company_id_number = '1234' where id = ${ids.company}`)).rejects.toThrow(/contacts_company_ids_check/);
    await expect(inOrganization((tx) => tx`update hub.contacts set vat_number = 'fr 12' where id = ${ids.company}`)).rejects.toThrow(/contacts_company_ids_check/);
    // Une personne n'est membre qu'une fois d'un même groupe, et jamais d'elle-même.
    await expect(inOrganization((tx) => tx`insert into hub.contact_members (organization_id, group_contact_id, member_contact_id) values (${organizationId}, ${ids.company}, ${ids.claire})`)).rejects.toThrow(/contact_members_pair_idx/);
    await expect(inOrganization((tx) => tx`insert into hub.contact_members (organization_id, group_contact_id, member_contact_id) values (${organizationId}, ${ids.claire}, ${ids.claire})`)).rejects.toThrow(/contact_members_distinct_check/);
    // L'isolation (rôle applicatif, RLS) est vérifiée par contacts-isolation.integration.test.ts.

    const [row] = await target<{ id: string }[]>`
      insert into hub.imports (organization_id, created_by_user_id, entity_type, file_name, file_format, file_size_bytes, header_row_index, headers, row_count, expires_at)
      values (${organizationId}, ${randomUUID()}, 'contacts', 'contacts.csv', 'csv', 1, 0, '[]'::jsonb, 0, now())
      returning id`;
    for (const tag of [...LOT_58, ...LOT_35C, ...LOT_35B, ...LOT_53, ...LOT_52, ...LOT_48B, ...LOT_48A, ...LOT_45, ...LOT_43, ...LOT_51, ...LOT_47, ...LOT_44, ...LOT_50, ...LOT_46, ...LOT_41, ...LOT_49, ...LOT_40B, ...LOT_39B, ...LOT_39A, ...LOT_38B, ...LOT_38A, ...LOT_37B, ...LOT_37A]) await rollback(tag);
    await expect(rollback(LOT_36B[0]!)).rejects.toThrow(/imports de contacts/);
    expect(await entityTypes()).toContain("contacts");
    await target`delete from hub.imports where id = ${row!.id}`;
    await rollback(LOT_36B[0]!);
    expect(await entityTypes()).not.toContain("contacts");
    expect(await hasColumn("hub", "contacts", "company_id_number")).toBe(false);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('hub.contact_members')::text as name`;
    expect(table!.name).toBeNull();
    // Les contacts eux-mêmes restent.
    const kept = await inOrganization((tx) => tx<{ id: string }[]>`select id from hub.contacts where organization_id = ${organizationId}`);
    expect(kept.map((contact) => contact.id).sort()).toEqual([ids.company, ids.claire].sort());
    await migrateAll();
  });

  it("lot 36a (CRM-03, DAT-12 ; D3, D6) — 0135 : chaque client devient un contact ; même adresse dans l'organisation, un seul contact ; un couple qui partage une adresse reste deux personnes ; liens et signataires rattachés ; l'annulation rend les clients", async () => {
    for (const tag of LOT_36) await rollback(tag);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids = await inOrganization(async (tx) => {
      const event = async (isDemo = false) => (await tx<{ id: string }[]>`insert into events.events (organization_id, is_demo) values (${organizationId}, ${isDemo}) returning id`)[0]!.id;
      const client = async (eventId: string, firstName: string, values: { lastName?: string | null; email?: string | null; phone?: string | null; position?: number; at?: string } = {}) =>
        (await tx<{ id: string }[]>`insert into events.event_clients (organization_id, event_id, first_name, last_name, email, phone, position, created_at, updated_at)
          values (${organizationId}, ${eventId}, ${firstName}, ${values.lastName ?? null}, ${values.email ?? null}, ${values.phone ?? null}, ${values.position ?? 0}, ${values.at ?? "2026-01-01T10:00:00Z"}, ${values.at ?? "2026-01-01T10:00:00Z"}) returning id`)[0]!.id;
      const first = await event();
      const second = await event();
      const demo = await event(true);
      const lea1 = await client(first, "Léa", { lastName: "Martin", email: " Lea.Martin@Exemple.test ", phone: "06 11 11 11 11", at: "2026-01-01T10:00:00Z" });
      const hugo = await client(first, "Hugo", { lastName: "Durand", email: "lea.martin@exemple.test", position: 1, at: "2026-01-01T10:00:00Z" });
      const lea2 = await client(second, "Léa", { lastName: "Martin-Durand", email: "lea.martin@exemple.test", at: "2026-03-01T10:00:00Z" });
      const noEmail = await client(second, "Inès", { position: 1 });
      const erased = await client(second, "[anonymisé]", { position: 2 });
      const demoClient = await client(demo, "Démo");
      const [link] = await tx<{ id: string }[]>`insert into events.event_links (organization_id, event_id, audience, person_name, email, event_client_id) values (${organizationId}, ${first}, 'client', 'Léa', 'lea.martin@exemple.test', ${lea1}) returning id`;
      return { first, second, lea1, hugo, lea2, noEmail, erased, demoClient, link: link!.id };
    });

    await migrateAll();
    const contactRows = await inOrganization((tx) => tx<{ id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null; is_demo: boolean }[]>`select id, first_name, last_name, email, phone, is_demo from hub.contacts where organization_id = ${organizationId}`);
    const clients = await inOrganization((tx) => tx<{ id: string; contact_id: string | null }[]>`select id, contact_id from events.event_clients where organization_id = ${organizationId}`);
    const contactOf = (clientId: string) => contactRows.find((row) => row.id === clients.find((client) => client.id === clientId)?.contact_id);
    // La même adresse sur deux évènements : un seul contact, aux coordonnées les plus récentes renseignées.
    expect(contactOf(ids.lea1)).toEqual(contactOf(ids.lea2));
    expect(contactOf(ids.lea1)).toMatchObject({ id: ids.lea2, first_name: "Léa", last_name: "Martin-Durand", email: "lea.martin@exemple.test", phone: "06 11 11 11 11", is_demo: false });
    // Le couple qui partage l'adresse dans le même évènement : deux personnes, le second sans adresse.
    expect(contactOf(ids.hugo)).toMatchObject({ id: ids.hugo, first_name: "Hugo", email: null });
    expect(contactOf(ids.noEmail)).toMatchObject({ id: ids.noEmail, first_name: "Inès", email: null });
    expect(contactOf(ids.demoClient)).toMatchObject({ is_demo: true });
    // Un client déjà anonymisé ne devient pas un contact.
    expect(clients.find((client) => client.id === ids.erased)!.contact_id).toBeNull();
    expect(contactRows).toHaveLength(4);
    const [link] = await inOrganization((tx) => tx<{ contact_id: string | null }[]>`select contact_id from events.event_links where id = ${ids.link}`);
    expect(link!.contact_id).toBe(ids.lea2);
    expect(await hasColumn("events", "event_clients", "first_name")).toBe(false);
    // L'unicité de l'adresse par organisation (DAT-12), casse comprise.
    await expect(inOrganization((tx) => tx`insert into hub.contacts (organization_id, first_name, email) values (${organizationId}, 'Autre', 'lea.martin@exemple.test')`)).rejects.toThrow(/contacts_email_idx/);
    await expect(inOrganization((tx) => tx`insert into hub.contacts (organization_id, first_name, email) values (${organizationId}, 'Autre', 'Lea@Exemple.test')`)).rejects.toThrow(/contacts_email_check/);

    for (const tag of LOT_36) await rollback(tag);
    const back = await inOrganization((tx) => tx<{ id: string; first_name: string; last_name: string | null; email: string | null }[]>`select id, first_name, last_name, email from events.event_clients where organization_id = ${organizationId}`);
    const backOf = (clientId: string) => back.find((row) => row.id === clientId);
    expect(backOf(ids.lea1)).toMatchObject({ first_name: "Léa", last_name: "Martin-Durand", email: "lea.martin@exemple.test" });
    expect(backOf(ids.hugo)).toMatchObject({ first_name: "Hugo", email: null });
    expect(backOf(ids.erased)).toMatchObject({ first_name: "[anonymisé]" });
    const [table] = await target<{ name: string | null }[]>`select to_regclass('hub.contacts')::text as name`;
    expect(table!.name).toBeNull();
    await migrateAll();
  });

  it("lot 35a (HUB-13, D4, D5) — 0134 : exports complets sous RLS, un seul en préparation par organisation, durée de conservation réglée par l'Admin ; l'annulation retire la table et le réglage", async () => {
    const [settings] = await target<{ days: number }[]>`select organization_export_retention_days as days from hub.platform_settings limit 1`;
    if (settings) expect(settings.days).toBe(7);
    const organizationId = randomUUID();
    const inOrganization = <T>(id: string, work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${id}, true)`;
        return work(tx);
      }) as Promise<T>;
    await inOrganization(organizationId, (tx) => tx`insert into hub.organization_exports (organization_id, requested_by_user_id) values (${organizationId}, ${randomUUID()})`);
    // Un second export en préparation est refusé ; prêt, le premier n'empêche plus d'en demander un autre.
    await expect(
      inOrganization(organizationId, (tx) => tx`insert into hub.organization_exports (organization_id, requested_by_user_id) values (${organizationId}, ${randomUUID()})`),
    ).rejects.toThrow(/organization_exports_active_idx/);
    await inOrganization(organizationId, (tx) => tx`update hub.organization_exports set status = 'ready' where organization_id = ${organizationId}`);
    await inOrganization(organizationId, (tx) => tx`insert into hub.organization_exports (organization_id, requested_by_user_id) values (${organizationId}, ${randomUUID()})`);
    await expect(inOrganization(organizationId, (tx) => tx`update hub.organization_exports set status = 'lost'`)).rejects.toThrow(/organization_exports_status_check/);
    // Le banc d'essai (rôle d'administration) contourne la RLS : sa politique est vérifiée ici,
    // l'isolation elle-même avec le rôle applicatif (lib/export, tests d'intégration).
    const [policy] = await target<{ qual: string }[]>`select qual from pg_policies where schemaname = 'hub' and tablename = 'organization_exports'`;
    expect(policy!.qual).toContain("app.organization_id");

    for (const tag of [...LOT_36, ...LOT_35A]) await rollback(tag);
    const [table] = await target<{ name: string | null }[]>`select to_regclass('hub.organization_exports')::text as name`;
    expect(table!.name).toBeNull();
    expect(await hasColumn("hub", "platform_settings", "organization_export_retention_days")).toBe(false);
    await migrateAll();
    expect(await hasColumn("hub", "platform_settings", "organization_export_retention_days")).toBe(true);
  });

  it("lot 34b (EVT-03, CHR-02 ; D10 à D13) — 0133 : le lieu de réception devient le premier lieu (un lieu du même nom est repris) ; invités, style, notes ; tâche confiée à un prestataire ; l'annulation rend le lieu et la tâche à la planner", async () => {
    for (const tag of [...LOT_36, ...LOT_35A, ...LOT_34B]) await rollback(tag);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids: Record<string, string> = await inOrganization(async (tx) => {
      const event = async (venueName: string | null, venueCity: string | null) =>
        (await tx<{ id: string }[]>`insert into events.events (organization_id, venue_name, venue_city) values (${organizationId}, ${venueName}, ${venueCity}) returning id`)[0]!.id;
      const named = await event("Domaine des Tilleuls", "Lille");
      await tx`insert into events.event_places (organization_id, event_id, label, position) values (${organizationId}, ${named}, 'Église du village', 0), (${organizationId}, ${named}, ' domaine des tilleuls ', 1)`;
      const other = await event("Château de la Roche", "Arras");
      await tx`insert into events.event_places (organization_id, event_id, label, position) values (${organizationId}, ${other}, 'Mairie', 0)`;
      return { named, other, cityOnly: await event(null, "Amiens"), none: await event(null, null) };
    });

    await migrateAll();
    expect(await hasColumn("events", "events", "venue_name")).toBe(false);
    const places = await inOrganization((tx) => tx<{ event_id: string; label: string; city: string | null }[]>`select event_id, label, city from events.event_places where organization_id = ${organizationId} order by event_id, position, created_at`);
    const placesOf = (eventId: string) => places.filter((place) => place.event_id === eventId).map((place) => [place.label, place.city]);
    // Le lieu du même nom (casse et espaces mis à part) devient le premier, avec la ville ; rien n'est créé.
    expect(placesOf(ids.named!)).toEqual([[" domaine des tilleuls ", "Lille"], ["Église du village", null]]);
    expect(placesOf(ids.other!)).toEqual([["Château de la Roche", "Arras"], ["Mairie", null]]);
    // Sans nom, la ville sert d'intitulé ; sans lieu, aucune ligne.
    expect(placesOf(ids.cityOnly!)).toEqual([["Amiens", null]]);
    expect(placesOf(ids.none!)).toEqual([]);

    await inOrganization((tx) => tx`update events.events set guests_estimated = 120, guests_confirmed = 98, style = 'Bohème', notes = 'Allergie aux fruits à coque' where id = ${ids.named!}`);
    await expect(inOrganization((tx) => tx`update events.events set guests_confirmed = -1 where id = ${ids.named!}`)).rejects.toThrow(/events_guests_check/);
    const [task] = await inOrganization((tx) => tx<{ id: string }[]>`insert into events.event_tasks (organization_id, event_id, label, due_date, responsible) values (${organizationId}, ${ids.named!}, 'Livrer les fleurs', '2027-06-11', 'vendor') returning id`);
    await inOrganization((tx) => tx`insert into events.event_task_comments (organization_id, event_id, task_id, body) values (${organizationId}, ${ids.named!}, ${task!.id}, 'Accès par le portail nord')`);

    for (const tag of [...LOT_36, ...LOT_35A, ...LOT_34B]) await rollback(tag);
    const venues = await inOrganization((tx) => tx<{ id: string; venue_name: string | null; venue_city: string | null }[]>`select id, venue_name, venue_city from events.events where organization_id = ${organizationId}`);
    expect(Object.fromEntries(venues.map((row) => [row.id, [row.venue_name, row.venue_city]]))).toEqual({
      [ids.named!]: [" domaine des tilleuls ", "Lille"],
      [ids.other!]: ["Château de la Roche", "Arras"],
      [ids.cityOnly!]: ["Amiens", null],
      [ids.none!]: [null, null],
    });
    const [back] = await inOrganization((tx) => tx<{ responsible: string }[]>`select responsible::text as responsible from events.event_tasks where id = ${task!.id}`);
    expect(back!.responsible).toBe("planner");
    expect(await hasColumn("events", "event_places", "contact_email")).toBe(false);
    expect(await hasColumn("events", "events", "guests_estimated")).toBe(false);
    const [comments] = await target<{ name: string | null }[]>`select to_regclass('events.event_task_comments')::text as name`;
    expect(comments!.name).toBeNull();
    await migrateAll();
  });

  it("lot 34a (EVT-05, DAT-07, ARC-17 ; D2) — 0132 : statuts du cahier des charges repris des anciens, historique compris ; écart des tâches ; fuseau ; l'annulation ramène les statuts du PRD", async () => {
    for (const tag of [...LOT_36, ...LOT_35A, ...LOT_34B, ...LOT_34A]) await rollback(tag);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const user = randomUUID();
    const ids: Record<string, string> = await inOrganization(async (tx) => {
      const byStatus: Record<string, string> = {};
      for (const status of ["prospect", "quote_sent", "confirmed", "done", "lost"]) {
        const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id, status, event_date, tasks_scheduled_for) values (${organizationId}, ${status}::events.event_status, '2027-06-12', '2027-06-05') returning id`;
        byStatus[status] = event!.id;
      }
      await tx`insert into events.event_status_history (organization_id, event_id, from_status, to_status, changed_by_user_id) values (${organizationId}, ${byStatus.lost!}, 'quote_sent', 'lost', ${user})`;
      const [task] = await tx<{ id: string }[]>`insert into events.event_tasks (organization_id, event_id, label, due_date) values (${organizationId}, ${byStatus.confirmed!}, 'Réserver le lieu', '2026-12-07') returning id`;
      return { ...byStatus, task: task!.id };
    });

    await migrateAll();
    const statuses = await inOrganization((tx) => tx<{ id: string; status: string; time_zone: string }[]>`select id, status::text as status, time_zone from events.events where organization_id = ${organizationId}`);
    const statusOf = (id: string) => statuses.find((row) => row.id === id)!.status;
    expect([ids.prospect, ids.quote_sent, ids.confirmed, ids.done, ids.lost].map((id) => statusOf(id!))).toEqual(["option", "option", "confirmed", "closed", "cancelled"]);
    expect(statuses.every((row) => row.time_zone === "Europe/Paris")).toBe(true);
    const [history] = await inOrganization((tx) => tx<{ from_status: string; to_status: string }[]>`select from_status::text as from_status, to_status::text as to_status from events.event_status_history where event_id = ${ids.lost!}`);
    expect(history).toEqual({ from_status: "option", to_status: "cancelled" });
    // DAT-07 : J-180 depuis la date de calcul du rétroplanning (5 juin), pas la date de l'événement.
    const [task] = await inOrganization((tx) => tx<{ offset_days: number | null }[]>`select offset_days from events.event_tasks where id = ${ids.task!}`);
    expect(task!.offset_days).toBe(-180);
    const [created] = await inOrganization((tx) => tx<{ status: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning status::text as status`);
    expect(created!.status).toBe("option");
    await inOrganization((tx) => tx`update events.events set status = 'in_preparation' where id = ${ids.confirmed!}`);

    for (const tag of [...LOT_36, ...LOT_35A, ...LOT_34B, ...LOT_34A]) await rollback(tag);
    const back = await inOrganization((tx) => tx<{ id: string; status: string }[]>`select id, status::text as status from events.events where id in (${ids.prospect!}, ${ids.confirmed!}, ${ids.done!}, ${ids.lost!})`);
    expect(Object.fromEntries(back.map((row) => [row.id, row.status]))).toEqual({ [ids.prospect!]: "prospect", [ids.confirmed!]: "confirmed", [ids.done!]: "done", [ids.lost!]: "lost" });
    expect(await hasColumn("events", "event_tasks", "offset_days")).toBe(false);
    expect(await hasColumn("events", "events", "time_zone")).toBe(false);
    await migrateAll();
    expect(await hasColumn("events", "task_templates", "event_type_id")).toBe(true);
  });

  it("lot 33b (HUB-09, HUB-03 ; D11, D12) — 0131 : volume, outils remplacés et rôle des invitations ; l'annulation est refusée tant qu'une invitation de Planner attend", async () => {
    const [organization] = await target<{ id: string }[]>`insert into hub.organizations (name) values ('Atelier du questionnaire') returning id`;
    await target`insert into hub.organization_profiles (organization_id, annual_event_volume, replaced_tools) values (${organization!.id}, '11_to_25', '{spreadsheet}')`;
    const [owner] = await target<{ role: string }[]>`insert into hub.invitations (organization_id, email, token_hash, expires_at) values (${organization!.id}, ${`titulaire-${randomUUID()}@symbola.test`}, ${`t-${randomUUID()}`}, now() + interval '7 days') returning role::text as role`;
    // Une invitation d'avant le lot 33b reste une invitation de Propriétaire.
    expect(owner!.role).toBe("owner");
    await expect(target`update hub.organization_profiles set replaced_tools = ${"{a,b,c,d,e,f,g,h,i,j,k}"}::text[] where organization_id = ${organization!.id}`).rejects.toThrow(/replaced_tools_check/);
    const [planner] = await target<{ id: string }[]>`insert into hub.invitations (organization_id, email, token_hash, expires_at, role) values (${organization!.id}, ${`planner-${randomUUID()}@symbola.test`}, ${`t-${randomUUID()}`}, now() + interval '7 days', 'member') returning id`;
    for (const tag of [...LOT_36, ...LOT_35A, ...LOT_34B, ...LOT_34A]) await rollback(tag);
    await expect(rollback(LOT_33B[0]!)).rejects.toThrow(/invitations de Planner/);
    await target`update hub.invitations set accepted_at = now() where id = ${planner!.id}`;
    await rollback(LOT_33B[0]!);
    expect(await hasColumn("hub", "invitations", "role")).toBe(false);
    expect(await hasColumn("hub", "organization_profiles", "replaced_tools")).toBe(false);
    await migrateAll();
    expect(await hasColumn("hub", "organization_profiles", "annual_event_volume")).toBe(true);
  });

  it("lot 33a (HUB-02, HUB-03, SEC-01, Q30 ; D6) — 0129 et 0130 : adhésions reprises des comptes, Exploitation marquée, mots de passe retirés ; annuler 0130 ne les rend pas, annuler 0129 ramène le rôle sur le compte, refusé pour un compte à deux organisations", async () => {
    // Avant 0129 : une organisation, sa titulaire, une Planner et l'Admin.
    for (const tag of LOT_33) await rollback(tag);
    const [organization] = await target<{ id: string }[]>`insert into hub.organizations (name) values ('Atelier de reprise') returning id`;
    const [other] = await target<{ id: string }[]>`insert into hub.organizations (name) values ('Autre atelier') returning id`;
    const suffix = randomUUID();
    const [owner] = await target<{ id: string }[]>`insert into hub.users (organization_id, email, password_hash, role) values (${organization!.id}, ${`titulaire-${suffix}@symbola.test`}, 'x', 'owner') returning id`;
    const [member] = await target<{ id: string }[]>`insert into hub.users (organization_id, email, password_hash, role, disabled_at) values (${organization!.id}, ${`planner-${suffix}@symbola.test`}, 'x', 'member', now()) returning id`;
    const [operator] = await target<{ id: string }[]>`insert into hub.users (email, password_hash, role) values (${`admin-${suffix}@symbola.test`}, 'x', 'admin') returning id`;
    await target`insert into hub.sessions (user_id, token_hash, expires_at) values (${owner!.id}, ${`h-${suffix}`}, now() + interval '1 hour')`;

    await migrateAll();
    const memberships = await target<{ user_id: string; organization_id: string; role: string; disabled: boolean }[]>`
      select user_id, organization_id, role::text as role, disabled_at is not null as disabled from hub.memberships where organization_id = ${organization!.id} order by role`;
    expect(memberships).toEqual([
      { user_id: member!.id, organization_id: organization!.id, role: "member", disabled: true },
      { user_id: owner!.id, organization_id: organization!.id, role: "owner", disabled: false },
    ]);
    const [admin] = await target<{ operator: boolean }[]>`select operator from hub.users where id = ${operator!.id}`;
    expect(admin!.operator).toBe(true);
    const [session] = await target<{ organization_id: string }[]>`select organization_id from hub.sessions where user_id = ${owner!.id}`;
    expect(session!.organization_id).toBe(organization!.id);

    // 0130 : plus de mot de passe ni d'organisation ou de rôle sur le compte.
    for (const column of ["password_hash", "totp_secret", "role", "organization_id", "failed_login_attempts"]) expect(await hasColumn("hub", "users", column)).toBe(false);
    expect(await hasColumn("hub", "trusted_devices", "token_hash")).toBe(false);
    // Annuler 0130 : colonnes revenues vides, organisation et rôle repris des adhésions ; les mots de
    // passe ne reviennent pas, donc revenir avant 0129 reste refusé.
    for (const tag of [...LOT_36, ...LOT_35A, ...LOT_34B, ...LOT_34A]) await rollback(tag);
    await rollback(LOT_33B[0]!);
    await rollback(LOT_33A[0]!);
    const restored = await target<{ id: string; role: string; organization_id: string | null; password_hash: string | null }[]>`
      select id, role::text as role, organization_id, password_hash from hub.users where id in (${owner!.id}, ${operator!.id}) order by role`;
    expect(restored).toEqual([
      { id: operator!.id, role: "admin", organization_id: null, password_hash: null },
      { id: owner!.id, role: "owner", organization_id: organization!.id, password_hash: null },
    ]);
    await expect(rollbackMigration(target, LOT_33A[1]!, folders)).rejects.toThrow(/ni mot de passe ni rôle/);
    // Pour éprouver le reste de l'annulation de 0129, des mots de passe d'avant sont remis à la main.
    await target`update hub.users set password_hash = 'x' where password_hash is null`;

    // Un compte dans deux organisations : l'ancien schéma ne sait pas le représenter.
    await target`insert into hub.memberships (user_id, organization_id, role) values (${owner!.id}, ${other!.id}, 'member')`;
    await expect(rollbackMigration(target, LOT_33A[1]!, folders)).rejects.toThrow(/plusieurs organisations/);
    await target`delete from hub.memberships where user_id = ${owner!.id} and organization_id = ${other!.id}`;
    // Un compte né chez le fournisseur, sans mot de passe : refus aussi.
    const [fresh] = await target<{ id: string }[]>`insert into hub.users (email, idp_subject) values (${`nouvelle-${suffix}@symbola.test`}, ${`sub-${suffix}`}) returning id`;
    await expect(rollbackMigration(target, LOT_33A[1]!, folders)).rejects.toThrow(/ni mot de passe ni rôle/);
    await target`delete from hub.users where id = ${fresh!.id}`;

    await rollback(LOT_33A[1]!);
    expect(await hasColumn("hub", "users", "idp_subject")).toBe(false);
    const back = await target<{ id: string; role: string; organization_id: string | null; disabled: boolean }[]>`
      select id, role::text as role, organization_id, disabled_at is not null as disabled from hub.users where id in (${owner!.id}, ${member!.id}, ${operator!.id}) order by role`;
    expect(back).toEqual([
      { id: operator!.id, role: "admin", organization_id: null, disabled: false },
      { id: member!.id, role: "member", organization_id: organization!.id, disabled: true },
      { id: owner!.id, role: "owner", organization_id: organization!.id, disabled: false },
    ]);

    await migrateAll();
    expect(await hasColumn("hub", "memberships", "role")).toBe(true);
  });

  it("lot 32a (PAR-03, D6) — 0127 et 0128 : la relance d'un prestataire dans l'activité de l'évènement ; l'annulation la retire, refusée tant qu'une relance est inscrite", async () => {
    for (const tag of LOT_33) await rollback(tag);
    await expect(rollback(LOT_32A[1]!)).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("events", "event_activities", "vendor_candidate_id")).toBe(true);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const activityId = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const [slot] = await tx<{ id: string }[]>`insert into events.event_vendor_slots (organization_id, event_id, label) values (${organizationId}, ${event!.id}, 'Photographe') returning id`;
      const [candidate] = await tx<{ id: string }[]>`insert into events.event_vendor_candidates (organization_id, event_id, vendor_slot_id, vendor_name, status) values (${organizationId}, ${event!.id}, ${slot!.id}, 'Studio Lumière', 'retained') returning id`;
      const [activity] = await tx<{ id: string }[]>`insert into events.event_activities (organization_id, event_id, kind, task_label, vendor_candidate_id) values (${organizationId}, ${event!.id}, 'vendor_reminded', 'Studio Lumière', ${candidate!.id}) returning id`;
      return activity!.id;
    });

    await rollback(LOT_32A[0]!);
    expect(await hasColumn("events", "event_activities", "vendor_candidate_id")).toBe(false);
    // Une relance est inscrite : la valeur ne peut pas partir.
    await expect(rollback(LOT_32A[1]!)).rejects.toThrow(/relances de prestataires/);
    await inOrganization((tx) => tx`delete from events.event_activities where id = ${activityId}`);
    await rollback(LOT_32A[1]!);
    const labels = await target<{ label: string }[]>`select e.enumlabel as label from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'events' and t.typname = 'event_activity_kind'`;
    expect(labels.map((row) => row.label)).not.toContain("vendor_reminded");

    await migrateAll();
    expect(await hasColumn("events", "event_activities", "vendor_candidate_id")).toBe(true);
  });

  it("lot 31c (FAC-05, JUR-01, JUR-08 ; D18, D21) — 0125 et 0126 : série des reçus, reçus d'arrhes immuables, conditions de paiement des professionnels et taux des pénalités ; l'annulation les retire", async () => {
    await expect(rollback(LOT_31C[1]!)).rejects.toBeInstanceOf(RollbackRefusedError);
    for (const tag of [...LOT_33, ...LOT_32A]) await rollback(tag);
    expect(await hasColumn("quotes", "quote_settings", "late_penalty_rate")).toBe(true);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    // Le taux des pénalités : l'un des deux proposés, ou aucun.
    await expect(inOrganization((tx) => tx`insert into quotes.quote_settings (organization_id, late_penalty_rate) values (${organizationId}, 'bce')`)).rejects.toThrow(/quote_settings_late_penalty_rate_check/);
    await inOrganization((tx) => tx`insert into quotes.quote_settings (organization_id, late_penalty_rate) values (${organizationId}, 'three_times_legal')`);
    const receiptId = await inOrganization(async (tx) => {
      const [quote] = await tx<{ id: string }[]>`insert into quotes.quotes (organization_id, event_id, number, created_by_user_id) values (${organizationId}, ${randomUUID()}, ${"D-2027-" + randomUUID().slice(0, 4)}, ${randomUUID()}) returning id`;
      const [version] = await tx<{ id: string }[]>`insert into quotes.quote_versions (organization_id, quote_id, version, advance_kind) values (${organizationId}, ${quote!.id}, 1, 'earnest') returning id`;
      const [item] = await tx<{ id: string }[]>`insert into quotes.payment_schedule_items (organization_id, version_id, label, amount_cents, due_date) values (${organizationId}, ${version!.id}, 'Arrhes', 50000, '2027-01-15') returning id`;
      const [entry] = await tx<{ id: string }[]>`insert into quotes.payment_entries (organization_id, schedule_item_id, kind, amount_cents, paid_on) values (${organizationId}, ${item!.id}, 'received', 50000, '2027-01-10') returning id`;
      await tx`insert into quotes.number_series (organization_id, kind, year, last_number) values (${organizationId}, 'receipt', 2027, 1)`;
      const [receipt] = await tx<{ id: string }[]>`insert into quotes.earnest_receipts (organization_id, quote_id, schedule_item_id, payment_entry_id, number, issued_at, issued_on, paid_on, amount_cents, label, seller_snapshot, buyer_snapshot)
        values (${organizationId}, ${quote!.id}, ${item!.id}, ${entry!.id}, 'R-2027-0001', now(), '2027-01-10', '2027-01-10', 50000, 'Arrhes', ${JSON.stringify({ organizationName: "Atelier" })}::jsonb, ${JSON.stringify([{ name: "Léa", billingAddress: "1 rue des Lilas" }])}::jsonb) returning id`;
      return receipt!.id;
    });
    // Un reçu émis ne change pas (même déclencheur que les factures).
    await expect(inOrganization((tx) => tx`update quotes.earnest_receipts set amount_cents = 1 where id = ${receiptId}`)).rejects.toThrow(/immuable/);

    await rollback(LOT_31C[0]!);
    expect(await hasColumn("quotes", "earnest_receipts", "id")).toBe(false);
    expect(await hasColumn("quotes", "quote_settings", "late_penalty_rate")).toBe(false);
    expect(await hasColumn("quotes", "quote_settings", "receipt_prefix")).toBe(false);
    await rollback(LOT_31C[1]!);
    const labels = await target<{ label: string }[]>`select e.enumlabel as label from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'quotes' and t.typname = 'number_series_kind'`;
    expect(labels.map((row) => row.label)).not.toContain("receipt");

    await migrateAll();
    expect(await hasColumn("quotes", "earnest_receipts", "payment_entry_id")).toBe(true);
  });

  it("lot 31b (FAC-04, FAC-05, DOC-03, JUR-07 ; D11, D16) — 0122 à 0124 : client non-professionnel, contrats, actes des signataires, signature du devis et du contrat, facture d'acompte à émettre, conservation de dix ans ; l'annulation les retire", async () => {
    await expect(rollback(LOT_31B[1]!)).rejects.toBeInstanceOf(RollbackRefusedError);
    for (const tag of [...LOT_33, ...LOT_32A, ...LOT_31C]) await rollback(tag);
    expect(await hasColumn("quotes", "contracts", "conclusion_channel")).toBe(true);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const { versionId, quoteId } = await inOrganization(async (tx) => {
      const [quote] = await tx<{ id: string }[]>`insert into quotes.quotes (organization_id, event_id, number, created_by_user_id, client_kind) values (${organizationId}, ${randomUUID()}, ${"D-2027-" + randomUUID().slice(0, 4)}, ${randomUUID()}, 'non_professional') returning id`;
      const [version] = await tx<{ id: string }[]>`insert into quotes.quote_versions (organization_id, quote_id, version) values (${organizationId}, ${quote!.id}, 1) returning id`;
      return { versionId: version!.id, quoteId: quote!.id };
    });
    const insertContract = (channel: string, version: number) =>
      inOrganization(
        (tx) =>
          tx<{ id: string }[]>`insert into quotes.contracts (organization_id, quote_id, quote_version_id, version, template_version, title, clauses, conclusion_channel, client_category, withdrawal_applies)
            values (${organizationId}, ${quoteId}, ${versionId}, ${version}, 1, 'Contrat', ${JSON.stringify([{ title: "Objet", body: "Mariage", role: null }])}::jsonb, ${channel}, 'individual', ${channel === "distance"}) returning id`,
      );
    // Foire ou salon : modèle dédié, jamais généré ici (réponse 1 de l'avocat).
    await expect(insertContract("fair", 1)).rejects.toThrow(/contracts_channel_check/);
    const [contract] = await insertContract("distance", 1);
    const request = (kind: string, contractId: string | null) =>
      inOrganization(
        (tx) => tx`insert into quotes.signature_requests (organization_id, version_id, provider, external_id, kind, contract_id) values (${organizationId}, ${versionId}, 'fake', ${randomUUID()}, ${kind}, ${contractId})`,
      );
    // Le devis se signe une fois par version (seul ou avec son contrat) ; le contrat seul, une fois.
    await expect(request("quote_contract", null)).rejects.toThrow(/signature_requests_kind_check/);
    await request("quote_contract", contract!.id);
    await expect(request("quote", null)).rejects.toThrow(/signature_requests_quote_version_unique/);
    const [later] = await insertContract("on_premises", 2);
    await request("contract", later!.id);
    await expect(request("contract", later!.id)).rejects.toThrow(/signature_requests_contract_unique/);

    for (const tag of LOT_31B.slice(0, 2)) await rollback(tag);
    expect(await hasColumn("quotes", "contracts", "id")).toBe(false);
    expect(await hasColumn("quotes", "signature_requests", "kind")).toBe(false);
    expect(await hasColumn("quotes", "scheduled_deposit_invoices", "id")).toBe(false);
    // La demande du devis et de son contrat reste, comme demande du devis ; celle du contrat seul part.
    const remaining = await target`select 1 from quotes.signature_requests where version_id = ${versionId}`;
    expect(remaining).toHaveLength(1);
    // Un devis a un client non-professionnel : l'annulation de 0122 est refusée.
    await expect(rollback(LOT_31B[2]!)).rejects.toThrow(/non-professionnel/);
    await inOrganization((tx) => tx`update quotes.quotes set client_kind = 'individual' where id = ${quoteId}`);
    await rollback(LOT_31B[2]!);

    await migrateAll();
    expect(await hasColumn("quotes", "scheduled_deposit_invoices", "payment_not_before")).toBe(true);
  });

  it("lot 31a (FAC-01, HUB-21, JUR-08, JUR-09) — 0120 et 0121 : sections, options, modèles, acompte ou arrhes, assurance et médiateur ; l'annulation les retire", async () => {
    await expect(rollback(LOT_31A[1]!)).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("quotes", "quote_lines", "is_option")).toBe(true);
    expect(await hasColumn("hub", "organization_profiles", "mediator_name")).toBe(true);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    await inOrganization(async (tx) => {
      const [quote] = await tx<{ id: string }[]>`insert into quotes.quotes (organization_id, event_id, number, created_by_user_id) values (${organizationId}, ${randomUUID()}, ${"D-2027-" + randomUUID().slice(0, 4)}, ${randomUUID()}) returning id`;
      const [version] = await tx<{ id: string }[]>`insert into quotes.quote_versions (organization_id, quote_id, version, advance_kind) values (${organizationId}, ${quote!.id}, 1, 'earnest') returning id`;
      const [section] = await tx<{ id: string }[]>`insert into quotes.quote_sections (organization_id, version_id, title) values (${organizationId}, ${version!.id}, 'Décoration') returning id`;
      await tx`insert into quotes.quote_lines (organization_id, version_id, label, unit, quantity_milli, unit_price_cents, vat_rate_basis_points, section_id, is_option) values (${organizationId}, ${version!.id}, 'Arche fleurie', 'forfait', 1000, 90000, 2000, ${section!.id}, true)`;
    });
    // Choix des options : nominatif et daté, ou rien ; échéancier type : à la signature ou N jours avant.
    await expect(inOrganization((tx) => tx`update quotes.quote_versions set options_chosen_at = now() where organization_id = ${organizationId}`)).rejects.toThrow(/quote_versions_options_chosen_check/);
    await expect(
      inOrganization(async (tx) => {
        const [template] = await tx<{ id: string }[]>`insert into quotes.quote_templates (organization_id, name) values (${organizationId}, 'Mariage') returning id`;
        await tx`insert into quotes.quote_template_schedule_items (organization_id, template_id, label, percentage_basis_points, due_rule, days_before_event) values (${organizationId}, ${template!.id}, 'Acompte', 3000, 'at_signature', 10)`;
      }),
    ).rejects.toThrow(/quote_template_schedule_items_due_check/);

    for (const tag of [...LOT_33, ...LOT_32A, ...LOT_31C, ...LOT_31B, ...LOT_31A]) await rollback(tag);
    expect(await hasColumn("quotes", "quote_lines", "is_option")).toBe(false);
    expect(await hasColumn("quotes", "quote_sections", "id")).toBe(false);
    expect(await hasColumn("hub", "organization_profiles", "mediator_name")).toBe(false);
    expect(await hasColumn("quotes", "quote_lines", "label")).toBe(true);

    await migrateAll();
    expect(await hasColumn("quotes", "quote_templates", "version")).toBe(true);
  });

  it("lot 30b (CHR-06, décision D6) — 0119 : responsable d'une séquence, texte court ; l'annulation le retire", async () => {
    await expect(rollback(LOT_30A)).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("events", "program_items", "responsible")).toBe(true);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const eventId = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      await tx`insert into events.program_items (organization_id, event_id, start_time, label, responsible) values (${organizationId}, ${event!.id}, '16:00', 'Cérémonie', 'Camille')`;
      return event!.id;
    });
    // Un responsable vide ou trop long : refusé.
    await expect(inOrganization((tx) => tx`insert into events.program_items (organization_id, event_id, start_time, label, responsible) values (${organizationId}, ${eventId}, '17:00', 'Cocktail', '')`)).rejects.toThrow(
      /program_items_responsible_check/,
    );
    await expect(
      inOrganization((tx) => tx`insert into events.program_items (organization_id, event_id, start_time, label, responsible) values (${organizationId}, ${eventId}, '17:00', 'Cocktail', ${"x".repeat(121)})`),
    ).rejects.toThrow(/program_items_responsible_check/);

    for (const tag of [...LOT_33, ...LOT_32A, ...LOT_31C, ...LOT_31B, ...LOT_31A]) await rollback(tag);
    await rollback(LOT_30B);
    expect(await hasColumn("events", "program_items", "responsible")).toBe(false);
    expect(await hasColumn("events", "program_items", "label")).toBe(true);

    await migrateAll();
    expect(await hasColumn("events", "program_items", "responsible")).toBe(true);
  });

  it("lot 30a (JRJ-03, décision D4) — 0118 : contacts du jour J, contraints ; l'annulation les retire", async () => {
    await expect(rollback(LOT_29B)).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("events", "event_day_contacts", "phone")).toBe(true);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const eventId = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      await tx`insert into events.event_day_contacts (organization_id, event_id, name, role, phone) values (${organizationId}, ${event!.id}, 'Régisseur', 'Domaine', '06 00 00 00 00')`;
      return event!.id;
    });
    // Un téléphone trop court, un nom vide : refusés.
    await expect(inOrganization((tx) => tx`insert into events.event_day_contacts (organization_id, event_id, name, phone) values (${organizationId}, ${eventId}, 'Taxi', '1')`)).rejects.toThrow(
      /event_day_contacts_phone_check/,
    );
    await expect(inOrganization((tx) => tx`insert into events.event_day_contacts (organization_id, event_id, name, phone) values (${organizationId}, ${eventId}, '', '0600000000')`)).rejects.toThrow(
      /event_day_contacts_name_check/,
    );

    for (const tag of [...LOT_33, ...LOT_32A, ...LOT_31C, ...LOT_31B, ...LOT_31A]) await rollback(tag);
    await rollback(LOT_30B);
    await rollback(LOT_30A);
    expect(await hasColumn("events", "event_day_contacts", "id")).toBe(false);

    await migrateAll();
    expect(await hasColumn("events", "event_day_contacts", "phone")).toBe(true);
  });

  it("lot 29b (JRJ-04, décision D8) — 0117 : documents de l'événement et documents embarqués, contraints ; l'annulation les retire", async () => {
    await expect(rollback(LOT_27B)).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("events", "event_documents", "file_key")).toBe(true);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const eventId = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      await tx`insert into events.event_documents (organization_id, event_id, label, file_key, mime, size_bytes, uploaded_by_user_id)
        values (${organizationId}, ${event!.id}, 'Plan de table', ${`${organizationId}/plan.pdf`}, 'application/pdf', 1024, ${randomUUID()})`;
      await tx`insert into events.event_day_documents (organization_id, event_id, source, source_id) values (${organizationId}, ${event!.id}, 'event_document', ${randomUUID()})`;
      return event!.id;
    });
    // Une source inconnue (un RIB du carnet), un intitulé vide : refusés.
    await expect(
      inOrganization((tx) => tx`insert into events.event_day_documents (organization_id, event_id, source, source_id) values (${organizationId}, ${eventId}, 'vendor_file', ${randomUUID()})`),
    ).rejects.toThrow(/event_day_documents_source_check/);
    await expect(
      inOrganization((tx) => tx`insert into events.event_documents (organization_id, event_id, label, file_key, mime, size_bytes, uploaded_by_user_id) values (${organizationId}, ${eventId}, '', 'k', 'application/pdf', 1, ${randomUUID()})`),
    ).rejects.toThrow(/event_documents_label_check/);

    for (const tag of [...LOT_33, ...LOT_32A, ...LOT_31C, ...LOT_31B, ...LOT_31A]) await rollback(tag);
    await rollback(LOT_30B);
    await rollback(LOT_30A);
    await rollback(LOT_29B);
    expect(await hasColumn("events", "event_documents", "id")).toBe(false);
    expect(await hasColumn("events", "event_day_documents", "id")).toBe(false);

    await migrateAll();
    expect(await hasColumn("events", "event_documents", "file_key")).toBe(true);
  });

  it("lot 27b (POR-03, EVT-09) — 0116 : décisions du client, garde d'immuabilité, fil d'activité ; l'annulation les retire", async () => {
    await expect(rollback("0115_lot27a_budget_payment_declarations")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("events", "event_decisions", "snapshot")).toBe(true);
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const [decision] = await tx<{ id: string }[]>`insert into events.event_decisions (organization_id, event_id, kind, title, snapshot, status, decided_at)
        values (${organizationId}, ${event!.id}, 'program', '', ${JSON.stringify({ kind: "program", programUpdatedAt: null, itemCount: 1 })}::jsonb, 'approved', now()) returning id`;
      await tx`insert into events.event_activities (organization_id, event_id, kind, task_label) values (${organizationId}, ${event!.id}, 'decision_made', '')`;
      return { eventId: event!.id, decisionId: decision!.id };
    });
    // La garde : une décision répondue ne change plus ; une réponse sans date n'existe pas.
    await expect(inOrganization((tx) => tx`update events.event_decisions set status = 'declined' where id = ${ids.decisionId}`)).rejects.toThrow(/ne se modifie plus/);
    await expect(
      inOrganization((tx) => tx`insert into events.event_decisions (organization_id, event_id, kind, title, snapshot, status) values (${organizationId}, ${ids.eventId}, 'program', '', '{}'::jsonb, 'approved')`),
    ).rejects.toThrow(/event_decisions_answer_check/);

    for (const tag of [...LOT_33, ...LOT_32A, ...LOT_31C, ...LOT_31B, ...LOT_31A]) await rollback(tag);
    await rollback(LOT_30B);
    await rollback(LOT_30A);
    await rollback(LOT_29B);
    await rollback(LOT_27B);
    expect(await hasColumn("events", "event_decisions", "id")).toBe(false);
    const [kinds] = await target<{ labels: string[] }[]>`select array_agg(e.enumlabel::text order by e.enumsortorder) as labels from pg_enum e join pg_type t on t.oid = e.enumtypid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'events' and t.typname = 'event_activity_kind'`;
    expect(kinds!.labels).toEqual(["task_done", "task_undone"]);
    const [left] = await inOrganization((tx) => tx<{ n: number }[]>`select count(*)::int as n from events.event_activities where event_id = ${ids.eventId}`);
    expect(left!.n).toBe(0);

    await migrateAll();
    expect(await hasColumn("events", "event_decisions", "snapshot")).toBe(true);
  });

  it("lot 27a (CHR-04, SC-06 ; décisions D6 et D7) — 0114 et 0115 : rappels des tâches, langue du lien, règlement déclaré ; l'annulation les retire", async () => {
    await expect(rollback("0114_lot27a_events_task_reminders")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("events", "event_links", "task_reminders")).toBe(true);
    expect(await hasColumn("events", "event_links", "locale")).toBe(true);
    expect(await hasColumn("events", "event_task_reminders", "threshold")).toBe(true);
    expect(await hasColumn("budget", "vendor_payments", "declared_paid_on")).toBe(true);

    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const [slot] = await tx<{ id: string }[]>`insert into events.event_vendor_slots (organization_id, event_id, label) values (${organizationId}, ${event!.id}, 'Traiteur') returning id`;
      const [line] = await tx<{ id: string }[]>`insert into budget.budget_lines (organization_id, event_id, event_vendor_slot_id, label) values (${organizationId}, ${event!.id}, ${slot!.id}, 'Traiteur') returning id`;
      const [payment] = await tx<{ id: string }[]>`insert into budget.vendor_payments (organization_id, event_id, line_id, label, fixed_amount_cents, due_on) values (${organizationId}, ${event!.id}, ${line!.id}, 'Acompte', 288000, '2027-02-01') returning id`;
      return { eventId: event!.id, paymentId: payment!.id };
    });
    // La base garde une déclaration entière ou rien.
    await expect(
      inOrganization((tx) => tx`update budget.vendor_payments set declared_paid_on = '2027-01-30' where id = ${ids.paymentId}`),
    ).rejects.toThrow(/vendor_payments_declaration_check/);
    await expect(
      inOrganization((tx) => tx`insert into events.event_links (organization_id, event_id, audience, person_name, email, locale) values (${organizationId}, ${ids.eventId}, 'client', 'Léa', 'lea@example.test', 'de')`),
    ).rejects.toThrow(/event_links_locale_check/);

    for (const tag of [...LOT_33, ...LOT_32A, ...LOT_31C, ...LOT_31B, ...LOT_31A]) await rollback(tag);
    await rollback(LOT_30B);
    await rollback(LOT_30A);
    await rollback(LOT_29B);
    await rollback(LOT_27B);
    await rollback("0115_lot27a_budget_payment_declarations");
    expect(await hasColumn("budget", "vendor_payments", "declared_paid_on")).toBe(false);
    expect(await hasColumn("budget", "vendor_payments", "refusal_reason")).toBe(false);
    await rollback("0114_lot27a_events_task_reminders");
    expect(await hasColumn("events", "event_links", "task_reminders")).toBe(false);
    expect(await hasColumn("events", "event_links", "locale")).toBe(false);
    expect(await hasColumn("events", "event_task_reminders", "id")).toBe(false);
    const [kept] = await inOrganization((tx) => tx<{ n: number }[]>`select count(*)::int as n from budget.vendor_payments where id = ${ids.paymentId}`);
    expect(kept!.n).toBe(1);

    await migrateAll();
    expect(await hasColumn("events", "event_task_reminders", "threshold")).toBe(true);
    expect(await hasColumn("budget", "vendor_payments", "refused_at")).toBe(true);
  });

  it("lot 26b (POR-01, décisions D6 et D9) — 0113 : lien du prestataire et codes à usage unique ; l'annulation retire les liens des prestataires et les codes", async () => {
    await expect(rollback("0112_lot26a_events_drop_client_accesses")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("events", "event_links", "vendor_candidate_id")).toBe(true);
    expect(await hasColumn("events", "event_links", "otp_required")).toBe(true);
    expect(await hasColumn("events", "event_link_codes", "code_hash")).toBe(true);

    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const [slot] = await tx<{ id: string }[]>`insert into events.event_vendor_slots (organization_id, event_id, label) values (${organizationId}, ${event!.id}, 'Traiteur') returning id`;
      const [candidate] = await tx<{ id: string }[]>`insert into events.event_vendor_candidates (organization_id, event_id, vendor_slot_id, vendor_name)
        values (${organizationId}, ${event!.id}, ${slot!.id}, 'Traiteur Karim') returning id`;
      const [vendor] = await tx<{ id: string }[]>`insert into events.event_links (organization_id, event_id, audience, person_name, email, vendor_candidate_id, otp_required)
        values (${organizationId}, ${event!.id}, 'vendor', 'Karim', 'karim@example.test', ${candidate!.id}, true) returning id`;
      const [client] = await tx<{ id: string }[]>`insert into events.event_links (organization_id, event_id, audience, person_name, email, otp_required)
        values (${organizationId}, ${event!.id}, 'client', 'Léa', 'lea@example.test', true) returning id`;
      await tx`insert into events.event_link_codes (organization_id, link_id, code_hash, expires_at) values (${organizationId}, ${vendor!.id}, 'haché', now() + interval '10 minutes')`;
      return { eventId: event!.id, candidateId: candidate!.id, vendorLinkId: vendor!.id, clientLinkId: client!.id };
    });
    // La base exige le prestataire d'un lien « vendor ».
    await expect(
      inOrganization((tx) => tx`insert into events.event_links (organization_id, event_id, audience, person_name, email) values (${organizationId}, ${ids.eventId}, 'vendor', 'Sans poste', 'x@example.test')`),
    ).rejects.toThrow(/event_links_vendor_candidate_check/);

    for (const tag of [...LOT_33, ...LOT_32A, ...LOT_31C, ...LOT_31B, ...LOT_31A]) await rollback(tag);
    await rollback(LOT_30B);
    await rollback(LOT_30A);
    await rollback(LOT_29B);
    await rollback(LOT_27B);
    for (const tag of LOT_27A) await rollback(tag);
    await rollback(LOT_26B);
    expect(await hasColumn("events", "event_links", "vendor_candidate_id")).toBe(false);
    expect(await hasColumn("events", "event_links", "otp_required")).toBe(false);
    expect(await hasColumn("events", "event_link_codes", "id")).toBe(false);
    const links = await inOrganization((tx) => tx<{ id: string }[]>`select id from events.event_links where event_id = ${ids.eventId}`);
    expect(links.map((link) => link.id)).toEqual([ids.clientLinkId]);

    await migrateAll();
    expect(await hasColumn("events", "event_link_codes", "code_hash")).toBe(true);
    const [kept] = await inOrganization((tx) => tx<{ otp: boolean }[]>`select otp_required as otp from events.event_links where id = ${ids.clientLinkId}`);
    expect(kept!.otp).toBe(false);
  });

  it("lot 26a (UX-11, SEC-14, ADR 0053) — 0109 à 0112 : liens personnels, auteur « link », rôle client retiré ; l'annulation rend les structures, sans les données", async () => {
    await expect(rollback("0109_lot26a_events_links")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("events", "event_links", "token_hash")).toBe(true);
    expect(await hasColumn("hub", "privacy_settings", "link_privacy_notice")).toBe(true);
    expect(await hasColumn("events", "event_client_accesses", "email")).toBe(false);
    // Lot 33a : le type des rôles du compte disparaît avec 0130 ; son annulation le recrée.
    expect(await roles()).toEqual([]);

    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const [link] = await tx<{ id: string }[]>`insert into events.event_links (organization_id, event_id, audience, person_name, email, rubrics)
        values (${organizationId}, ${event!.id}, 'client', 'Léa', 'lea@example.test', ${["tasks"]}) returning id`;
      await tx`insert into events.event_activities (organization_id, event_id, actor_link_id, kind, task_label) values (${organizationId}, ${event!.id}, ${link!.id}, 'task_done', 'Alliances')`;
      await tx`insert into core.audit_entries (organization_id, action, category, actor_kind, actor_id) values (${organizationId}, 'events.link.opened', 'connexion', 'link', ${link!.id})`;
      return { eventId: event!.id, linkId: link!.id };
    });
    // La base tient la liste des rubriques.
    await expect(
      inOrganization((tx) => tx`update events.event_links set rubrics = ${["tout"]} where id = ${ids.linkId}`),
    ).rejects.toThrow(/event_links_rubrics_check/);

    for (const tag of [...LOT_33, ...LOT_32A, ...LOT_31C, ...LOT_31B, ...LOT_31A]) await rollback(tag);
    await rollback(LOT_30B);
    await rollback(LOT_30A);
    await rollback(LOT_29B);
    await rollback(LOT_27B);
    for (const tag of LOT_27A) await rollback(tag);
    await rollback(LOT_26B);
    await rollback("0112_lot26a_events_drop_client_accesses");
    expect(await hasColumn("events", "event_client_accesses", "email")).toBe(true);
    await rollback("0111_lot26a_hub_roles_notice");
    expect(await roles()).toEqual(["owner", "member", "client", "admin"]);
    expect(await hasColumn("hub", "privacy_settings", "link_privacy_notice")).toBe(false);
    await rollback("0110_lot26a_core_link_actor");
    // Le journal est en ajout seul : la ligne écrite par un lien reste, mais plus de nouvelle.
    const [kept] = await inOrganization((tx) => tx<{ n: number }[]>`select count(*)::int as n from core.audit_entries where actor_kind = 'link' and organization_id = ${organizationId}`);
    expect(kept!.n).toBe(1);
    await expect(
      inOrganization((tx) => tx`insert into core.audit_entries (organization_id, action, category, actor_kind) values (${organizationId}, 'events.link.opened', 'connexion', 'link')`),
    ).rejects.toThrow(/audit_entries_actor_kind_check/);
    await rollback("0109_lot26a_events_links");
    expect(await hasColumn("events", "event_links", "id")).toBe(false);
    expect(await hasColumn("events", "event_activities", "actor_link_id")).toBe(false);
    const [activities] = await inOrganization((tx) => tx<{ n: number }[]>`select count(*)::int as n from events.event_activities where event_id = ${ids.eventId}`);
    expect(activities!.n).toBe(0);

    // Aller de nouveau : un compte « client » d'avant le lot disparaît avec sa session.
    const [organization] = await target<{ id: string }[]>`insert into hub.organizations (name) values (${`Org ${randomUUID()}`}) returning id`;
    const [client] = await target<{ id: string }[]>`insert into hub.users (organization_id, email, password_hash, role)
      values (${organization!.id}, ${`marie-${randomUUID()}@example.test`}, 'x', 'client') returning id`;
    await target`insert into hub.sessions (user_id, token_hash, expires_at) values (${client!.id}, ${`jeton-${randomUUID()}`}, now() + interval '1 day')`;
    await migrateAll();
    expect(await target`select 1 from hub.users where id = ${client!.id}`).toHaveLength(0);
    // Lot 33a : 0130 retire le type des rôles du compte (les rôles sont sur les adhésions).
    expect(await roles()).toEqual([]);
    expect(await hasColumn("events", "event_links", "token_hash")).toBe(true);
    // Retour à 0108 pour la suite.
    await rollbackLot26();
  });

  it("lot 28c (BUD-09, PRE-01) — 0107 et 0108 ajoutent le taux de TVA des lignes, l'évaluation et les tarifs des fiches, bornés, et s'annulent", async () => {
    const vat = "0107_lot28c_budget_vat_rate";
    const vendorRating = "0108_lot28c_vendors_rating_prices";
    await expect(rollback(vat)).rejects.toBeInstanceOf(RollbackRefusedError);

    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const [slot] = await tx<{ id: string }[]>`insert into events.event_vendor_slots (organization_id, event_id, label) values (${organizationId}, ${event!.id}, 'Traiteur') returning id`;
      const [line] = await tx<{ id: string }[]>`insert into budget.budget_lines (organization_id, event_id, event_vendor_slot_id, label, committed_amount_cents, vat_rate_basis_points)
        values (${organizationId}, ${event!.id}, ${slot!.id}, 'Dîner', 960000, 550) returning id`;
      const [vendor] = await tx<{ id: string }[]>`insert into vendors.vendors (organization_id, name, rating, indicative_prices)
        values (${organizationId}, 'Maison Haddad', 4, 'À partir de 85 € par couvert') returning id`;
      return { lineId: line!.id, vendorId: vendor!.id, slotId: slot!.id, eventId: event!.id };
    });
    // Bornes tenues par la base : taux de 0 à 100 %, évaluation de 1 à 5.
    await expect(inOrganization((tx) => tx`update budget.budget_lines set vat_rate_basis_points = 10001 where id = ${ids.lineId}`)).rejects.toThrow(/budget_lines_vat_rate_check/);
    await expect(inOrganization((tx) => tx`update vendors.vendors set rating = 6 where id = ${ids.vendorId}`)).rejects.toThrow(/vendors_rating_check/);

    await rollback(vendorRating);
    expect(await hasColumn("vendors", "vendors", "rating")).toBe(false);
    expect(await hasColumn("vendors", "vendors", "indicative_prices")).toBe(false);
    await rollback(vat);
    expect(await hasColumn("budget", "budget_lines", "vat_rate_basis_points")).toBe(false);
    // Les montants TTC et la fiche restent.
    const kept = await inOrganization(async (tx) => ({
      line: await tx<{ amount: number }[]>`select committed_amount_cents as amount from budget.budget_lines where id = ${ids.lineId}`,
      vendor: await tx<{ name: string }[]>`select name from vendors.vendors where id = ${ids.vendorId}`,
    }));
    expect(kept).toEqual({ line: [{ amount: 960000 }], vendor: [{ name: "Maison Haddad" }] });

    // Aller de nouveau : colonnes vides, puis retour à 0106 pour la suite.
    await migrateAll();
    await rollbackLot26();
    expect(await hasColumn("vendors", "vendors", "rating")).toBe(true);
    expect(await hasColumn("budget", "budget_lines", "vat_rate_basis_points")).toBe(true);
    await inOrganization(async (tx) => {
      await tx`delete from budget.budget_lines where event_vendor_slot_id = ${ids.slotId}`;
      await tx`delete from vendors.vendors where id = ${ids.vendorId}`;
    });
    await rollback(vendorRating);
    await rollback(vat);
  });

  it("lot 28b (BUD-01, PRE-02, ADR 0054) — 0105 et 0106 reprennent lignes et prestataires d'avant le lot, et s'annulent", async () => {
    const lines = "0105_lot28b_budget_lines_payments";
    const vendors = "0106_lot28b_events_retained_vendors";
    await expect(rollback(lines)).rejects.toBeInstanceOf(RollbackRefusedError);

    // Retour refusé tant qu'une catégorie a plusieurs lignes.
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    const ids = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const [slot] = await tx<{ id: string }[]>`insert into events.event_vendor_slots (organization_id, event_id, label) values (${organizationId}, ${event!.id}, 'Musique') returning id`;
      const [extra] = await tx<{ id: string }[]>`insert into budget.budget_lines (organization_id, event_id, event_vendor_slot_id, label, position, estimated_amount_cents)
        values (${organizationId}, ${event!.id}, ${slot!.id}, 'DJ de la soirée', 0, 110000), (${organizationId}, ${event!.id}, ${slot!.id}, 'Musiciens de la cérémonie', 1, 50000) returning id`;
      return { eventId: event!.id, slotId: slot!.id, extraId: extra!.id };
    });
    await rollback(vendors);
    expect(await hasColumn("events", "event_vendor_slots", "selected_candidate_id")).toBe(true);
    await expect(rollback(lines)).rejects.toThrow(/plusieurs lignes/);
    await inOrganization((tx) => tx`delete from budget.budget_lines where event_vendor_slot_id = ${ids.slotId} and id <> ${ids.extraId}`);
    await rollback(lines);
    expect(await hasColumn("budget", "budget_lines", "label")).toBe(false);
    expect(await hasColumn("budget", "vendor_payments", "label")).toBe(false);

    // Données d'avant le lot : un traiteur retenu (prestataire choisi), un fleuriste
    // seulement nommé sur le poste (import du lot 5).
    const before = await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const [caterer] = await tx<{ id: string }[]>`insert into events.event_vendor_slots (organization_id, event_id, label, vendor_name, amount_cents, position)
        values (${organizationId}, ${event!.id}, 'Traiteur', 'Maison Haddad', 960000, 0) returning id`;
      const [haddad] = await tx<{ id: string }[]>`insert into events.event_vendor_candidates (organization_id, event_id, vendor_slot_id, vendor_name, status, quote_amount_cents, position)
        values (${organizationId}, ${event!.id}, ${caterer!.id}, 'Maison Haddad', 'retained', 960000, 0) returning id`;
      await tx`update events.event_vendor_slots set selected_candidate_id = ${haddad!.id} where id = ${caterer!.id}`;
      const [florist] = await tx<{ id: string }[]>`insert into events.event_vendor_slots (organization_id, event_id, label, vendor_name, position)
        values (${organizationId}, ${event!.id}, 'Fleuriste', 'Fleurs Martin', 1) returning id`;
      await tx`insert into budget.budget_lines (organization_id, event_id, event_vendor_slot_id, estimated_amount_cents, committed_amount_cents)
        values (${organizationId}, ${event!.id}, ${caterer!.id}, 1087100, 960000), (${organizationId}, ${event!.id}, ${florist!.id}, 300000, null)`;
      return { eventId: event!.id, catererId: caterer!.id, floristId: florist!.id, haddadId: haddad!.id };
    });

    await migrateAll();
    await rollbackLot26();
    const after = await inOrganization(async (tx) => ({
      lines: await tx<{ slot: string; label: string; vendor: string | null }[]>`select event_vendor_slot_id as slot, label, vendor_candidate_id as vendor from budget.budget_lines where event_id = ${before.eventId} order by label`,
      candidates: await tx<{ slot: string; name: string; status: string }[]>`select vendor_slot_id as slot, vendor_name as name, status::text as status from events.event_vendor_candidates where event_id = ${before.eventId} order by vendor_name`,
      kinds: await tx<{ kind: string }[]>`select distinct kind::text as kind from budget.budget_line_attachments`,
    }));
    expect(after.lines).toEqual([
      { slot: before.floristId, label: "Fleuriste", vendor: null },
      { slot: before.catererId, label: "Traiteur", vendor: before.haddadId },
    ]);
    expect(after.candidates).toEqual([
      { slot: before.floristId, name: "Fleurs Martin", status: "shortlisted" },
      { slot: before.catererId, name: "Maison Haddad", status: "retained" },
    ]);
    expect(await hasColumn("events", "event_vendor_slots", "vendor_name")).toBe(false);

    // Retour à 0104 pour la suite : le poste retrouve son prestataire choisi
    // (migrateAll a aussi appliqué les migrations du 28c).
    await rollback("0108_lot28c_vendors_rating_prices");
    await rollback("0107_lot28c_budget_vat_rate");
    await rollback(vendors);
    await rollback(lines);
    const back = await inOrganization((tx) =>
      tx<{ label: string; vendor: string | null; selected: string | null; amount: number | null }[]>`select label, vendor_name as vendor, selected_candidate_id as selected, amount_cents as amount
        from events.event_vendor_slots where event_id = ${before.eventId} order by position`,
    );
    expect(back).toEqual([
      { label: "Traiteur", vendor: "Maison Haddad", selected: before.haddadId, amount: 960000 },
      { label: "Fleuriste", vendor: null, selected: null, amount: null },
    ]);
  });

  it("lot 28a (PRE-02, BUD-01, ADR 0054) — 0103 et 0104 reprennent statuts et montants d'avant le lot, et s'annulent", async () => {
    const statuses = "0103_lot28a_events_vendor_statuses";
    const amounts = "0104_lot28a_budget_five_amounts";
    await expect(rollback(statuses)).rejects.toBeInstanceOf(RollbackRefusedError);
    await rollback(amounts);
    expect(await hasColumn("budget", "budget_lines", "planned_amount_cents")).toBe(true);
    expect(await hasColumn("budget", "budget_lines", "quoted_amount_cents")).toBe(false);
    expect(await hasColumn("budget", "alert_thresholds", "percent")).toBe(false);
    await rollback(statuses);
    expect(await hasColumn("events", "event_vendor_slots", "status")).toBe(true);
    expect(await hasColumn("events", "event_vendor_candidates", "response")).toBe(true);
    expect(await hasColumn("events", "event_vendor_candidates", "status")).toBe(false);

    // Données d'avant le lot : un traiteur réservé (deux consultés, un retenu), un
    // lieu réservé saisi à la main, un fleuriste non requis, un DJ qui a décliné.
    const organizationId = randomUUID();
    const inOrganization = <T>(work: (tx: postgres.TransactionSql) => Promise<T>) =>
      target.begin(async (tx) => {
        await tx`select set_config('app.organization_id', ${organizationId}, true)`;
        return work(tx);
      }) as Promise<T>;
    await inOrganization(async (tx) => {
      const [event] = await tx<{ id: string }[]>`insert into events.events (organization_id) values (${organizationId}) returning id`;
      const slot = async (label: string, status: string, vendorName: string | null, amountCents: number | null, position: number) =>
        (
          await tx<{ id: string }[]>`insert into events.event_vendor_slots (organization_id, event_id, label, status, vendor_name, amount_cents, position)
            values (${organizationId}, ${event!.id}, ${label}, ${status}, ${vendorName}, ${amountCents}, ${position}) returning id`
        )[0]!.id;
      const candidate = async (slotId: string, vendorName: string, response: string, quoteCents: number | null, position: number) =>
        (
          await tx<{ id: string }[]>`insert into events.event_vendor_candidates (organization_id, event_id, vendor_slot_id, vendor_name, response, quote_amount_cents, position)
            values (${organizationId}, ${event!.id}, ${slotId}, ${vendorName}, ${response}, ${quoteCents}, ${position}) returning id`
        )[0]!.id;
      const caterer = await slot("Traiteur", "booked", "Maison Verdier", 512000, 0);
      const verdier = await candidate(caterer, "Maison Verdier", "quote_received", 512000, 0);
      await candidate(caterer, "Les Tables", "quote_received", 448000, 1);
      await tx`update events.event_vendor_slots set selected_candidate_id = ${verdier} where id = ${caterer}`;
      const venue = await slot("Lieu", "booked", "Château", 900000, 1);
      await slot("Fleuriste", "not_required", null, null, 2);
      const dj = await slot("DJ", "quote_requested", null, null, 3);
      await candidate(dj, "DJ Sam", "declined", null, 0);
      for (const [slotId, planned, actual] of [
        [caterer, 500000, 512000],
        [venue, 1000000, 900000],
      ] as const) {
        const [line] = await tx<{ id: string }[]>`insert into budget.budget_lines (organization_id, event_id, event_vendor_slot_id, planned_amount_cents, actual_amount_cents)
          values (${organizationId}, ${event!.id}, ${slotId}, ${planned}, ${actual}) returning id`;
        await tx`insert into budget.budget_line_history (organization_id, line_id, field, old_value_cents, new_value_cents, changed_by_user_id)
          values (${organizationId}, ${line!.id}, 'actual', null, ${actual}, ${organizationId})`;
      }
    });

    await migrateAll();
    await rollbackLot26();
    // migrateAll applique aussi les migrations des 28b et 28c : retour à 0104 pour lire la reprise du 28a.
    await rollback("0108_lot28c_vendors_rating_prices");
    await rollback("0107_lot28c_budget_vat_rate");
    await rollback("0106_lot28b_events_retained_vendors");
    await rollback("0105_lot28b_budget_lines_payments");
    const after = await inOrganization(async (tx) => ({
      candidates: await tx<{ vendor: string; status: string }[]>`select vendor_name as vendor, status::text as status from events.event_vendor_candidates where organization_id = ${organizationId} order by vendor_name`,
      slots: await tx<{ label: string; not_required: boolean; selected: boolean }[]>`select label, not_required, selected_candidate_id is not null as selected from events.event_vendor_slots where organization_id = ${organizationId} order by position`,
      lines: await tx<{ estimated: number; quoted: number | null; committed: number; paid: number | null }[]>`select estimated_amount_cents as estimated, quoted_amount_cents as quoted, committed_amount_cents as committed, paid_amount_cents as paid
        from budget.budget_lines where organization_id = ${organizationId} order by estimated_amount_cents`,
      fields: await tx<{ field: string }[]>`select distinct field::text as field from budget.budget_line_history where organization_id = ${organizationId}`,
    }));
    expect(after.candidates.map((row) => [row.vendor, row.status])).toEqual([
      ["Château", "retained"],
      ["DJ Sam", "dismissed"],
      ["Les Tables", "dismissed"],
      ["Maison Verdier", "retained"],
    ]);
    expect(after.slots.map((row) => [row.label, row.not_required, row.selected])).toEqual([
      ["Traiteur", false, true],
      ["Lieu", false, true],
      ["Fleuriste", true, false],
      ["DJ", false, false],
    ]);
    expect(after.lines).toEqual([
      { estimated: 500000, quoted: 512000, committed: 512000, paid: null },
      { estimated: 1000000, quoted: 900000, committed: 900000, paid: null },
    ]);
    expect(after.fields).toEqual([{ field: "committed" }]);

    // Retour à 0102 pour la suite : les réponses et le statut du poste reviennent.
    await rollback(amounts);
    await rollback(statuses);
    const back = await inOrganization(async (tx) => ({
      candidates: await tx<{ vendor: string; response: string }[]>`select vendor_name as vendor, response::text as response from events.event_vendor_candidates where organization_id = ${organizationId} order by vendor_name`,
      slots: await tx<{ label: string; status: string }[]>`select label, status::text as status from events.event_vendor_slots where organization_id = ${organizationId} order by position`,
      lines: await tx<{ planned: number; actual: number }[]>`select planned_amount_cents as planned, actual_amount_cents as actual from budget.budget_lines where organization_id = ${organizationId} order by planned_amount_cents`,
    }));
    expect(back.candidates.map((row) => [row.vendor, row.response])).toEqual([
      ["Château", "quote_received"],
      ["DJ Sam", "declined"],
      ["Les Tables", "declined"],
      ["Maison Verdier", "quote_received"],
    ]);
    expect(back.slots.map((row) => [row.label, row.status])).toEqual([
      ["Traiteur", "booked"],
      ["Lieu", "booked"],
      ["Fleuriste", "not_required"],
      ["DJ", "to_find"],
    ]);
    expect(back.lines).toEqual([
      { planned: 500000, actual: 512000 },
      { planned: 1000000, actual: 900000 },
    ]);
  });

  it("lot 24b (SEC-22, SEC-06) — l'annulation de 0102 puis 0101 retire le plafond d'envois et la date de retrait des accès", async () => {
    await expect(rollback("0101_lot24b_hub_member_removal")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("hub", "platform_settings", "mail_hourly_cap")).toBe(true);
    await rollback("0102_lot24b_hub_mail_cap");
    expect(await hasColumn("hub", "platform_settings", "mail_hourly_cap")).toBe(false);
    expect(await hasColumn("hub", "users", "disabled_at")).toBe(true);
    await rollback("0101_lot24b_hub_member_removal");
    expect(await hasColumn("hub", "users", "disabled_at")).toBe(false);
  });

  it("lot 24a (DAT-01) — l'annulation de 0100 à 0095 retire les index sur organization_id, module par module", async () => {
    const steps: [string, string, string][] = [
      ["0100_lot24a_vendors_organization_index", "vendors", "vendors_organization_idx"],
      ["0099_lot24a_quotes_organization_index", "quotes", "quote_lines_organization_idx"],
      ["0098_lot24a_budget_organization_index", "budget", "budget_lines_organization_idx"],
      ["0097_lot24a_events_organization_index", "events", "events_organization_idx"],
      ["0096_lot24a_hub_organization_index", "hub", "imports_organization_idx"],
      ["0095_lot24a_core_organization_index", "core", "domain_events_organization_idx"],
    ];
    await expect(rollback("0094_lot23b_pieces_inalterables")).rejects.toBeInstanceOf(RollbackRefusedError);
    for (const [tag, schema, index] of steps) {
      const indexes = () => target`select 1 from pg_indexes where schemaname = ${schema} and indexname = ${index}`;
      expect(await indexes(), tag).toHaveLength(1);
      await rollback(tag);
      expect(await indexes(), tag).toHaveLength(0);
    }
  });

  it("lot 23b (ADR 0061) — l'annulation de 0094 retire la chaîne, les originaux et les écritures d'encaissement", async () => {
    await expect(rollback("0093_lot23_connection_traces")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("quotes", "ledger_entries", "hash")).toBe(true);
    await rollback("0094_lot23b_pieces_inalterables");
    for (const table of ["ledger_entries", "original_documents", "payment_entries"]) expect(await hasColumn("quotes", table, "id"), table).toBe(false);
    expect(await hasColumn("quotes", "signature_requests", "signed_document_sha256")).toBe(false);
    expect(await hasColumn("quotes", "payment_schedule_items", "paid_on")).toBe(true);
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
    // Lot 36a (0135) : les coordonnées des clients vivent dans le contact du hub.
    expect(await hasColumn("events", "event_clients", "email")).toBe(false);
    expect(await hasColumn("hub", "contacts", "email")).toBe(true);
    // Lot 33a : 0130 retire la double authentification maison (colonnes et appareils de confiance).
    expect(await hasColumn("hub", "users", "totp_last_used_step")).toBe(false);
    expect(await hasColumn("hub", "trusted_devices", "expires_at")).toBe(false);
    expect(await hasColumn("hub", "memberships", "role")).toBe(true);
    const [rls] = await target<{ relforcerowsecurity: boolean }[]>`select relforcerowsecurity from pg_class where oid = 'hub.import_jobs'::regclass`;
    expect(rls?.relforcerowsecurity).toBe(true);
  });
});
