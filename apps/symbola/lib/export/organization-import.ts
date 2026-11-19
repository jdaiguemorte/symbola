// Lot 35b (HUB-13 ; décisions D6 et D7 de Julien ; ADR 0098) — reprise d'une archive d'export
// Symbola (format symbola.export/v1) dans une organisation vide. Les modules ne se connaissent que
// par leur service.ts (ADR 0011) : l'orchestration vit ici, symétrique de l'export.
//
// Contrôles avant d'écrire quoi que ce soit (un refus a son motif, sans valeur de l'archive) :
// 1. archive lisible, format et version connus (manifeste) ;
// 2. empreintes SHA-256 justes (chaque entrée du manifeste, chaque fichier) ;
// 3. chaque entité conforme à son schéma, et autant de lignes que le manifeste en annonce ;
// 4. organisation vide (aucun évènement, prestataire, devis, facture, budget, contact, rendez-vous
//    ou invité réels) et même entreprise (même SIREN, si les deux le connaissent : D7) ;
// 5. fichiers contrôlés comme tout envoi (type vérifié par le contenu, antivirus), puis rangés.
// Écriture : une seule transaction, module par module dans l'ordre de leurs dépendances, chacun par
// sa porte ; la chaîne des pièces est vérifiée puis prolongée (module quotes). Un échec n'écrit rien,
// et les fichiers déjà rangés sont effacés : aucune donnée partielle ne reste.
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  exportManifestSchema,
  ORGANIZATION_EXPORT_FORMAT,
  ORGANIZATION_EXPORT_MODULES,
  type ExportManifest,
  type ExportRow,
  type ModuleImportContext,
  type ModuleImportResult,
  type ModuleImportRows,
  type OrganizationExportModule,
} from "@symbola/contracts";
import { SYSTEM_ACTOR, withActor } from "@symbola/db/actor";
import { appDatabase } from "@symbola/db/client";
import { ImportReferenceError } from "@symbola/db/import";
import type { OrganizationImportError, OrganizationImportReport } from "@symbola/db/schema/hub";
import { withOrganization, type OrganizationTransaction } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, uploadFile } from "@symbola/files";
import { ArchiveReadError, ZipFileReader } from "@symbola/privacy";
import { importAppointmentsData, registerAppointmentsImportIds } from "@/modules/appointments/service";
import { importBudgetData, registerBudgetImportIds } from "@/modules/budget/service";
import { importEventsData, registerEventsImportIds } from "@/modules/events/service";
import { importGuestsData, registerGuestsImportIds } from "@/modules/guests/service";
import { finishOrganizationImportInTransaction, importHubData, registerHubImportIds, resolveImportUsers } from "@/modules/hub/service";
import { ImportedLedgerInvalidError, importQuotesData, registerQuotesImportIds } from "@/modules/quotes/service";
import { importVendorsData, registerVendorsImportIds } from "@/modules/vendors/service";
import { collectOrganizationData } from "./organization-export";
import { exportEntitySchemas } from "./schemas";

type Importer = {
  register: (rows: ModuleImportRows, context: ModuleImportContext) => void;
  write: (tx: OrganizationTransaction, rows: ModuleImportRows, context: ModuleImportContext) => Promise<ModuleImportResult>;
};

// Dans l'ordre de l'archive (ORGANIZATION_EXPORT_MODULES).
const MODULE_IMPORTERS: Record<OrganizationExportModule, Importer> = {
  hub: { register: registerHubImportIds, write: importHubData },
  events: { register: registerEventsImportIds, write: importEventsData },
  budget: { register: registerBudgetImportIds, write: importBudgetData },
  quotes: { register: registerQuotesImportIds, write: importQuotesData },
  vendors: { register: registerVendorsImportIds, write: importVendorsData },
  guests: { register: registerGuestsImportIds, write: importGuestsData },
  appointments: { register: registerAppointmentsImportIds, write: importAppointmentsData },
};

// Entités dont une seule ligne réelle rend l'organisation « non vide » (D6).
const REAL_DATA_ENTITIES = [
  "events/events",
  "vendors/vendors",
  "quotes/quotes",
  "quotes/invoices",
  "budget/event_budgets",
  "budget/budget_lines",
  "hub/contacts",
  "appointments/appointments",
  "guests/guests",
] as const;

// Un fichier de l'archive : la limite du format (pas de zip64), comme à l'export.
const MAX_FILE_BYTES = 0xffffffff;

export class OrganizationImportRefusedError extends Error {
  constructor(
    readonly code: OrganizationImportError,
    // Entité ou chemin en cause (jamais une valeur de l'archive).
    readonly detail: string | null = null,
  ) {
    super(`reprise refusée : ${code}${detail ? ` (${detail})` : ""}`);
    this.name = "OrganizationImportRefusedError";
  }
}

function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function sirenOf(siret: unknown, siren: unknown): string | null {
  const value = typeof siren === "string" && siren.trim() ? siren : typeof siret === "string" ? siret.slice(0, 9) : "";
  const digits = value.replace(/\s/g, "");
  return digits.length === 9 ? digits : null;
}

async function readManifest(reader: ZipFileReader): Promise<ExportManifest> {
  const text = await reader.readText("manifest.json");
  if (!text) throw new OrganizationImportRefusedError("unknown_format");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new OrganizationImportRefusedError("unknown_format");
  }
  if (!raw || typeof raw !== "object" || (raw as { format?: unknown }).format !== ORGANIZATION_EXPORT_FORMAT) throw new OrganizationImportRefusedError("unknown_format");
  const parsed = exportManifestSchema.safeParse(raw);
  if (!parsed.success) throw new OrganizationImportRefusedError("unknown_format");
  return parsed.data;
}

type ArchiveContent = {
  manifest: ExportManifest;
  rows: Map<OrganizationExportModule, Map<string, ExportRow[]>>;
  unknownEntities: { entity: string; rows: number }[];
};

// Contrôles 1 à 3 : rien n'est écrit.
export async function readOrganizationArchive(reader: ZipFileReader): Promise<ArchiveContent> {
  const manifest = await readManifest(reader);
  for (const [name, expected] of Object.entries(manifest.checksums)) {
    const data = await reader.read(name);
    if (!data || sha256(data) !== expected) throw new OrganizationImportRefusedError("checksum", name);
  }
  const schemas = new Map<string, z.ZodObject>(exportEntitySchemas().map((entity) => [`${entity.module}/${entity.name}`, entity.schema] as const));
  const rows = new Map<OrganizationExportModule, Map<string, ExportRow[]>>(ORGANIZATION_EXPORT_MODULES.map((module) => [module, new Map()]));
  const unknownEntities: ArchiveContent["unknownEntities"] = [];
  for (const entity of manifest.entities) {
    const key = `${entity.module}/${entity.name}`;
    if (!(entity.json in manifest.checksums)) throw new OrganizationImportRefusedError("checksum", entity.json);
    const schema = schemas.get(key);
    if (!schema) {
      // Entité d'une version plus récente du format v1 (ajout) : signalée, pas reprise.
      unknownEntities.push({ entity: key, rows: entity.rows });
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse((await reader.readText(entity.json)) ?? "");
    } catch {
      throw new OrganizationImportRefusedError("schema", key);
    }
    // Un champ facultatif ajouté garde la v1 : il est ignoré ; tout le reste doit suivre le schéma.
    const result = z.array(z.object(schema.shape)).safeParse(parsed);
    if (!result.success || result.data.length !== entity.rows) throw new OrganizationImportRefusedError("schema", key);
    rows.get(entity.module)!.set(entity.name, result.data as ExportRow[]);
  }
  return { manifest, rows, unknownEntities };
}

function hasRealData(here: Awaited<ReturnType<typeof collectOrganizationData>>): boolean {
  const count = (key: string) => {
    const [module, name] = key.split("/");
    return here.find((item) => item.module === module)?.entities.find((entity) => entity.name === name)?.rows.length ?? 0;
  };
  return REAL_DATA_ENTITIES.some((key) => count(key) > 0);
}

// L'écran dit d'emblée si la reprise est possible ici (D6).
export async function organizationHasRealData(organizationId: string): Promise<boolean> {
  return hasRealData(await collectOrganizationData(organizationId));
}

// Contrôle 4 : organisation vide, même entreprise.
async function checkTarget(organizationId: string, content: ArchiveContent): Promise<void> {
  const here = await collectOrganizationData(organizationId);
  if (hasRealData(here)) throw new OrganizationImportRefusedError("not_empty");
  const hub = here.find((item) => item.module === "hub");
  const hereOrganization = hub?.entities.find((entity) => entity.name === "organizations")?.rows[0];
  const hereProfile = hub?.entities.find((entity) => entity.name === "organization_profiles")?.rows[0];
  const archived = content.rows.get("hub")!;
  const archivedOrganization = archived.get("organizations")?.[0];
  const archivedProfile = archived.get("organization_profiles")?.[0];
  const ours = sirenOf(hereOrganization?.siret, hereProfile?.siren);
  const theirs = sirenOf(archivedOrganization?.siret, archivedProfile?.siren);
  // Les pièces d'une autre entreprise ne prolongent pas la numérotation de celle-ci (D7) : refusé,
  // en attendant une décision (docs/QUESTIONS.md, Q38).
  if (ours && theirs && ours !== theirs) throw new OrganizationImportRefusedError("siren_mismatch");
}

export type OrganizationImportOutcome = { report: OrganizationImportReport; sourceGeneratedAt: Date };

export async function importOrganizationArchive(input: {
  organizationId: string;
  importerUserId: string;
  importId: string;
  path: string;
  now?: Date;
  onHeartbeat?: () => Promise<void>;
}): Promise<OrganizationImportOutcome> {
  const db = appDatabase();
  let reader: ZipFileReader;
  try {
    reader = await ZipFileReader.open(input.path);
  } catch (error) {
    if (error instanceof ArchiveReadError) throw new OrganizationImportRefusedError("unreadable");
    throw error;
  }
  const uploaded: string[] = [];
  const storage = createStorageClient();
  try {
    let content: ArchiveContent;
    try {
      content = await readOrganizationArchive(reader);
    } catch (error) {
      if (error instanceof ArchiveReadError) throw new OrganizationImportRefusedError("unreadable");
      throw error;
    }
    const { manifest } = content;
    await checkTarget(input.organizationId, content);

    // Table de correspondance : l'organisation d'origine devient celle qui reprend ; les comptes
    // de l'archive, ceux de l'équipe (adresse), ou la Propriétaire s'ils sont inconnus ici.
    const hubRows = content.rows.get("hub")!;
    const team = (hubRows.get("team_members") ?? []).map((row) => ({ userId: String(row.userId), email: String(row.email) }));
    const authors = (hubRows.get("vat_regime_changes") ?? []).map((row) => ({ userId: String(row.changedByUserId), email: "" }));
    const users = await resolveImportUsers(db, { organizationId: input.organizationId, importerUserId: input.importerUserId, team: [...team, ...authors] });
    const ids = new Map<string, string>([[manifest.organization.id, input.organizationId], ...users]);

    // Contrôle 5 : chaque fichier, un à la fois, contrôlé puis rangé.
    const files = new Map<string, string>();
    const fileHashes = new Map<string, string>();
    for (const file of manifest.files) {
      const data = await reader.read(file.path);
      if (!data || data.byteLength !== file.bytes || sha256(data) !== file.sha256) throw new OrganizationImportRefusedError("checksum", file.path);
      const result = await uploadFile({ organizationId: input.organizationId, buffer: data, maxSizeBytes: MAX_FILE_BYTES });
      if (result.status !== "uploaded") throw new OrganizationImportRefusedError("file_refused", file.path);
      uploaded.push(result.key);
      files.set(file.path, result.key);
      fileHashes.set(file.path, file.sha256);
      await input.onHeartbeat?.();
    }
    // Un fichier déjà absent à l'export reste absent : sa ligne garde une clé qui ne mène à rien.
    for (const file of manifest.missingFiles) files.set(file.path, `${input.organizationId}/${randomUUID()}-absent.${file.path.split(".").pop() ?? "bin"}`);

    const context: ModuleImportContext = {
      organizationId: input.organizationId,
      sourceOrganizationId: manifest.organization.id,
      ids,
      files,
      fileHashes,
      importerUserId: input.importerUserId,
    };
    for (const module of ORGANIZATION_EXPORT_MODULES) MODULE_IMPORTERS[module].register(content.rows.get(module)!, context);

    const results: ModuleImportResult[] = [];
    let report: OrganizationImportReport | null = null;
    try {
      // Écrit par le système : chaque ligne garde son auteur d'origine, même absent (core.stamp_row
      // ne remplit qu'un auteur nul, avec celui de la transaction).
      await withActor(SYSTEM_ACTOR, () =>
        withOrganization(db, input.organizationId, async (tx) => {
          await tx.execute(sql`select set_config('app.include_deleted', 'on', true)`);
          for (const module of ORGANIZATION_EXPORT_MODULES) results.push(await MODULE_IMPORTERS[module].write(tx, content.rows.get(module)!, context));
          const ledger = results.find((result) => result.ledger)?.ledger ?? null;
          const entities = [
            ...results.flatMap((result) => result.entities.map((entity) => ({ ...entity, entity: `${result.module}/${entity.entity}` }))),
            ...content.unknownEntities.map((entity) => ({ entity: entity.entity, rows: entity.rows, imported: 0, reason: "unknown_entity" })),
          ];
          report = {
            entities,
            files: { imported: manifest.files.length, missing: manifest.missingFiles.length },
            teamMembersToInvite: team.filter((member) => users.get(member.userId) === member.userId || users.get(member.userId) === input.importerUserId).length,
            linksToRecreate: entities.filter((entity) => entity.reason === "links").reduce((sum, entity) => sum + entity.rows, 0),
            ledger,
          };
          await finishOrganizationImportInTransaction(tx, { organizationId: input.organizationId, importId: input.importId, report, sourceGeneratedAt: new Date(manifest.generatedAt), ...(input.now ? { now: input.now } : {}) });
        }),
      );
    } catch (error) {
      if (error instanceof ImportedLedgerInvalidError) throw new OrganizationImportRefusedError("ledger_invalid", error.anomaly);
      if (error instanceof ImportReferenceError) throw new OrganizationImportRefusedError("schema", error.entity);
      throw error;
    }
    return { report: report!, sourceGeneratedAt: new Date(manifest.generatedAt) };
  } catch (error) {
    for (const key of uploaded) await deletePrivateObject(storage, key).catch(() => undefined);
    throw error;
  } finally {
    await reader.close();
  }
}
