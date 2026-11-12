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

// Lot 26a : migrations au-dessus de celles du 28, annulées pour revenir à 0108.
const LOT_26A = ["0112_lot26a_events_drop_client_accesses", "0111_lot26a_hub_roles_notice", "0110_lot26a_core_link_actor", "0109_lot26a_events_links"];
async function rollbackLot26a() {
  for (const tag of LOT_26A) await rollback(tag);
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

describe("DB-01 — Migrations des types énumérés annulables (lots 14 et 15)", () => {
  it("seule la dernière migration appliquée s'annule", async () => {
    await expect(rollback("0070_lot14_import_vendors")).rejects.toBeInstanceOf(RollbackRefusedError);
    await expect(rollback("0074_lot15_grant_import_jobs")).rejects.toBeInstanceOf(RollbackRefusedError);
    await expect(rollback("0099_inconnue")).rejects.toBeInstanceOf(RollbackRefusedError);
  });

  it("lot 26a (UX-11, SEC-14, ADR 0053) — 0109 à 0112 : liens personnels, auteur « link », rôle client retiré ; l'annulation rend les structures, sans les données", async () => {
    await expect(rollback("0109_lot26a_events_links")).rejects.toBeInstanceOf(RollbackRefusedError);
    expect(await hasColumn("events", "event_links", "token_hash")).toBe(true);
    expect(await hasColumn("hub", "privacy_settings", "link_privacy_notice")).toBe(true);
    expect(await hasColumn("events", "event_client_accesses", "email")).toBe(false);
    expect(await roles()).toEqual(["owner", "member", "admin"]);

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
    expect(await roles()).toEqual(["owner", "member", "admin"]);
    expect(await hasColumn("events", "event_links", "token_hash")).toBe(true);
    // Retour à 0108 pour la suite.
    await rollbackLot26a();
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
    await rollbackLot26a();
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
    await rollbackLot26a();
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
    await rollbackLot26a();
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
    expect(await hasColumn("events", "event_clients", "email")).toBe(true);
    expect(await hasColumn("hub", "users", "totp_last_used_step")).toBe(true);
    expect(await hasColumn("hub", "trusted_devices", "expires_at")).toBe(true);
    const [rls] = await target<{ relforcerowsecurity: boolean }[]>`select relforcerowsecurity from pg_class where oid = 'hub.import_jobs'::regclass`;
    expect(rls?.relforcerowsecurity).toBe(true);
  });
});
