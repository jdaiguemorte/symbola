// Mise en table des lignes lues (IMP-01) : ligne d'en-tête, largeur commune,
// retrait des lignes vides, espaces superflus et neutralisation des formules.
import type { ParsedLine } from "./csv";
import { neutralizeCell } from "./neutralize";
import { ReadError, type ImportTable } from "./types";

const HEADER_SEARCH_LINES = 20;

type TableLimits = { maxRows: number; maxColumns: number; maxCellLength: number };

export function buildTable(
  lines: ParsedLine[],
  format: Pick<ImportTable, "format" | "encoding" | "delimiter">,
  limits: TableLimits,
): ImportTable {
  let neutralizedCells = 0;
  const cleaned = lines
    .map((line) => ({
      lineNumber: line.lineNumber,
      cells: line.cells.map((raw) => {
        if (raw.length > limits.maxCellLength) throw new ReadError("malformed");
        const { value, neutralized } = neutralizeCell(raw.trim());
        if (neutralized) neutralizedCells += 1;
        return value;
      }),
    }))
    .filter((line) => line.cells.some((cell) => cell !== ""));

  if (cleaned.length === 0) throw new ReadError("empty");

  const headerIndex = findHeaderLine(cleaned);
  const header = headerIndex === -1 ? null : cleaned[headerIndex];
  const dataLines = headerIndex === -1 ? cleaned : cleaned.slice(headerIndex + 1);
  if (dataLines.length === 0) throw new ReadError("empty");
  if (dataLines.length > limits.maxRows) throw new ReadError("too_many_rows");

  const width = Math.max(header ? lastFilled(header.cells) : 0, ...dataLines.map((line) => lastFilled(line.cells)));
  if (width > limits.maxColumns) throw new ReadError("too_many_columns");

  const pad = (cells: string[]) => Array.from({ length: width }, (_, index) => cells[index] ?? "");
  return {
    ...format,
    headerRowIndex: header ? header.lineNumber - 1 : -1,
    headers: header ? pad(header.cells) : Array.from({ length: width }, () => ""),
    rows: dataLines.map((line) => pad(line.cells)),
    sourceLineNumbers: dataLines.map((line) => line.lineNumber),
    neutralizedCells,
  };
}

function lastFilled(cells: string[]): number {
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    if (cells[index] !== "") return index + 1;
  }
  return 0;
}

// L'en-tête est la première ligne (parmi les premières) assez remplie, aux
// intitulés distincts, dont aucune cellule n'a l'allure d'une valeur (nombre,
// date, e-mail). Une ligne de titre (« Export du 12/10/2026 ») au-dessus est
// ainsi ignorée. Sans ligne qui convienne : -1, colonnes sans intitulé.
function findHeaderLine(lines: { cells: string[] }[]): number {
  const sample = lines.slice(0, HEADER_SEARCH_LINES);
  const widest = Math.max(...sample.map((line) => filledCount(line.cells)));
  const minimum = Math.max(1, Math.ceil(widest / 2));
  return sample.findIndex((line) => {
    const filled = line.cells.filter((cell) => cell !== "");
    if (filled.length < minimum) return false;
    const distinct = new Set(filled.map((cell) => cell.toLowerCase()));
    if (distinct.size !== filled.length) return false;
    return filled.every((cell) => !looksLikeValue(cell));
  });
}

function filledCount(cells: string[]): number {
  return cells.filter((cell) => cell !== "").length;
}

function looksLikeValue(cell: string): boolean {
  const text = cell.replace(/^'/, "");
  return (
    /^[+-]?[\d\s  .,]+\s?(€|eur)?$/i.test(text) ||
    /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/.test(text) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ||
    /^(true|false|vrai|faux)$/i.test(text)
  );
}
