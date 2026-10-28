// JSON (IMP-01) : un tableau d'objets, ou un objet dont une propriété est un
// tableau d'objets (« { "events": [ ... ] } »). Les objets imbriqués sont
// aplatis en colonnes « parent.enfant », un tableau d'objets en colonnes
// numérotées à partir de 1 (« clients.1.firstName ») ; un tableau de valeurs
// devient une cellule « a; b ». Profondeur plafonnée avant même l'analyse.
import type { ParsedLine } from "./csv";
import { ReadError } from "./types";

type JsonLimits = { maxRows: number; maxColumns: number; maxDepth: number };

export function looksLikeJson(text: string): boolean {
  const start = text.trimStart().charAt(0);
  return start === "[" || start === "{";
}

export function readJson(text: string, limits: JsonLimits): ParsedLine[] {
  if (nestingDepth(text) > limits.maxDepth) throw new ReadError("malformed");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ReadError("malformed");
  }

  const records = recordsOf(data);
  if (records === null) throw new ReadError("unsupported_format");
  if (records.length === 0) throw new ReadError("empty");
  if (records.length > limits.maxRows) throw new ReadError("too_many_rows");

  const flattened = records.map((record) => flatten(record));
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const record of flattened) {
    for (const key of record.keys()) {
      if (seen.has(key)) continue;
      seen.add(key);
      headers.push(key);
      if (headers.length > limits.maxColumns) throw new ReadError("too_many_columns");
    }
  }

  // Ligne 1 : en-têtes ; ligne n + 1 : n-ième objet.
  return [
    { cells: headers, lineNumber: 1 },
    ...flattened.map((record, index) => ({
      cells: headers.map((header) => record.get(header) ?? ""),
      lineNumber: index + 2,
    })),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordsOf(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    return data.every(isRecord) ? data : null;
  }
  if (isRecord(data)) {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && value.length > 0 && value.every(isRecord)) return value;
    }
  }
  return null;
}

function flatten(record: Record<string, unknown>, prefix = "", into = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(record)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (isRecord(value)) flatten(value, name, into);
    else if (Array.isArray(value) && value.length > 0 && value.every(isRecord)) {
      value.forEach((item, index) => flatten(item, `${name}.${index + 1}`, into));
    } else into.set(name, scalar(value));
  }
  return into;
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(scalar).filter((item) => item !== "").join("; ");
  if (isRecord(value)) return JSON.stringify(value);
  return String(value);
}

// Profondeur d'imbrication hors chaînes, sans analyser le document.
function nestingDepth(text: string): number {
  let depth = 0;
  let max = 0;
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (char === "\\") i += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "[" || char === "{") {
      depth += 1;
      if (depth > max) max = depth;
    } else if (char === "]" || char === "}") depth -= 1;
  }
  return max;
}
