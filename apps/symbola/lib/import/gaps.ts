// IMP-04 — rapport des écarts d'un import en cours : colonnes sans
// équivalent (à garder en champ libre ou à ignorer) et lignes rejetées avec
// leur motif (valeur invalide, champ obligatoire manquant, événement
// introuvable pour une tâche ou une ligne de budget).
import type { ImportEntityType } from "@symbola/contracts";
import { createAppConnection } from "@symbola/db/client";
import type { RowError } from "@symbola/import-engine";
import { getImportWorkingSet, isGapColumn, type ImportWorkingSet } from "@/modules/hub/service";
import { getImportMatchesView } from "./matching";

export type RejectionReason = RowError | { code: "event_not_found"; fieldKey: null; value: "" };

export type GapColumnView = {
  columnIndex: number;
  header: string;
  samples: string[];
  decision: "undecided" | "keep" | "ignore";
};

export type RejectedRowView = { rowIndex: number; lineNumber: number; reasons: RejectionReason[] };

export type GapsView = {
  importId: string;
  entityType: ImportEntityType;
  fileName: string;
  rowCount: number;
  columns: GapColumnView[];
  rejected: RejectedRowView[];
};

const SAMPLE_VALUES = 3;

async function workingSet(organizationId: string, importId: string): Promise<ImportWorkingSet | null> {
  const { sql, db } = createAppConnection();
  try {
    return await getImportWorkingSet(db, organizationId, importId);
  } finally {
    await sql.end();
  }
}

export async function getImportGapsView(organizationId: string, importId: string): Promise<GapsView | null> {
  // Les rapprochements (calculés au besoin) disent quelles tâches ou lignes
  // de budget n'ont pas d'événement.
  const matches = await getImportMatchesView(organizationId, importId);
  const set = await workingSet(organizationId, importId);
  if (!matches || !set) return null;

  const columns = set.mapping.filter(isGapColumn).map((choice) => ({
    columnIndex: choice.columnIndex,
    header: set.headers[choice.columnIndex] ?? "",
    samples: set.rows
      .map((row) => row[choice.columnIndex] ?? "")
      .filter((value) => value !== "")
      .slice(0, SAMPLE_VALUES),
    decision: choice.target === "free" ? ("keep" as const) : choice.target === "ignore" ? ("ignore" as const) : ("undecided" as const),
  }));

  const rejected = matches.rows
    .map((row) => {
      const reasons: RejectionReason[] = [...row.errors];
      if (row.errors.length === 0 && row.event && !row.event.candidate) reasons.push({ code: "event_not_found", fieldKey: null, value: "" });
      return { rowIndex: row.rowIndex, lineNumber: row.lineNumber, reasons };
    })
    .filter((row) => row.reasons.length > 0);

  return {
    importId: set.importId,
    entityType: set.entityType,
    fileName: set.fileName,
    rowCount: set.rows.length,
    columns,
    rejected,
  };
}

// Lignes rejetées, avec leurs colonnes d'origine, pour les corriger et les
// réimporter.
export async function getRejectedRowsForExport(
  organizationId: string,
  importId: string,
): Promise<{ fileName: string; headers: string[]; rows: { cells: string[]; reasons: RejectionReason[] }[] } | null> {
  const view = await getImportGapsView(organizationId, importId);
  const set = await workingSet(organizationId, importId);
  if (!view || !set) return null;
  return {
    fileName: set.fileName,
    headers: set.headers,
    rows: view.rejected.map((row) => ({ cells: set.rows[row.rowIndex] ?? [], reasons: row.reasons })),
  };
}
