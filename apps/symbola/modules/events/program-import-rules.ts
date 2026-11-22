// Lot 51 (CHR-08 ; ADR 0091) — règles pures de l'import d'un chrono : colonnes reconnues (données de
// départ program-import-columns.json), heures lues sous leurs formes courantes, jour de chaque
// séquence (temps fort existant, temps fort à créer, ou date seule), écarts expliqués ligne par
// ligne. Rien n'est écrit ici : l'aperçu se montre avant (program-import.ts).
import { matchProgramSpeaker, parseDate, textSimilarity, type ProgramExport, type ProgramExportSpeaker } from "@symbola/import-engine";
import type { ProgramExportProfile, ProgramImportColumnKey } from "@symbola/starter-templates";
import type { ProgramImportParticipant, ProgramImportProblem, ProgramImportRow } from "@symbola/contracts";

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

// Lot 63b (CHR-08) — import du PDF de programme de l'ancien logiciel. Chaque intervenant de
// l'en-tête se voit proposer un poste prestataire de l'évènement : celui dont un prestataire porte
// son nom (raison sociale ou contact), sinon le seul poste de son métier. La planner l'accepte ou
// en choisit un autre, ou aucun : l'interlocuteur reste alors en texte. Rien n'est écrit ici.
export type ProgramSlotOption = { id: string; label: string; vendorNames: string[] };

const SAME_NAME = 0.85;

export function proposeSpeakerSlot(
  speaker: Pick<ProgramExportSpeaker, "role" | "company" | "contact">,
  slots: readonly ProgramSlotOption[],
  synonymGroups: readonly (readonly string[])[] = [],
): string | null {
  const names = [speaker.company, speaker.contact].filter((name): name is string => Boolean(name));
  const byName = slots.filter((slot) => slot.vendorNames.some((vendor) => names.some((name) => textSimilarity(vendor, name) >= SAME_NAME)));
  if (byName.length === 1) return byName[0]!.id;
  const role = foldText(speaker.role);
  const group = synonymGroups.find((entries) => entries.some((entry) => foldText(entry) === role));
  const sameRole = (byName.length > 1 ? byName : slots).filter((slot) => {
    const label = foldText(slot.label);
    return label === role || textSimilarity(slot.label, speaker.role) >= SAME_NAME || (group?.some((entry) => foldText(entry) === label) ?? false);
  });
  return sameRole.length === 1 ? sameRole[0]!.id : null;
}

const roleKey = (value: string) => foldText(value).replace(/[^a-z0-9]+/g, "");

export function speakerKind(speaker: Pick<ProgramExportSpeaker, "role">, profile: Pick<ProgramExportProfile, "plannerRoles" | "clientRoles">): "vendor" | "planner" | "client" {
  const key = roleKey(speaker.role);
  if (profile.plannerRoles.some((role) => roleKey(role) === key)) return "planner";
  if (profile.clientRoles.some((role) => roleKey(role) === key)) return "client";
  return "vendor";
}

// Les séquences lues, prêtes pour l'aperçu : jour, heures, note, interlocuteurs rattachés au poste
// choisi pour leur intervenant (la planner ignorée), repère et « Caché des mariés ».
export function programRowsFromExport(
  program: ProgramExport,
  context: { eventDate: string | null },
  speakerSlots: ReadonlyMap<number, string | null>,
  slotLabels: ReadonlyMap<string, string>,
): { rows: ProgramImportRow[]; problems: { line: number; problem: ProgramImportProblem }[] } {
  const rows: ProgramImportRow[] = [];
  const problems: { line: number; problem: ProgramImportProblem }[] = [];
  for (const row of program.rows) {
    if (!row.startTime) {
      problems.push({ line: row.line, problem: "untimed" });
      continue;
    }
    const label = row.title.trim();
    if (!label) {
      problems.push({ line: row.line, problem: "label" });
      continue;
    }
    if (label.length > PROGRAM_IMPORT_TEXT_MAX) {
      problems.push({ line: row.line, problem: "too_long" });
      continue;
    }
    const momentDate = row.date ?? context.eventDate;
    if (!momentDate) {
      problems.push({ line: row.line, problem: "moment_date" });
      continue;
    }
    const participants: ProgramImportParticipant[] = [];
    for (const contact of row.contacts) {
      if (contact.kind === "planner") continue;
      const speaker = matchProgramSpeaker(contact, program.speakers);
      const slotId = speaker === null ? null : (speakerSlots.get(speaker) ?? null);
      const slotLabel = slotId ? slotLabels.get(slotId) : undefined;
      const entry = slotId && slotLabel !== undefined ? { vendorSlotId: slotId, label: slotLabel } : { vendorSlotId: null, label: contact.text.slice(0, PROGRAM_IMPORT_TEXT_MAX) };
      if (!participants.some((existing) => (existing.vendorSlotId ?? existing.label) === (entry.vendorSlotId ?? entry.label))) participants.push(entry);
    }
    // Une description trop longue est coupée : c'est une note, la séquence reste importée.
    const note = row.description && row.description.length > PROGRAM_IMPORT_NOTE_MAX ? `${row.description.slice(0, PROGRAM_IMPORT_NOTE_MAX - 1)}…` : row.description;
    rows.push({
      line: row.line,
      moment: null,
      momentDate,
      startTime: row.startTime,
      endTime: row.endTime,
      label,
      location: null,
      responsible: null,
      note,
      participants,
      marker: row.marker,
      hiddenFromClients: row.hiddenFromClients,
      endsNextDay: row.endsNextDay,
    });
  }
  return { rows, problems };
}
