// IMP-04 — CSV du rapport des lignes rejetées, à ouvrir dans un tableur pour
// corriger puis réimporter : point-virgule, BOM UTF-8 (Excel français),
// toutes les cellules neutralisées contre l'injection de formules
// (CLAUDE.md §5) — celles du fichier l'ont déjà été à la lecture.
import { neutralizeCell } from "@symbola/import-engine";

function cell(value: string): string {
  const safe = neutralizeCell(value).value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function rejectedRowsCsv(input: { headers: string[]; reasonHeader: string; rows: { cells: string[]; reason: string }[] }): string {
  const lines = [
    [input.reasonHeader, ...input.headers].map(cell).join(";"),
    ...input.rows.map((row) => [row.reason, ...input.headers.map((_, index) => row.cells[index] ?? "")].map(cell).join(";")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}

// Nom du fichier téléchargé : « <nom d'origine>-lignes-rejetees.csv »,
// sans caractère qui casserait l'en-tête Content-Disposition.
export function rejectedRowsFileName(fileName: string, suffix: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N} _.-]/gu, "_").slice(0, 100) || "import";
  return `${base}-${suffix}.csv`;
}
