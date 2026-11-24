// PRD-EVT-05 — règles pures du programme du jour J : heures, tri,
// chevauchements d'un même intervenant, variantes du PDF.
import type { ProgramChanges, ProgramItem, PublishedProgramItem, VendorProgramView } from "@symbola/contracts";

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
  // Lot 67d (CHR-06) : le jour de la séquence (celui de son temps fort) ; absent : jour inconnu.
  day?: string | null;
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

// PRD PRD-EVT-05 : « l'app le signale sans bloquer » — un avertissement par
// paire de lignes et par intervenant, dans l'ordre du programme.
// Lot 67d (CHR-06 ; recette du 24/11/2026, R09) : un avertissement doit mériter d'être lu.
// - Les clients de l'évènement sont de toutes les séquences : un intervenant libre dont le rôle est
//   celui d'un client (« Marié - Valentin », rôles donnés par l'appelant, des données) n'est jamais
//   signalé. Le rôle seul compte, pas le prénom ; un poste prestataire reste un prestataire.
// - Deux séquences de jours différents (veille et jour J) ne se chevauchent pas.
export type ProgramOverlapRoles = { clientRoles: readonly string[]; roleSeparator: string };

const roleKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");

function isClient(participant: ProgramLineParticipant, roles: ProgramOverlapRoles | undefined): boolean {
  if (!roles || participant.vendorSlotId) return false;
  const role = participant.label.split(roles.roleSeparator)[0] ?? participant.label;
  return roles.clientRoles.some((candidate) => roleKey(candidate) === roleKey(role));
}

export function findProgramOverlaps(lines: ProgramLine[], roles?: ProgramOverlapRoles): ProgramOverlapWarning[] {
  const sorted = sortProgramItems(lines);
  const warnings: ProgramOverlapWarning[] = [];
  for (const [index, first] of sorted.entries()) {
    for (const second of sorted.slice(index + 1)) {
      if ((first.day ?? null) !== (second.day ?? null)) continue;
      if (!overlaps(intervalOf(first), intervalOf(second))) continue;
      const secondKeys = new Set(second.participants.map(participantKey));
      const reported = new Set<string>();
      for (const participant of first.participants) {
        if (isClient(participant, roles)) continue;
        const key = participantKey(participant);
        if (!secondKeys.has(key) || reported.has(key)) continue;
        reported.add(key);
        warnings.push({ participant: participant.label.trim(), itemIds: [first.id, second.id] });
      }
    }
  }
  return warnings;
}

// Lot 30b (CHR-06, décision D8) — décaler les séquences suivantes d'autant que la
// séquence dont l'heure de début change. Les heures restent celles du jour J : un
// début qui passerait minuit (ou avant 00:00) sortirait du jour, et la séquence se
// déplace alors à la main. La fin suit le début ; une fin après minuit le reste.
export const MAX_SHIFT_MINUTES = 12 * 60;

function clockOf(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

// Écart signé, ramené dans ]-12 h ; 12 h] : 23:50 → 00:10 avance de 20 min.
export function startShift(oldStart: string, newStart: string): number {
  let delta = toMinutes(newStart) - toMinutes(oldStart);
  if (delta > MAX_SHIFT_MINUTES) delta -= MINUTES_PER_DAY;
  if (delta <= -MAX_SHIFT_MINUTES) delta += MINUTES_PER_DAY;
  return delta;
}

// Début et fin décalés ; null si le début sortirait du jour J.
export function shiftedTimes(line: { startTime: string; endTime: string | null }, minutes: number): { startTime: string; endTime: string | null } | null {
  const start = toMinutes(line.startTime) + minutes;
  if (start < 0 || start >= MINUTES_PER_DAY) return null;
  return { startTime: clockOf(start), endTime: line.endTime === null ? null : clockOf(toMinutes(line.endTime) + minutes) };
}

export type ProgramShiftPlan = { minutes: number; itemIds: string[]; outOfDay: boolean };

// Les séquences qui commencent après l'ancienne heure de la séquence modifiée ;
// `outOfDay` quand l'une d'elles sortirait du jour J.
export function proposeProgramShift<T extends { id: string; startTime: string; endTime: string | null }>(
  items: T[],
  itemId: string,
  oldStart: string,
  newStart: string,
): ProgramShiftPlan | null {
  const minutes = startShift(oldStart, newStart);
  if (minutes === 0) return null;
  const from = toMinutes(oldStart);
  const following = sortProgramItems(items).filter((item) => item.id !== itemId && toMinutes(item.startTime) > from);
  if (following.length === 0) return null;
  return { minutes, itemIds: following.map((item) => item.id), outOfDay: following.some((item) => shiftedTimes(item, minutes) === null) };
}

export type ProgramVariant = "couple" | "vendors";

// Lot 63b (CHR-08 ; Q44) — ce que lisent les mariés : jamais une séquence cachée d'eux.
export function clientProgramItems<T extends { hiddenFromClients?: boolean }>(items: T[]): T[] {
  return items.filter((item) => item.hiddenFromClients !== true);
}

// Variante « mariés » : jamais de note interne (PRD PRD-EVT-05, PRD-EVT-06), ni (lot 63b) de séquence
// cachée des mariés.
export function programForVariant<T extends { internalNote: string | null; hiddenFromClients?: boolean }>(items: T[], variant: ProgramVariant): T[] {
  return variant === "couple" ? clientProgramItems(items).map((item) => ({ ...item, internalNote: null })) : items;
}

// Lot 37b (CHR-07, DAT-14 ; D8) — la copie diffusée d'un programme : ses séquences dans l'ordre du
// jour, sans note interne ni identifiant d'évènement.
export function publishedProgramItems(items: ProgramItem[]): PublishedProgramItem[] {
  return sortProgramItems(items).map((item) => ({
    id: item.id,
    startTime: item.startTime,
    endTime: item.endTime,
    label: item.label,
    location: item.location,
    responsible: item.responsible,
    participants: item.participants.map((participant) => ({ vendorSlotId: participant.vendorSlotId, label: participant.label })),
    hiddenFromClients: item.hiddenFromClients,
  }));
}

// Ce qu'un tiers lit d'une séquence, dans un ordre fixe (le jsonb de la base ne garde pas l'ordre
// des clés).
function readableKey(item: PublishedProgramItem): string {
  return JSON.stringify([item.startTime, item.endTime, item.label, item.location, item.responsible, item.participants.map((participant) => [participant.vendorSlotId, participant.label]), item.hiddenFromClients === true]);
}

// Ce qui a changé depuis la dernière version diffusée (null : rien n'est encore diffusé).
export function programChanges(published: PublishedProgramItem[] | null, current: PublishedProgramItem[]): ProgramChanges {
  const before = new Map((published ?? []).map((item) => [item.id, item]));
  const now = new Set(current.map((item) => item.id));
  return {
    added: current.filter((item) => !before.has(item.id)).map((item) => item.label),
    changed: current.filter((item) => before.has(item.id) && readableKey(before.get(item.id)!) !== readableKey(item)).map((item) => item.label),
    removed: (published ?? []).filter((item) => !now.has(item.id)).map((item) => item.label),
  };
}

export function hasProgramChanges(changes: ProgramChanges): boolean {
  return changes.added.length + changes.changed.length + changes.removed.length > 0;
}

// Lot 37b (D9) — ce qu'un prestataire lit d'une version diffusée : ses séquences en entier, sans
// autre intervenant (lot 26b), et le déroulé du jour en titres et horaires seulement.
export function vendorProgramOf(items: PublishedProgramItem[], vendorSlotId: string): Pick<VendorProgramView, "ownItems" | "outline"> {
  const isOwn = (item: PublishedProgramItem) => item.participants.some((participant) => participant.vendorSlotId === vendorSlotId);
  const sorted = sortProgramItems(items);
  return {
    ownItems: sorted.filter(isOwn).map((item) => ({ id: item.id, startTime: item.startTime, endTime: item.endTime, label: item.label, location: item.location, responsible: item.responsible })),
    // Lot 63b (Q44) : une séquence cachée des mariés n'apparaît qu'aux prestataires qu'elle concerne.
    outline: sorted.filter((item) => item.hiddenFromClients !== true || isOwn(item)).map((item) => ({ id: item.id, startTime: item.startTime, endTime: item.endTime, label: item.label, own: isOwn(item) })),
  };
}
