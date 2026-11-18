// Lot 51 (CHR-08 ; ADR 0091) — règles pures de l'import d'un chrono : colonnes reconnues (données de
// départ program-import-columns.json), heures lues sous leurs formes courantes, jour de chaque
// séquence (temps fort existant, temps fort à créer, ou date seule), écarts expliqués ligne par
// ligne. Rien n'est écrit ici : l'aperçu se montre avant (program-import.ts).
import { parseDate } from "@symbola/import-engine";
import type { ProgramImportColumnKey } from "@symbola/starter-templates";
import type { ProgramImportProblem, ProgramImportRow } from "@symbola/contracts";

export type ProgramColumnMapping = Partial<Record<ProgramImportColumnKey, number>>;

export const PROGRAM_IMPORT_TEXT_MAX = 200;
export const PROGRAM_IMPORT_NOTE_MAX = 2000;

export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim();
}

export function mapProgramColumns(headers: string[], columns: Record<ProgramImportColumnKey, string[]>): { mapping: ProgramColumnMapping; unknown: number[] } {
  const known = (Object.entries(columns) as [ProgramImportColumnKey, string[]][]).map(([field, names]) => [field, new Set(names.map(foldText))] as const);
  const mapping: ProgramColumnMapping = {};
  const unknown: number[] = [];
  headers.forEach((header, index) => {
    const name = foldText(header);
    if (name === "") return;
    const field = known.find(([candidate, names]) => mapping[candidate] === undefined && names.has(name))?.[0];
    if (field) mapping[field] = index;
    else unknown.push(index);
  });
  return { mapping, unknown };
}

const pad = (value: number) => String(value).padStart(2, "0");

// « 16:00 », « 16h30 », « 9 h », « 4:05 PM », « 16:00:00 », ou la fraction de jour d'un tableur.
export function parseClock(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (/^0?\.\d+$/.test(text)) {
    const minutes = Math.round(Number(text) * 1440);
    return minutes >= 0 && minutes < 1440 ? `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}` : null;
  }
  const match = /^(\d{1,2})\s*(?:[:h.]\s*(\d{2})?)?(?::\d{2})?\s*(am|pm)?$/.exec(text);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (match[3]) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (match[3] === "pm" ? 12 : 0);
  }
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

function cell(row: string[], index: number | undefined): string {
  return index === undefined ? "" : (row[index] ?? "").replace(/\s+/g, " ").trim();
}

function optional(value: string): string | null {
  return value === "" ? null : value;
}

export function readProgramRows(
  rows: string[][],
  lines: number[],
  mapping: ProgramColumnMapping,
  context: { eventDate: string | null; moments: { name: string; date: string }[] },
): { rows: ProgramImportRow[]; problems: { line: number; problem: ProgramImportProblem }[]; newMoments: { name: string; date: string }[] } {
  const result: ProgramImportRow[] = [];
  const problems: { line: number; problem: ProgramImportProblem }[] = [];
  const newMoments: { name: string; date: string }[] = [];
  rows.forEach((row, index) => {
    const line = lines[index] ?? index + 1;
    const startTime = parseClock(cell(row, mapping.start));
    if (!startTime) return void problems.push({ line, problem: "start" });
    const endText = cell(row, mapping.end);
    const endTime = endText ? parseClock(endText) : null;
    if (endText && !endTime) return void problems.push({ line, problem: "end" });
    const label = cell(row, mapping.label);
    if (!label) return void problems.push({ line, problem: "label" });
    const location = optional(cell(row, mapping.location));
    const responsible = optional(cell(row, mapping.responsible));
    const note = optional(mapping.note === undefined ? "" : (row[mapping.note] ?? "").trim());
    if ([label, location, responsible].some((text) => text !== null && text.length > PROGRAM_IMPORT_TEXT_MAX) || (note?.length ?? 0) > PROGRAM_IMPORT_NOTE_MAX) {
      return void problems.push({ line, problem: "too_long" });
    }
    // Le jour : une date dans la colonne « temps fort / jour », sinon un nom de temps fort.
    const momentText = cell(row, mapping.moment);
    const asDate = momentText ? parseDate(momentText) : null;
    const dateColumn = cell(row, mapping.date);
    const columnDate = dateColumn ? parseDate(dateColumn) : null;
    let moment: string | null = null;
    let momentDate: string | null;
    if (momentText && !asDate) {
      const existing = context.moments.find((candidate) => foldText(candidate.name) === foldText(momentText) && (!columnDate || candidate.date === columnDate));
      moment = existing?.name ?? momentText;
      momentDate = existing?.date ?? columnDate ?? context.eventDate;
      if (!momentDate) return void problems.push({ line, problem: "moment_date" });
      if (moment.length > 100) return void problems.push({ line, problem: "too_long" });
      if (!existing && !newMoments.some((candidate) => foldText(candidate.name) === foldText(moment!) && candidate.date === momentDate)) newMoments.push({ name: moment, date: momentDate });
    } else {
      momentDate = asDate ?? columnDate ?? context.eventDate;
    }
    result.push({ line, moment, momentDate, startTime, endTime, label, location, responsible, note });
  });
  return { rows: result, problems, newMoments };
}
