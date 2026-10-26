import { extractColumns, type ColumnReference } from "./migration-scanner";
import { findRegistryEntry, type Registry } from "./registry";
import { isSuspiciousPersonalField } from "./suspicious-fields";

export type RegistryViolation = ColumnReference;

/**
 * SOC-07 — étant donné une migration qui ajoute une colonne nommée comme
 * personnelle (email, phone, first_name…) sans déclaration dans le
 * registre, la liste de violations n'est pas vide (et la CI doit échouer).
 */
export function checkMigrationAgainstRegistry(
  migrationSql: string,
  registry: Registry,
): RegistryViolation[] {
  const columns = extractColumns(migrationSql);

  return columns.filter(
    (column) =>
      isSuspiciousPersonalField(column.field) && !findRegistryEntry(registry, column),
  );
}
