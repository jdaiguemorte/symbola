// Lot 35b (HUB-13 ; décisions D6 et D7 de Julien ; ADR 0098) — reprise d'un export Symbola dans un
// espace vide, contre de vrais modules (PostgreSQL, stockage et antivirus réels).
// - Réversibilité : le jeu fictif (l'atelier de Camille, ORG-01, avec ses pièces comptables) est
//   exporté, repris dans un espace vide, puis exporté de nouveau : les deux exports sont égaux,
//   identifiants et dates de création mis à part, et chaque fichier garde son empreinte.
// - D7 : factures, avoirs et encaissements repris en pièces inaltérables, numérotation continuée,
//   chaîne vérifiée puis prolongée ; une chaîne altérée, une autre entreprise : refusées.
// - Abus : espace non vide, Planner, archive modifiée, version inconnue, fichier refusé, entité non
//   conforme, échec en cours d'écriture : rien n'est écrit ; l'organisation d'origine reste intacte.
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { exportManifestSchema, type ExportManifest } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { organizationImports } from "@symbola/db/schema/hub";
import { invoices, ledgerAnchors, numberSeries } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import { EICAR_TEST_STRING } from "@symbola/files";
import { ZipFileReader, ZipFileWriter } from "@symbola/privacy";
import { minimalPdf } from "@/lib/test-fixtures/pdf";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { getPrivacySettings, listOrganizationImports, OrganizationImportActiveError, OrganizationImportForbiddenError, requestOrganizationImport, saveOnboardingStep, updatePrivacySettings } from "@/modules/hub/service";
import { issueCreditNote } from "@/modules/quotes/service";
import { setSignatureProviderForTests } from "@/modules/quotes/signature";
import { seedFullAtelier } from "@/lib/test-fixtures/atelier-complet";
import { buildOrganizationExportArchive, collectOrganizationData } from "./organization-export";
import { runOrganizationImport } from "./organization-import-jobs";

const db = appDatabase();
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
let dir: string;

// Entités qui ne reviennent pas à l'identique, et pourquoi (bilan de la reprise, ADR 0098).
const NOT_ROUND_TRIPPED = new Set([
  // L'espace qui reprend garde son identité, ses abonnements et son équipe ; son journal repart.
  "hub/organizations",
  "hub/organization_modules",
  "hub/team_members",
  "hub/activity_journal",
  // Trace des exports RGPD, dont les fichiers ont été effacés.
  "hub/privacy_exports",
  // Liens personnels et agendas extérieurs : à recréer.
  "events/event_links",
  "events/event_link_shared_slots",
  "events/event_document_links",
  "appointments/calendar_sources",
  // Chaîne des pièces : prolongée (nouvelle chaîne accrochée à la reprise), vérifiée à part.
  "quotes/ledger_entries",
  "quotes/ledger_anchors",
]);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "symbola-reprise-"));
});

afterAll(async () => {
  setSignatureProviderForTests(undefined);
  await rm(dir, { recursive: true, force: true });
});

async function emptySpace(siren?: string, options: { ready?: boolean } = {}) {
  const organization = await createOrganization(db, `Nouvel atelier ${randomUUID().slice(0, 6)}`);
  const owner = await createUser(db, { organizationId: organization.id, email: `reprise-${randomUUID()}@example.test`, password: "mot-de-passe-reprise", role: "owner" });
  const planner = await createUser(db, { organizationId: organization.id, email: `planner-${randomUUID()}@example.test`, password: "mot-de-passe-reprise", role: "member" });
  if (siren) await saveOnboardingStep(db, organization.id, { siren });
  // Un espace prêt a déjà ses réglages RGPD (une ligne que le rôle applicatif ne peut pas supprimer) :
  // ils prennent les valeurs de l'archive.
  if (options.ready) await updatePrivacySettings(db, organization.id, await getPrivacySettings(db, organization.id));
  return { organizationId: organization.id, ownerId: owner.id, plannerId: planner.id };
}

async function exportOf(organizationId: string): Promise<string> {
  const build = await buildOrganizationExportArchive({ organizationId, directory: dir });
  return build.path;
}

async function archiveContent(path: string): Promise<{ manifest: ExportManifest; read: (name: string) => Promise<Buffer>; names: string[] }> {
  const reader = await ZipFileReader.open(path);
  const names = reader.names();
  const entries = new Map<string, Buffer>();
  for (const name of names) entries.set(name, (await reader.read(name))!);
  await reader.close();
  const manifest = exportManifestSchema.parse(JSON.parse(entries.get("manifest.json")!.toString("utf8")));
  return { manifest, names, read: async (name) => entries.get(name)! };
}

// Réécrit une archive : chaque entrée passe par `change` (null : retirée) ; `recompute` remet les
// empreintes du manifeste à jour (l'archive reste cohérente, pour atteindre les contrôles suivants).
async function rewrite(path: string, change: (name: string, data: Buffer, manifest: ExportManifest) => Buffer | null, options: { recompute?: boolean; manifest?: (manifest: ExportManifest) => unknown } = {}): Promise<string> {
  const { manifest, names, read } = await archiveContent(path);
  const out = join(dir, `${randomUUID()}.zip`);
  const writer = await ZipFileWriter.create(out);
  const checksums = { ...manifest.checksums };
  const files = manifest.files.map((file) => ({ ...file }));
  for (const name of names) {
    if (name === "manifest.json") continue;
    const changed = change(name, await read(name), manifest);
    if (!changed) continue;
    if (options.recompute) {
      const hash = createHash("sha256").update(changed).digest("hex");
      if (name in checksums) checksums[name] = hash;
      const file = files.find((item) => item.path === name);
      if (file) Object.assign(file, { sha256: hash, bytes: changed.byteLength });
    }
    await writer.add(name, changed);
  }
  const next = options.recompute ? { ...manifest, checksums, files } : manifest;
  await writer.add("manifest.json", JSON.stringify(options.manifest ? options.manifest(next) : next));
  await writer.finish();
  return out;
}

async function reprendre(target: { organizationId: string; ownerId: string }, path: string) {
  await requestOrganizationImport(db, { organizationId: target.organizationId, userId: target.ownerId, archivePath: path });
  await runOrganizationImport(target.organizationId);
  const [latest] = await listOrganizationImports(db, target.organizationId);
  return latest!;
}

async function realRows(organizationId: string): Promise<number> {
  const data = await collectOrganizationData(organizationId);
  const keys = ["events/events", "vendors/vendors", "quotes/quotes", "quotes/invoices", "budget/budget_lines", "hub/contacts", "events/event_types"];
  return data.flatMap((module) => module.entities.filter((entity) => keys.includes(`${module.module}/${entity.name}`)).map((entity) => entity.rows.length)).reduce((sum, count) => sum + count, 0);
}

// Lignes d'une entité, comparables d'un espace à l'autre : identifiants remplacés, dates de création
// et auteurs retirés, rangées.
function comparable(rows: Record<string, unknown>[], ignored: readonly string[]): string[] {
  return rows
    .map((row) =>
      JSON.stringify(Object.fromEntries(Object.entries(row).filter(([field]) => !ignored.includes(field))))
        .replace(UUID, "<id>")
        // Référence d'une signature chez le fournisseur, marquée à la reprise (« #<nouvel identifiant> »).
        .replace(/#<id>/g, ""),
    )
    .sort();
}

const IGNORED_FIELDS: string[] = [];

let source: Awaited<ReturnType<typeof seedFullAtelier>>;
let firstExport: string;

describe("HUB-13 — Reprise d'un export Symbola dans un espace vide (lot 35b)", { timeout: 240_000 }, () => {
  beforeAll(async () => {
    source = await seedFullAtelier();
    firstExport = await exportOf(source.organizationId);
    // Le jeu fictif complet et son export : plus que les 10 s par défaut, surtout en CI.
  }, 120_000);

  it("réversibilité : exporté, repris dans un espace vide puis réexporté, l'export est le même, identifiants et dates de création mis à part ; chaque fichier garde son empreinte", async () => {
    const target = await emptySpace();
    const result = await reprendre(target, firstExport);
    expect(result.error, String(result.errorDetail)).toBeNull();
    expect(result.status).toBe("done");
    const secondExport = await exportOf(target.organizationId);
    const first = await archiveContent(firstExport);
    const second = await archiveContent(secondExport);
    const differences: string[] = [];
    for (const entity of first.manifest.entities) {
      const key = `${entity.module}/${entity.name}`;
      if (NOT_ROUND_TRIPPED.has(key)) continue;
      const other = second.manifest.entities.find((candidate) => candidate.module === entity.module && candidate.name === entity.name);
      const a = comparable(JSON.parse((await first.read(entity.json)).toString("utf8")), IGNORED_FIELDS);
      const b = other ? comparable(JSON.parse((await second.read(other.json)).toString("utf8")), IGNORED_FIELDS) : [];
      if (JSON.stringify(a) !== JSON.stringify(b)) differences.push(`${key}: ${a.length} → ${b.length}\n${a.filter((row) => !b.includes(row)).slice(0, 2).join("\n")}\n≠\n${b.filter((row) => !a.includes(row)).slice(0, 2).join("\n")}`);
    }
    expect(differences).toEqual([]);
    const hashes = (manifest: ExportManifest) => manifest.files.map((file) => file.sha256).sort();
    expect(hashes(second.manifest)).toEqual(hashes(first.manifest));
    expect(first.manifest.files.length).toBeGreaterThan(3);

    // Bilan : ce qui n'est pas repris, et pourquoi ; l'archive déposée est effacée.
    const reasons = Object.fromEntries(result.report!.entities.filter((entity) => entity.reason).map((entity) => [entity.entity, entity.reason]));
    expect(reasons).toMatchObject({ "hub/organizations": "organization", "hub/team_members": "team", "hub/activity_journal": "journal", "events/event_links": "links", "quotes/ledger_entries": "rechained" });
    expect(result.report!.teamMembersToInvite).toBeGreaterThan(0);
    expect(result.report!.linksToRecreate).toBeGreaterThan(0);
    expect(result.report!.ledger).toEqual({ entries: expect.any(Number), lastSequence: expect.any(Number) });
    const [row] = await withOrganization(db, target.organizationId, (tx) => tx.select().from(organizationImports).where(eq(organizationImports.id, result.id)));
    expect(row!.archiveKey).toBeNull();
  });

  it("D7 : pièces reprises inaltérables, chaîne vérifiée puis prolongée depuis la dernière empreinte reprise, numérotation continuée (même SIREN)", async () => {
    const target = await emptySpace("123456789", { ready: true });
    const result = await reprendre(target, firstExport);
    expect(result.status).toBe("done");
    const sourceTip = (await withOrganization(db, source.organizationId, (tx) =>
      tx.execute(sql`select hash, sequence from quotes.ledger_entries where organization_id = ${source.organizationId} order by sequence desc limit 1`),
    )) as unknown as { hash: string; sequence: string }[];
    await withOrganization(db, target.organizationId, async (tx) => {
      const [anchor] = await tx.select().from(ledgerAnchors).where(eq(ledgerAnchors.organizationId, target.organizationId));
      expect(anchor).toMatchObject({ previousHash: sourceTip[0]!.hash, sourceOrganizationId: source.organizationId, sourceLastSequence: Number(sourceTip[0]!.sequence) });
      const entries = (await tx.execute(sql`select sequence, previous_hash, is_backfill from quotes.ledger_entries where organization_id = ${target.organizationId} order by sequence`)) as unknown as { sequence: string; previous_hash: string; is_backfill: boolean }[];
      expect(entries[0]!.previous_hash).toBe(sourceTip[0]!.hash);
      expect(entries.every((entry) => entry.is_backfill)).toBe(true);
      expect(await tx.execute(sql`select * from quotes.verify_ledger(${target.organizationId}::uuid)`)).toHaveLength(0);
      // Lecture seule : une pièce reprise ne se modifie pas.
      const [invoice] = await tx.select().from(invoices).where(eq(invoices.organizationId, target.organizationId));
      expect(invoice!.number).toBe(source.invoiceNumber);
      await expect(tx.transaction((inner) => inner.update(invoices).set({ amountCents: 1 }).where(eq(invoices.id, invoice!.id)))).rejects.toThrow();
      const series = await tx.select().from(numberSeries).where(and(eq(numberSeries.organizationId, target.organizationId), eq(numberSeries.kind, "invoice")));
      expect(series.map((item) => item.lastNumber)).toEqual([Number(source.invoiceNumber.split("-").pop())]);
    });
    // La numérotation continue : un nouvel avoir prend le numéro suivant, et s'enchaîne.
    const [invoice] = await withOrganization(db, target.organizationId, (tx) => tx.select().from(invoices).where(eq(invoices.organizationId, target.organizationId)));
    const credit = await issueCreditNote({ renderOriginal: async () => minimalPdf("avoir"), organizationId: target.organizationId, invoiceId: invoice!.id, amountCents: 500, reason: "Erreur de saisie" });
    expect(credit.number).toMatch(/-0002$/);
    expect(await withOrganization(db, target.organizationId, (tx) => tx.execute(sql`select * from quotes.verify_ledger(${target.organizationId}::uuid)`))).toHaveLength(0);
  });

  it("D7 : une chaîne altérée (pièce modifiée, empreintes du manifeste recalculées) est refusée ; une autre entreprise (autre SIREN) aussi ; rien n'est écrit", async () => {
    const altered = await rewrite(
      firstExport,
      (name, data) => {
        if (name !== "json/quotes/invoices.json") return data;
        const rows = JSON.parse(data.toString("utf8")) as { amountCents: number }[];
        rows[0]!.amountCents += 100;
        return Buffer.from(JSON.stringify(rows));
      },
      { recompute: true },
    );
    const target = await emptySpace();
    const before = await realRows(target.organizationId);
    expect(await reprendre(target, altered)).toMatchObject({ status: "failed", error: "ledger_invalid", errorDetail: "object_altered" });
    expect(await realRows(target.organizationId)).toBe(before);
    const other = await emptySpace("987654321");
    expect(await reprendre(other, firstExport)).toMatchObject({ status: "failed", error: "siren_mismatch" });
  });

  it("refuse une archive modifiée (empreinte fausse), d'une version inconnue, au fichier refusé (antivirus) ou à l'entité non conforme : rien n'est écrit", async () => {
    const target = await emptySpace();
    const before = await realRows(target.organizationId);
    const document = (await archiveContent(firstExport)).manifest.files.find((file) => file.path.startsWith("fichiers/events/event_documents/"))!.path;
    const cases: [string, Promise<string>][] = [
      ["checksum", rewrite(firstExport, (name, data) => (name === "json/events/events.json" ? Buffer.concat([data, Buffer.from(" ")]) : data))],
      ["unknown_format", rewrite(firstExport, (_name, data) => data, { manifest: (manifest) => ({ ...manifest, format: "symbola.export/v2" }) })],
      ["file_refused", rewrite(firstExport, (name, data) => (name === document ? Buffer.from(EICAR_TEST_STRING) : data), { recompute: true })],
      [
        "schema",
        rewrite(
          firstExport,
          (name, data) => (name === "json/vendors/vendors.json" ? Buffer.from(JSON.stringify((JSON.parse(data.toString("utf8")) as object[]).map((row) => ({ ...row, name: 42 })))) : data),
          { recompute: true },
        ),
      ],
      ["unreadable", Promise.resolve(join(dir, "absente.zip"))],
    ];
    for (const [error, archive] of cases) {
      const path = await archive;
      if (error === "unreadable") await import("node:fs/promises").then((fs) => fs.writeFile(path, "pas une archive"));
      expect(await reprendre(target, path), error).toMatchObject({ status: "failed", error });
      expect(await realRows(target.organizationId), error).toBe(before);
    }
  });

  it("un échec en cours d'écriture (après le hub et les évènements) n'en laisse rien : l'espace reste tel qu'il était", async () => {
    // Une note hors de 1 à 5 : conforme au schéma (un entier), refusée par la base à l'écriture du carnet,
    // après le hub, les évènements, le budget et les pièces.
    const broken = await rewrite(
      firstExport,
      (name, data) => (name === "json/vendors/vendors.json" ? Buffer.from(JSON.stringify((JSON.parse(data.toString("utf8")) as object[]).map((row) => ({ ...row, rating: 99 })))) : data),
      { recompute: true },
    );
    const target = await emptySpace();
    // Tout, sauf le journal d'activité (qui garde la demande et l'échec).
    const snapshot = async () =>
      (await collectOrganizationData(target.organizationId)).map((module) => ({ ...module, entities: module.entities.filter((entity) => entity.name !== "activity_journal") }));
    const before = await snapshot();
    expect(await reprendre(target, broken)).toMatchObject({ status: "failed", error: "failed" });
    expect(await snapshot()).toEqual(before);
  });

  it("refuse la reprise dans un espace qui a des données, ou par une Planner ; l'organisation d'origine et les autres restent intactes", async () => {
    const sourceBefore = await collectOrganizationData(source.organizationId);
    const target = await emptySpace();
    await expect(requestOrganizationImport(db, { organizationId: target.organizationId, userId: target.plannerId, archivePath: firstExport })).rejects.toBeInstanceOf(OrganizationImportForbiddenError);
    // Une Propriétaire d'une autre organisation ne dépose rien ici.
    await expect(requestOrganizationImport(db, { organizationId: target.organizationId, userId: source.ownerId, archivePath: firstExport })).rejects.toBeInstanceOf(OrganizationImportForbiddenError);
    const full = await emptySpace();
    const salon = await createProspectSource(full.organizationId, "Salon");
    await createProspect({ organizationId: full.organizationId, createdByUserId: full.ownerId, prospectSourceId: salon.id, clients: [{ firstName: "Inès", lastName: "Durand" }], eventDate: "2027-05-01" });
    const before = await realRows(full.organizationId);
    expect(await reprendre(full, firstExport)).toMatchObject({ status: "failed", error: "not_empty" });
    expect(await realRows(full.organizationId)).toBe(before);
    expect(await collectOrganizationData(source.organizationId)).toEqual(sourceBefore);
    // Une reprise à la fois.
    const busy = await emptySpace();
    await requestOrganizationImport(db, { organizationId: busy.organizationId, userId: busy.ownerId, archivePath: firstExport });
    await expect(requestOrganizationImport(db, { organizationId: busy.organizationId, userId: busy.ownerId, archivePath: firstExport })).rejects.toBeInstanceOf(OrganizationImportActiveError);
    // Une autre organisation ne voit pas ses reprises.
    expect(await listOrganizationImports(db, target.organizationId)).toEqual([]);
  });
});
