// Lot 35a (HUB-13, DAT-13, ADR 0068) — lecture générique des entités d'un module pour l'export
// complet d'une organisation (contrat export/v1). Chaque module déclare ses entités (une table,
// les champs retirés, ceux qui portent un fichier, ses lignes parentes) dans son export.ts, et
// appelle exportModuleEntities par son service.ts : ce fichier ne connaît aucune table.
//
// - Lecture sous RLS, dans une transaction en lecture seule et sur un instantané (repeatable
//   read) : les entités d'un module sont cohérentes entre elles.
// - Rien d'une autre organisation : la RLS, et un filtre explicite sur le champ d'organisation
//   (les tables d'identité du hub n'ont pas de RLS).
// - Données d'essai exclues (CLAUDE.md § 2.9) : ligne marquée is_demo, ligne d'un événement
//   d'essai, ligne dont un parent est exclu.
// - Un fichier est remplacé par son chemin dans l'archive ; sa clé de stockage ne sort pas.
// - Le schéma de chaque entité est tiré des colonnes de sa table : les schémas publiés
//   (docs/schemas/export/v1) sont comparés à ceux-ci par un test, si bien qu'une migration qui
//   change une table exportée oblige à décider de la version du format.
import { asc, eq, getTableColumns, getTableName, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import type {
  ExportEntitySchema,
  ExportFileRef,
  ExportRow,
  ExportValue,
  ModuleExport,
  ModuleExportContext,
  OrganizationExportModule,
} from "@symbola/contracts";
import type { AppDatabase } from "./client";

type RawRow = Record<string, unknown>;

export type ExportEntitySpec = {
  table: PgTable;
  // Nom de l'entité dans l'archive (par défaut : le nom de la table).
  name?: string;
  // Champs retirés (secrets, données techniques), en plus du champ d'organisation et du champ
  // d'essai, qui ne disent rien de plus.
  omit?: readonly string[];
  // Champs qui portent une clé du stockage privé.
  files?: readonly string[];
  // Champ booléen des lignes d'essai.
  demoField?: string;
  // Champ qui porte l'événement de la ligne.
  eventField?: string;
  // Lignes parentes, dans ce module : champ → entité. Ou une fonction, pour un parent dont
  // l'entité dépend de la ligne (pièce d'une facture ou d'un avoir).
  parents?: Readonly<Record<string, string>> | ((row: RawRow) => Array<[entity: string, id: unknown]>);
  // Champ de l'organisation (organizationId par défaut ; id pour l'organisation elle-même,
  // gardé alors dans l'archive).
  organizationField?: string;
  // Identifiant de la ligne (id par défaut).
  idField?: string;
  // Lot 48a (DAT-08, ADR 0093) : ligne transformée avant l'export (valeur chiffrée au niveau du champ
  // rendue en clair dans son champ d'origine, pour garder le contrat export/v1).
  transform?: (row: RawRow) => RawRow;
};

function entityName(spec: ExportEntitySpec): string {
  return spec.name ?? getTableName(spec.table);
}

function organizationField(spec: ExportEntitySpec): string {
  return spec.organizationField ?? "organizationId";
}

// Champs de l'archive, dans l'ordre de la table.
function exportedColumns(spec: ExportEntitySpec): [string, PgColumn][] {
  const removed = new Set([...(spec.omit ?? []), ...(spec.demoField ? [spec.demoField] : [])]);
  if (organizationField(spec) === "organizationId") removed.add("organizationId");
  return Object.entries(getTableColumns(spec.table)).filter(([field]) => !removed.has(field)) as [string, PgColumn][];
}

function columnSchema(column: PgColumn): z.ZodType {
  const schema = baseColumnSchema(column);
  return column.notNull ? schema : schema.nullable();
}

function baseColumnSchema(column: PgColumn): z.ZodType {
  const enumValues = (column as { enumValues?: string[] }).enumValues;
  switch (column.columnType) {
    case "PgUUID":
      return z.guid();
    case "PgText":
    case "PgVarchar":
    case "PgEnumColumn":
      return enumValues && enumValues.length > 0 ? z.enum(enumValues as [string, ...string[]]) : z.string();
    case "PgInteger":
    case "PgSmallInt":
    case "PgBigInt53":
    case "PgBigSerial53":
    case "PgSerial":
      return z.number().int();
    case "PgDoublePrecision":
    case "PgReal":
      return z.number();
    case "PgBoolean":
      return z.boolean();
    case "PgTimestamp":
      return z.iso.datetime();
    case "PgDateString":
      return z.iso.date();
    case "PgTime":
      return z.iso.time();
    case "PgJsonb":
    case "PgJson":
      return z.json();
    case "PgArray":
      return z.array(baseColumnSchema((column as unknown as { baseColumn: PgColumn }).baseColumn));
    default:
      throw new Error(`type de colonne non pris en charge par l'export : ${column.columnType}`);
  }
}

// Schéma d'une ligne exportée : un fichier y est un chemin dans l'archive.
export function exportRowSchema(spec: ExportEntitySpec): z.ZodObject {
  const files = new Set(spec.files ?? []);
  return z.strictObject(
    Object.fromEntries(
      exportedColumns(spec).map(([field, column]) => {
        if (!files.has(field)) return [field, columnSchema(column)];
        return [field, column.notNull ? z.string() : z.string().nullable()];
      }),
    ),
  );
}

export function describeModuleEntities(module: OrganizationExportModule, specs: readonly ExportEntitySpec[]): ExportEntitySchema[] {
  return specs.map((spec) => ({ module, name: entityName(spec), schema: exportRowSchema(spec) }));
}

function serialize(value: unknown): ExportValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value as RawRow).map(([key, item]) => [key, serialize(item)]));
  return value as string | number | boolean;
}

function kebab(field: string): string {
  return field.replace(/Key$/, "").replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`) || "file";
}

function extension(storageKey: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(storageKey.split("/").pop() ?? "");
  return match ? match[1]!.toLowerCase() : "bin";
}

export function exportFilePath(module: OrganizationExportModule, entity: string, rowId: string, field: string, storageKey: string): string {
  return `fichiers/${module}/${entity}/${rowId}-${kebab(field)}.${extension(storageKey)}`;
}

function parentRefs(spec: ExportEntitySpec, row: RawRow): Array<[string, unknown]> {
  if (!spec.parents) return [];
  if (typeof spec.parents === "function") return spec.parents(row);
  return Object.entries(spec.parents).map(([field, entity]) => [entity, row[field]]);
}

export async function exportModuleEntities(
  db: AppDatabase,
  input: {
    organizationId: string;
    module: OrganizationExportModule;
    context: ModuleExportContext;
    specs: readonly ExportEntitySpec[];
  },
): Promise<ModuleExport> {
  const { organizationId, module, context } = input;
  return db.transaction(
    async (tx) => {
      // Lot 39a (ADR 0073) : l'export complet livre aussi la corbeille, avec la date de suppression.
      await tx.execute(sql`select set_config('app.organization_id', ${organizationId}, true), set_config('app.include_deleted', 'on', true)`);
      // Identifiants exclus (essai), par entité : leurs enfants le sont aussi.
      const excluded = new Map<string, Set<string>>();
      const entities: ModuleExport["entities"] = [];
      const files: ExportFileRef[] = [];
      for (const spec of input.specs) {
        const name = entityName(spec);
        const columns = getTableColumns(spec.table) as Record<string, PgColumn>;
        const idField = spec.idField ?? "id";
        const organizationColumn = columns[organizationField(spec)];
        const idColumn = columns[idField];
        if (!organizationColumn || !idColumn) throw new Error(`entité ${module}/${name} : champ d'organisation ou identifiant introuvable`);
        const rows = (await tx.select().from(spec.table).where(eq(organizationColumn, organizationId)).orderBy(asc(idColumn))) as RawRow[];
        const dropped = new Set<string>();
        excluded.set(name, dropped);
        const kept: ExportRow[] = [];
        for (const row of rows) {
          const id = String(row[idField]);
          const demo = spec.demoField ? row[spec.demoField] === true : false;
          const eventId = spec.eventField ? row[spec.eventField] : null;
          const demoEvent = typeof eventId === "string" && context.excludedEventIds.has(eventId);
          const orphan = parentRefs(spec, row).some(([entity, parentId]) => typeof parentId === "string" && excluded.get(entity)?.has(parentId));
          if (demo || demoEvent || orphan) {
            dropped.add(id);
            continue;
          }
          const out: ExportRow = {};
          const source = spec.transform ? spec.transform(row) : row;
          for (const [field] of exportedColumns(spec)) {
            const value = source[field];
            if ((spec.files ?? []).includes(field) && typeof value === "string" && value !== "") {
              const path = exportFilePath(module, name, id, field, value);
              files.push({ path, storageKey: value, entity: `${module}/${name}`, rowId: id, field });
              out[field] = path;
            } else {
              out[field] = serialize(value);
            }
          }
          kept.push(out);
        }
        entities.push({ name, rows: kept });
      }
      return { module, entities, files };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
