// Lot 51 (EVT-04, JRJ-05, JRJ-08, PAR-08 ; D1, D4, ADR 0091) — règles pures du jour J de terrain.
// Sans dépendance au navigateur ni au serveur : elles tournent sur le téléphone, même sans réseau,
// et sur le serveur (bilan, contrôle d'un décalage reçu). Les heures du programme sont celles de
// l'horloge murale du jour d'un temps fort, dans le fuseau de l'évènement ; un pointage est un
// instant (heure de l'appareil).
import { MINUTES_PER_DAY, clock, toMinutes } from "@/lib/program-spans";
import type { DayCheckpointKind, DayItemActual } from "@symbola/contracts";

function zonedParts(instant: Date, timeZone: string): { date: string; minutes: number; seconds: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "0";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, minutes: Number(part("hour")) * 60 + Number(part("minute")), seconds: Number(part("second")) };
}

// Le jour (« AAAA-MM-JJ ») d'un instant dans le fuseau.
export function zonedDate(instant: Date, timeZone: string): string {
  return zonedParts(instant, timeZone).date;
}

function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Décalage du fuseau à un instant, en minutes (Paris l'été : +120).
function offsetMinutes(instant: Date, timeZone: string): number {
  const local = zonedParts(instant, timeZone);
  const asUtc = (dayNumber(local.date) * MINUTES_PER_DAY + local.minutes) * 60_000 + local.seconds * 1000;
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

// L'instant d'une heure murale d'un jour, dans un fuseau. Une heure qui n'existe pas (saut du
// printemps) donne l'heure qui suit le saut ; une heure qui existe deux fois (automne), la première.
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const wall = (dayNumber(date) * MINUTES_PER_DAY + toMinutes(time)) * 60_000;
  const candidates = new Set<number>();
  for (const probe of [wall - 14 * 3_600_000, wall, wall + 14 * 3_600_000]) candidates.add(wall - offsetMinutes(new Date(probe), timeZone) * 60_000);
  const exact = [...candidates].filter((instant) => instant + offsetMinutes(new Date(instant), timeZone) * 60_000 === wall).sort((a, b) => a - b);
  if (exact.length > 0) return new Date(exact[0]!);
  // Dans le saut : l'heure murale avec le décalage d'avant le saut tombe juste après lui.
  const before = offsetMinutes(new Date(wall - 12 * 3_600_000), timeZone);
  return new Date(wall - before * 60_000);
}

export type PlannedTimes = { startTime: string; endTime: string | null };

// Début et fin prévus d'une séquence : une fin plus petite que le début passe minuit.
export function plannedInstants(item: PlannedTimes, date: string, timeZone: string): { start: Date; end: Date | null } {
  const start = zonedInstant(date, item.startTime, timeZone);
  if (item.endTime === null) return { start, end: null };
  const endDate = toMinutes(item.endTime) <= toMinutes(item.startTime) ? addDays(date, 1) : date;
  return { start, end: zonedInstant(endDate, item.endTime, timeZone) };
}

// —— Pointages (JRJ-08) ———————————————————————————————————————————————————————————————————

export type CheckpointLike = { id: string; itemId: string; kind: DayCheckpointKind; deviceAt: string; userId: string };

// Chaque pointage reste ; l'écran retient le premier de chaque nature (heure de l'appareil, puis
// identifiant pour départager la même seconde).
export function itemActuals(checkpoints: CheckpointLike[]): DayItemActual[] {
  const sorted = [...checkpoints].sort((a, b) => Date.parse(a.deviceAt) - Date.parse(b.deviceAt) || a.id.localeCompare(b.id));
  const byItem = new Map<string, DayItemActual>();
  for (const checkpoint of sorted) {
    const actual = byItem.get(checkpoint.itemId) ?? { itemId: checkpoint.itemId, startedAt: null, startedBy: null, finishedAt: null, finishedBy: null, count: 0 };
    actual.count += 1;
    const at = new Date(checkpoint.deviceAt).toISOString();
    if (checkpoint.kind === "started" && actual.startedAt === null) Object.assign(actual, { startedAt: at, startedBy: checkpoint.userId });
    if (checkpoint.kind === "finished" && actual.finishedAt === null) Object.assign(actual, { finishedAt: at, finishedBy: checkpoint.userId });
    byItem.set(checkpoint.itemId, actual);
  }
  return [...byItem.values()];
}

// —— Retard et décalage (JRJ-05) ——————————————————————————————————————————————————————————

export type ShiftableItem = { id: string; keyMomentId: string | null; startTime: string; endTime: string | null; vendorSlotIds: string[] };

export type DayShiftProposal = { minutes: number; itemIds: string[]; vendorSlotIds: string[] };

// Un décalage d'une demi-journée au plus (comme le décalage de la fiche, lot 30b).
export const DAY_SHIFT_MAX_MINUTES = 720;

function sortedByStart<T extends { startTime: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

// Prestataires concernés : les postes des séquences décalées, dans l'ordre du programme, sans doublon.
export function concernedVendorSlots(items: ShiftableItem[], itemIds: string[]): string[] {
  const chosen = new Set(itemIds);
  const slots: string[] = [];
  for (const item of sortedByStart(items)) {
    if (!chosen.has(item.id)) continue;
    for (const slot of item.vendorSlotIds) if (!slots.includes(slot)) slots.push(slot);
  }
  return slots;
}

// Une séquence commencée (ou finie) plus tard que prévu, d'au moins le seuil : décaler de ce retard
// la suite de son temps fort. Commencée en retard, la séquence elle-même se décale aussi (sa fin
// suit) ; finie en retard, seulement ce qui suit. Toutes les suivantes par défaut : la planner décoche
// celles qui sont fixes, puis valide ou refuse.
export function proposeDayShift(input: {
  items: ShiftableItem[];
  lateItemId: string;
  checkpoint: DayCheckpointKind;
  actualAt: Date;
  momentDate: string;
  timeZone: string;
  thresholdMinutes: number;
}): DayShiftProposal | null {
  const late = input.items.find((item) => item.id === input.lateItemId);
  if (!late) return null;
  const planned = plannedInstants(late, input.momentDate, input.timeZone);
  const reference = input.checkpoint === "started" ? planned.start : planned.end;
  if (!reference) return null;
  const minutes = Math.floor((input.actualAt.getTime() - reference.getTime()) / 60_000);
  if (minutes < Math.max(1, input.thresholdMinutes) || minutes > DAY_SHIFT_MAX_MINUTES) return null;
  const lateStart = toMinutes(late.startTime);
  const following = sortedByStart(input.items.filter((item) => item.id !== late.id && item.keyMomentId === late.keyMomentId && toMinutes(item.startTime) > lateStart));
  const itemIds = [...(input.checkpoint === "started" ? [late.id] : []), ...following.map((item) => item.id)];
  if (itemIds.length === 0) return null;
  return { minutes, itemIds, vendorSlotIds: concernedVendorSlots(input.items, itemIds) };
}

// L'heure prévue avant les décalages appliqués (pour le bilan) : on retire chacun d'eux.
export function originalTimes(item: { id: string } & PlannedTimes, shifts: { itemIds: string[]; minutes: number; outcome: string | null }[]): PlannedTimes {
  const total = shifts.filter((shift) => shift.outcome === "applied" && shift.itemIds.includes(item.id)).reduce((sum, shift) => sum + shift.minutes, 0);
  if (total === 0) return { startTime: item.startTime, endTime: item.endTime };
  return { startTime: clock(toMinutes(item.startTime) - total), endTime: item.endTime === null ? null : clock(toMinutes(item.endTime) - total) };
}

// —— Jours de l'évènement (EVT-04) ——————————————————————————————————————————————————————————

export function eventDays(moments: { date: string }[], eventDate: string | null): string[] {
  return [...new Set([...moments.map((moment) => moment.date), ...(eventDate ? [eventDate] : [])])].sort();
}

// Le jour en cours ; sinon le prochain ; sinon le dernier.
export function openingDay(days: string[], today: string): string | null {
  if (days.length === 0) return null;
  if (days.includes(today)) return today;
  return days.find((day) => day > today) ?? days[days.length - 1]!;
}

// —— Bilan du lendemain (PAR-08, étape 7) ——————————————————————————————————————————————————

export function reportReadyOn(lastDay: string): string {
  return addDays(lastDay, 1);
}

export function isReportReady(lastDay: string, timeZone: string, now: Date): boolean {
  return zonedDate(now, timeZone) >= reportReadyOn(lastDay);
}
