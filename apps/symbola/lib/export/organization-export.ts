// Lot 35a (HUB-13, DAT-13 ; décisions D2 à D4 ; ADR 0068) — préparation de l'archive de l'export
// complet d'une organisation (format symbola.export/v1). Les modules ne se connaissent que par
// leur service.ts (ADR 0011) : l'orchestration vit ici. Chaque module livre ses entités (contrat
// export/v1) ; l'archive est écrite en flux dans un fichier temporaire (une entrée à la fois, la
// mémoire ne tient qu'un fichier), puis rangée par le hub dans le stockage privé.
//
// Archive : manifest.json, json/ (la référence), csv/ (pour un tableur), schemas/ (JSON Schema de
// chaque entité), fichiers/ (les documents), LISEZMOI.txt (contenu, exclusions, conventions).
import { createHash, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  exportManifestSchema,
  ORGANIZATION_EXPORT_FORMAT,
  type ExportFileRef,
  type ExportManifest,
  type ExportValue,
  type ModuleExport,
  type ModuleExportContext,
} from "@symbola/contracts";
import { createStorageClient, PrivateObjectNotFoundError, readPrivateObject } from "@symbola/files";
import { toCsv, ZipFileWriter } from "@symbola/privacy";
import { exportBudgetData } from "@/modules/budget/service";
import { exportEventsData, listDemoEventIds } from "@/modules/events/service";
import { exportHubData } from "@/modules/hub/service";
import { exportQuotesData } from "@/modules/quotes/service";
import { exportVendorsData } from "@/modules/vendors/service";
import { exportGuestsData } from "@/modules/guests/service";
import { exportReadme } from "./readme";
import { entitySchemaPath, entityJsonSchemaText, exportEntitySchemas } from "./schemas";

// Dans l'ordre de l'archive (ORGANIZATION_EXPORT_MODULES) : le hub, puis les modules.
const MODULE_EXPORTERS: ((organizationId: string, context: ModuleExportContext) => Promise<ModuleExport>)[] = [
  exportHubData,
  exportEventsData,
  exportBudgetData,
  exportQuotesData,
  exportVendorsData,
  // Lot 49 : module Invités (sans les régimes ni les empreintes des liens).
  exportGuestsData,
];

// Formats déjà compressés : rangés tels quels (compresser n'y gagne rien et coûte du temps).
const STORED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "zip", "docx", "xlsx", "pptx", "odt", "ods", "mp4"]);
// Avancement enregistré tous les N fichiers (et le battement avec lui).
const PROGRESS_EVERY = 10;

export type OrganizationExportBuild = {
  path: string;
  sizeBytes: number;
  // « <module>/<entité> » → nombre de lignes.
  entityCounts: Record<string, number>;
  filesTotal: number;
  missingFiles: number;
  manifest: ExportManifest;
};

function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

function csvCell(value: ExportValue | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Toutes les données de l'organisation, module par module, sans rien de ses essais.
export async function collectOrganizationData(organizationId: string): Promise<ModuleExport[]> {
  const context: ModuleExportContext = { excludedEventIds: new Set(await listDemoEventIds(organizationId)) };
  const modules: ModuleExport[] = [];
  for (const exporter of MODULE_EXPORTERS) modules.push(await exporter(organizationId, context));
  return modules;
}

export async function buildOrganizationExportArchive(input: {
  organizationId: string;
  now?: Date;
  // Dossier du fichier temporaire (par défaut celui du système).
  directory?: string;
  onProgress?: (progress: { filesDone: number; filesTotal: number }) => Promise<void>;
}): Promise<OrganizationExportBuild> {
  const now = input.now ?? new Date();
  const modules = await collectOrganizationData(input.organizationId);
  const schemas = new Map(exportEntitySchemas().map((entity) => [`${entity.module}/${entity.name}`, entity]));
  const organizationRow = modules.find((module) => module.module === "hub")?.entities.find((entity) => entity.name === "organizations")?.rows[0];
  const organizationName = typeof organizationRow?.name === "string" ? organizationRow.name : "";

  const path = join(input.directory ?? tmpdir(), `symbola-export-${randomUUID()}.zip`);
  const writer = await ZipFileWriter.create(path, now);
  try {
    const checksums: Record<string, string> = {};
    const add = async (name: string, data: string) => {
      checksums[name] = sha256(data);
      await writer.add(name, data);
    };

    const entities: ExportManifest["entities"] = [];
    const entityCounts: Record<string, number> = {};
    for (const module of modules) {
      for (const entity of module.entities) {
        const key = `${module.module}/${entity.name}`;
        const schema = schemas.get(key);
        if (!schema) throw new Error(`entité exportée sans schéma : ${key}`);
        const json = `json/${key}.json`;
        const csv = `csv/${key}.csv`;
        const schemaPath = entitySchemaPath(schema);
        const columns = Object.keys(schema.schema.shape);
        await add(json, `${JSON.stringify(entity.rows, null, 2)}\n`);
        await add(csv, toCsv([columns, ...entity.rows.map((row) => columns.map((column) => csvCell(row[column])))]));
        await add(schemaPath, entityJsonSchemaText(schema));
        entities.push({ module: module.module, name: entity.name, rows: entity.rows.length, json, csv, schema: schemaPath });
        entityCounts[key] = entity.rows.length;
      }
    }

    // Les fichiers, un à la fois ; un même fichier n'est rangé qu'une fois.
    const refs = [...new Map(modules.flatMap((module) => module.files).map((ref) => [ref.path, ref] as const)).values()];
    const storage = createStorageClient();
    const files: ExportManifest["files"] = [];
    const missing: ExportManifest["missingFiles"] = [];
    const describe = (ref: ExportFileRef) => ({ path: ref.path, entity: ref.entity, rowId: ref.rowId, field: ref.field });
    await input.onProgress?.({ filesDone: 0, filesTotal: refs.length });
    for (const [index, ref] of refs.entries()) {
      try {
        const { data } = await readPrivateObject(storage, ref.storageKey);
        const extension = ref.path.split(".").pop() ?? "";
        await writer.add(ref.path, data, { compress: !STORED_EXTENSIONS.has(extension) });
        files.push({ ...describe(ref), bytes: data.byteLength, sha256: sha256(data) });
      } catch (error) {
        if (!(error instanceof PrivateObjectNotFoundError)) throw error;
        missing.push(describe(ref));
      }
      const done = index + 1;
      if (done % PROGRESS_EVERY === 0 || done === refs.length) await input.onProgress?.({ filesDone: done, filesTotal: refs.length });
    }

    const rowCount = Object.values(entityCounts).reduce((sum, count) => sum + count, 0);
    await add("LISEZMOI.txt", exportReadme({ organizationName, generatedAt: now, entityCount: entities.length, rowCount, fileCount: files.length, missingFiles: missing.length }));

    const manifest = exportManifestSchema.parse({
      format: ORGANIZATION_EXPORT_FORMAT,
      generatedAt: now.toISOString(),
      organization: { id: input.organizationId, name: organizationName },
      entities,
      files,
      missingFiles: missing,
      checksums,
    });
    await writer.add("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
    const sizeBytes = await writer.finish();
    return { path, sizeBytes, entityCounts, filesTotal: refs.length, missingFiles: missing.length, manifest };
  } catch (error) {
    await writer.close();
    await rm(path, { force: true });
    throw error;
  }
}
