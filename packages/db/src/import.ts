// Lot 35b (HUB-13, décisions D6 et D7, ADR 0098) — écriture générique des entités d'un module à la
// reprise d'un export Symbola (contrat export/v1), symétrique de la lecture (export.ts) : chaque
// module la déclare dans son export.ts, avec les mêmes specs, et l'appelle par son service.ts ; ce
// fichier ne connaît aucune table.
//
// - Tout s'écrit dans la transaction de la reprise (organisation fixée, RLS) : un échec n'écrit rien.
// - Chaque ligne reçoit un nouvel identifiant : la table de correspondance, commune à tous les
//   modules, est remplie avant toute écriture (registerModuleImportIds), puis chaque valeur égale à
//   un ancien identifiant est remplacée, où qu'elle soit (colonne, liste, document JSON) : les
//   liens d'un module à l'autre suivent.
// - Un fichier est remplacé par sa nouvelle clé dans le stockage privé.
// - Les dates de création et les auteurs sont gardés (core.stamp_row ne remplace qu'une valeur nulle).
// - Les lignes d'une table qui se référencent entre elles sont écrites parents d'abord.
import { randomUUID } from "node:crypto";
import { eq, getTableColumns, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { ExportRow, ImportEntityResult, ModuleImportContext, ModuleImportRows } from "@symbola/contracts";
import { entityName, exportedColumns, organizationField, type ExportEntitySpec, type ExportRawRow } from "./export";
import type { OrganizationTransaction } from "./with-organization";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Paramètres d'une requête : PostgreSQL en accepte 65 535.
const MAX_PARAMETERS = 30_000;

export class ImportReferenceError extends Error {
  constructor(readonly entity: string, readonly detail: string) {
    super(`reprise : ${entity} (${detail})`);
    this.name = "ImportReferenceError";
  }
}

function idFieldOf(spec: ExportEntitySpec): string {
  return spec.idField ?? "id";
}

// Nouveaux identifiants des lignes reprises d'un module (avant toute écriture).
export function registerModuleImportIds(specs: readonly ExportEntitySpec[], rows: ModuleImportRows, context: ModuleImportContext): void {
  for (const spec of specs) {
    if (spec.importSkip) continue;
    const idField = idFieldOf(spec);
    if (idField === "organizationId" || idField === organizationField(spec)) continue;
    for (const row of rows.get(entityName(spec)) ?? []) {
      const id = row[idField];
      if (typeof id === "string" && UUID.test(id) && !context.ids.has(id)) context.ids.set(id, randomUUID());
    }
  }
}

// Remplace tout ancien identifiant par le nouveau, dans une valeur, une liste ou un document JSON.
export function remapImportValue(value: unknown, ids: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => remapImportValue(item, ids));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [ids.get(key) ?? key, remapImportValue(item, ids)]));
  }
  return value;
}

function deserialize(column: PgColumn, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (column.columnType === "PgTimestamp" && typeof value === "string") return new Date(value);
  return value;
}

// Ordre d'écriture : une ligne après celles de la même table qu'elle cite (parent, ligne annulée…).
function parentsFirst(rows: ExportRawRow[], idField: string): ExportRawRow[] {
  const byId = new Map(rows.map((row) => [String(row[idField]), row] as const));
  const done = new Set<string>();
  const ordered: ExportRawRow[] = [];
  const visit = (row: ExportRawRow, path: Set<string>) => {
    const id = String(row[idField]);
    if (done.has(id) || path.has(id)) return;
    path.add(id);
    for (const [field, value] of Object.entries(row)) {
      if (field === idField || typeof value !== "string") continue;
      const parent = byId.get(value);
      if (parent && parent !== row) visit(parent, path);
    }
    path.delete(id);
    done.add(id);
    ordered.push(row);
  };
  for (const row of rows) visit(row, new Set());
  return ordered;
}

// Lignes d'une entité, prêtes à écrire dans l'organisation qui reprend.
export function prepareImportRows(spec: ExportEntitySpec, rows: readonly ExportRow[], context: ModuleImportContext): ExportRawRow[] {
  const name = entityName(spec);
  const files = new Set(spec.files ?? []);
  const columns = exportedColumns(spec);
  const prepared: ExportRawRow[] = [];
  for (const row of rows) {
    let out: ExportRawRow = {};
    for (const [field, column] of columns) {
      const value = row[field];
      if (files.has(field)) {
        if (value === null || value === undefined || value === "") {
          out[field] = value ?? null;
          continue;
        }
        const key = context.files.get(String(value));
        if (!key) throw new ImportReferenceError(name, "fichier absent de l'archive");
        out[field] = key;
        continue;
      }
      out[field] = deserialize(column, remapImportValue(value, context.ids));
    }
    if (organizationField(spec) === "organizationId") out.organizationId = context.organizationId;
    if (spec.importTransform) {
      const transformed = spec.importTransform(out, context);
      if (!transformed) continue;
      out = transformed;
    }
    prepared.push(out);
  }
  return parentsFirst(prepared, idFieldOf(spec));
}

// Écrit des lignes déjà préparées (par paquets, dans l'ordre donné).
export async function insertImportRows(tx: OrganizationTransaction, spec: ExportEntitySpec, rows: readonly ExportRawRow[]): Promise<void> {
  if (rows.length === 0) return;
  // Réglages à une ligne par organisation (profil, réglages RGPD…) : la ligne de l'espace qui reprend,
  // s'il en a une, prend les valeurs de l'archive (ces tables n'accordent pas toutes la suppression).
  if (idFieldOf(spec) === "organizationId") {
    const target = (getTableColumns(spec.table) as Record<string, PgColumn>).organizationId!;
    for (const row of rows) {
      const values = Object.fromEntries(Object.entries(row).filter(([field]) => field !== "organizationId"));
      await tx.insert(spec.table).values(row as never).onConflictDoUpdate({ target, set: values as never });
    }
    return;
  }
  const width = Math.max(1, Object.keys(getTableColumns(spec.table)).length);
  const size = Math.max(1, Math.floor(MAX_PARAMETERS / width));
  for (let start = 0; start < rows.length; start += size) {
    // Le type d'insertion de Drizzle dépend de la table ; les lignes viennent du schéma de l'entité.
    await tx.insert(spec.table).values(rows.slice(start, start + size) as never);
  }
}

// Écrit les entités d'un module dans l'organisation qui reprend, dans l'ordre des specs.
// `deferred` : entités écrites par le module lui-même (pièces comptables, dans l'ordre de leur
// chaîne), à la place de la première d'entre elles.
export async function importModuleEntities(
  tx: OrganizationTransaction,
  input: {
    specs: readonly ExportEntitySpec[];
    rows: ModuleImportRows;
    context: ModuleImportContext;
    deferred?: { entities: ReadonlySet<string>; write: () => Promise<ImportEntityResult[]> };
  },
): Promise<ImportEntityResult[]> {
  const results: ImportEntityResult[] = [];
  let deferredWritten = false;
  for (const spec of input.specs) {
    const name = entityName(spec);
    const archived = input.rows.get(name) ?? [];
    if (spec.importSkip) {
      results.push({ entity: name, rows: archived.length, imported: 0, reason: spec.importSkip });
      continue;
    }
    if (input.deferred?.entities.has(name)) {
      if (!deferredWritten) {
        deferredWritten = true;
        results.push(...(await input.deferred.write()));
      }
      continue;
    }
    const prepared = prepareImportRows(spec, archived, input.context);
    await insertImportRows(tx, spec, prepared);
    results.push({ entity: name, rows: archived.length, imported: prepared.length, reason: null });
  }
  return results;
}

// Avant la reprise : l'organisation vide perd ses réglages de départ et ses essais, que l'archive
// remplace (entités reprises seulement, dans l'ordre inverse de leurs dépendances ; les réglages à une
// ligne par organisation sont mis à jour à l'écriture). Suppressions
// non journalisées une à une (app.audit_bulk) : la reprise écrit sa ligne au journal.
export async function clearModuleImportTargets(tx: OrganizationTransaction, input: { organizationId: string; specs: readonly ExportEntitySpec[] }): Promise<void> {
  await tx.execute(sql`select set_config('app.audit_bulk', 'on', true)`);
  for (const spec of [...input.specs].reverse()) {
    if (spec.importSkip || organizationField(spec) !== "organizationId" || idFieldOf(spec) === "organizationId") continue;
    const column = (getTableColumns(spec.table) as Record<string, PgColumn>).organizationId;
    if (!column) continue;
    // Les tables en ajout seul (registre RGPD, pièces) n'accordent pas la suppression : une
    // organisation vide n'y a rien, et seule une table qui a des lignes est vidée.
    const [any] = await tx.select({ one: sql<number>`1` }).from(spec.table).where(eq(column, input.organizationId)).limit(1);
    if (any) await tx.delete(spec.table).where(eq(column, input.organizationId));
  }
  await tx.execute(sql`select set_config('app.audit_bulk', '', true)`);
}
