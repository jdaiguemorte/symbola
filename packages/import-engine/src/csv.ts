// Texte délimité (IMP-01) : séparateur détecté parmi virgule, point-virgule et
// tabulation ; guillemets doubles (RFC 4180, "" pour un guillemet), retours à
// la ligne dans une cellule, fins de ligne CRLF, LF ou CR.
import type { Delimiter } from "./types";

const CANDIDATES: Delimiter[] = [";", ",", "\t"];
const SAMPLE_LINES = 30;

export type ParsedLine = { cells: string[]; lineNumber: number };

export function parseDelimited(text: string, delimiter: Delimiter, maxLines = Number.POSITIVE_INFINITY): ParsedLine[] {
  const lines: ParsedLine[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let atCellStart = true;
  let lineNumber = 1;
  let lineStart = 1;
  let i = 0;

  const endCell = () => {
    cells.push(cell);
    cell = "";
    atCellStart = true;
  };
  const endLine = () => {
    endCell();
    lines.push({ cells, lineNumber: lineStart });
    cells = [];
  };

  while (i < text.length) {
    if (lines.length >= maxLines) return lines;
    const char = text[i] as string;

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      if (char === "\n" || (char === "\r" && text[i + 1] !== "\n")) lineNumber += 1;
      cell += char;
      i += 1;
      continue;
    }

    if (char === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
      i += 1;
      continue;
    }
    if (char === delimiter) {
      endCell();
      i += 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      endLine();
      i += char === "\r" && text[i + 1] === "\n" ? 2 : 1;
      lineNumber += 1;
      lineStart = lineNumber;
      continue;
    }
    cell += char;
    atCellStart = false;
    i += 1;
  }

  // Dernière ligne sans fin de ligne (un guillemet non fermé garde le reste
  // du fichier dans la cellule, comme le font les tableurs).
  if (cell !== "" || cells.length > 0 || quoted) endLine();
  return lines;
}

// Le bon séparateur découpe les lignes de l'échantillon en un nombre de
// colonnes à la fois supérieur à 1 et constant. À égalité, l'ordre de
// CANDIDATES décide (point-virgule d'abord : exports français d'Excel).
export function detectDelimiter(text: string): Delimiter {
  let best: { delimiter: Delimiter; score: number } | null = null;
  for (const delimiter of CANDIDATES) {
    const counts = parseDelimited(text, delimiter, SAMPLE_LINES)
      .filter((line) => line.cells.some((cell) => cell.trim() !== ""))
      .map((line) => line.cells.length);
    const nonEmpty = counts.filter((count) => count > 1);
    if (nonEmpty.length === 0) continue;
    const mode = modeOf(nonEmpty);
    const consistent = counts.filter((count) => count === mode).length / counts.length;
    const score = consistent * 1000 + Math.min(mode, 999);
    if (!best || score > best.score) best = { delimiter, score };
  }
  return best?.delimiter ?? ",";
}

function modeOf(values: number[]): number {
  const frequency = new Map<number, number>();
  for (const value of values) frequency.set(value, (frequency.get(value) ?? 0) + 1);
  let mode = values[0] as number;
  let top = 0;
  for (const [value, count] of frequency) {
    if (count > top || (count === top && value > mode)) {
      mode = value;
      top = count;
    }
  }
  return mode;
}
