// EVT-05 — règles pures du programme du jour J : heures, tri,
// chevauchements d'un même intervenant, variantes du PDF.
const MINUTES_PER_DAY = 24 * 60;

// La base renvoie « HH:MM:SS » ; le programme s'affiche et se saisit en « HH:MM ».
export function normalizeTime(value: string): string {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
  if (!match) throw new RangeError(`heure invalide : ${value}`);
  return `${match[1]}:${match[2]}`;
}

function toMinutes(value: string): number {
  const [hours, minutes] = normalizeTime(value).split(":").map(Number) as [number, number];
  return hours * 60 + minutes;
}

export type ProgramLineParticipant = { vendorSlotId: string | null; label: string };

type ProgramLine = {
  id: string;
  startTime: string;
  endTime: string | null;
  participants: ProgramLineParticipant[];
};

export function sortProgramItems<T extends { startTime: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

// Une heure de fin antérieure (ou égale) au début signifie « après minuit ».
// Sans heure de fin, la ligne est un instant.
function intervalOf(line: ProgramLine): { start: number; end: number } {
  const start = toMinutes(line.startTime);
  if (line.endTime === null) return { start, end: start };
  const end = toMinutes(line.endTime);
  return { start, end: end <= start ? end + MINUTES_PER_DAY : end };
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  if (a.start === a.end && b.start === b.end) return a.start === b.start;
  if (a.start === a.end) return b.start <= a.start && a.start < b.end;
  if (b.start === b.end) return a.start <= b.start && b.start < a.end;
  return a.start < b.end && b.start < a.end;
}

// Un poste prestataire est reconnu par son identifiant, un intervenant
// libre par son libellé (sans tenir compte de la casse ni des espaces).
function participantKey(participant: ProgramLineParticipant): string {
  return participant.vendorSlotId ? `slot:${participant.vendorSlotId}` : `free:${participant.label.trim().toLowerCase()}`;
}

export type ProgramOverlapWarning = { participant: string; itemIds: [string, string] };

// PRD EVT-05 : « l'app le signale sans bloquer » — un avertissement par
// paire de lignes et par intervenant, dans l'ordre du programme.
export function findProgramOverlaps(lines: ProgramLine[]): ProgramOverlapWarning[] {
  const sorted = sortProgramItems(lines);
  const warnings: ProgramOverlapWarning[] = [];
  for (const [index, first] of sorted.entries()) {
    for (const second of sorted.slice(index + 1)) {
      if (!overlaps(intervalOf(first), intervalOf(second))) continue;
      const secondKeys = new Set(second.participants.map(participantKey));
      const reported = new Set<string>();
      for (const participant of first.participants) {
        const key = participantKey(participant);
        if (!secondKeys.has(key) || reported.has(key)) continue;
        reported.add(key);
        warnings.push({ participant: participant.label.trim(), itemIds: [first.id, second.id] });
      }
    }
  }
  return warnings;
}

export type ProgramVariant = "couple" | "vendors";

// Variante « mariés » : jamais de note interne (PRD EVT-05, EVT-06).
export function programForVariant<T extends { internalNote: string | null }>(items: T[], variant: ProgramVariant): T[] {
  return variant === "couple" ? items.map((item) => ({ ...item, internalNote: null })) : items;
}
