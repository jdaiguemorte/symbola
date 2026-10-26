// Repère les colonnes ajoutées par une migration SQL (SOC-07). Lecture
// volontairement simple par expressions régulières — les migrations de ce
// dépôt sont générées par drizzle-kit, donc un format prévisible
// (CREATE TABLE "schema"."table" (...) et ALTER TABLE ... ADD COLUMN).
// Pas de dépendance à un vrai parseur SQL pour rester dans la stack.
export type ColumnReference = { schema: string; table: string; field: string };

const CREATE_TABLE = /CREATE TABLE\s+"(\w+)"\."(\w+)"\s*\(/g;
const ALTER_TABLE_ADD_COLUMN =
  /ALTER TABLE\s+"(\w+)"\."(\w+)"\s+ADD COLUMN\s+"?(\w+)"?/gi;
const COLUMN_LINE = /^\s*"(\w+)"\s+\S/;

export function extractColumns(sql: string): ColumnReference[] {
  const columns: ColumnReference[] = [];

  for (const match of sql.matchAll(ALTER_TABLE_ADD_COLUMN)) {
    const [, schema, table, field] = match;
    if (schema && table && field) columns.push({ schema, table, field });
  }

  const lines = sql.split("\n");
  let currentTable: { schema: string; table: string } | null = null;
  let depth = 0;

  for (const line of lines) {
    if (currentTable === null) {
      CREATE_TABLE.lastIndex = 0;
      const match = CREATE_TABLE.exec(line);
      if (match) {
        const [, schema, table] = match;
        if (schema && table) {
          currentTable = { schema, table };
          depth = 1;
        }
      }
      continue;
    }

    depth += (line.match(/\(/g)?.length ?? 0) - (line.match(/\)/g)?.length ?? 0);

    const columnMatch = COLUMN_LINE.exec(line);
    if (columnMatch?.[1]) {
      columns.push({ ...currentTable, field: columnMatch[1] });
    }

    if (depth <= 0) {
      currentTable = null;
    }
  }

  return columns;
}
