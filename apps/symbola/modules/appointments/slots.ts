// Lot 46 (RDV-02 ; D4, D6) — calcul pur des créneaux libres d'un type de rendez-vous : les plages
// hebdomadaires de la personne qui reçoit (heures murales de son fuseau, heure d'été comprise), moins
// les jours fermés, les jours bloqués (jours d'évènement, D6) et les plages occupées (rendez-vous
// déjà pris avec leurs marges, agendas extérieurs). Un créneau n'est proposé que si le rendez-vous,
// marges comprises, ne touche aucune plage occupée ; après le délai de prévenance ; jusqu'à
// l'horizon. Sans base ni horloge : tout arrive en paramètre.
import { wallTimeToInstant } from "@/lib/calendar/ics";

export type Range = { start: Date; end: Date };
export type WeeklyRule = { weekday: number; startTime: string; endTime: string };
export type ClosedDays = { startsOn: string; endsOn: string };

export type SlotInput = {
  now: Date;
  timeZone: string;
  rules: WeeklyRule[];
  closures: ClosedDays[];
  // Jours (AAAA-MM-JJ, dans le fuseau) sans aucun créneau : jours d'évènement (D6).
  blockedDays: string[];
  busy: Range[];
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  horizonDays: number;
};

const MINUTE = 60_000;

export function overlaps(a: Range, b: Range): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

// Le rendez-vous et ses marges.
export function paddedRange(start: Date, durationMinutes: number, bufferBeforeMinutes: number, bufferAfterMinutes: number): Range {
  return {
    start: new Date(start.getTime() - bufferBeforeMinutes * MINUTE),
    end: new Date(start.getTime() + (durationMinutes + bufferAfterMinutes) * MINUTE),
  };
}

// Pas des créneaux : le quart d'heure pour un rendez-vous court, la demi-heure au-delà.
export function slotStep(durationMinutes: number): number {
  return durationMinutes < 30 ? 15 : 30;
}

// Date du jour (AAAA-MM-JJ) dans le fuseau.
export function zonedDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// 1 = lundi … 7 = dimanche.
export function isoWeekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function isClosed(date: string, closures: ClosedDays[]): boolean {
  return closures.some((closure) => closure.startsOn <= date && date <= closure.endsOn);
}

// « 09:00:00 » (colonne time) ou « 09:00 ».
function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function computeSlots(input: SlotInput): Date[] {
  const step = slotStep(input.durationMinutes) * MINUTE;
  const earliest = input.now.getTime() + input.minNoticeMinutes * MINUTE;
  const today = zonedDate(input.now, input.timeZone);
  const blocked = new Set(input.blockedDays);
  const busy = [...input.busy].sort((a, b) => a.start.getTime() - b.start.getTime());
  const slots = new Set<number>();
  for (let offset = 0; offset <= input.horizonDays; offset++) {
    const date = addDays(today, offset);
    if (blocked.has(date) || isClosed(date, input.closures)) continue;
    const weekday = isoWeekday(date);
    for (const rule of input.rules) {
      if (rule.weekday !== weekday) continue;
      const ruleStart = wallTimeToInstant(date, hhmm(rule.startTime), input.timeZone).getTime();
      const ruleEnd = wallTimeToInstant(date, hhmm(rule.endTime), input.timeZone).getTime();
      for (let start = ruleStart; start + input.durationMinutes * MINUTE <= ruleEnd; start += step) {
        if (start < earliest) continue;
        const padded = paddedRange(new Date(start), input.durationMinutes, input.bufferBeforeMinutes, input.bufferAfterMinutes);
        if (busy.some((range) => overlaps(padded, range))) continue;
        slots.add(start);
      }
    }
  }
  return [...slots].sort((a, b) => a - b).map((time) => new Date(time));
}

// Un instant proposé tel qu'il arrive d'un formulaire : est-il l'un des créneaux libres ?
export function isFreeSlot(input: SlotInput, start: Date): boolean {
  return computeSlots(input).some((slot) => slot.getTime() === start.getTime());
}

// Les créneaux voisins d'un créneau pris entre-temps : les plus proches, au plus `count`.
export function nearestSlots(slots: Date[], wanted: Date, count = 3): Date[] {
  return [...slots].sort((a, b) => Math.abs(a.getTime() - wanted.getTime()) - Math.abs(b.getTime() - wanted.getTime()) || a.getTime() - b.getTime()).slice(0, count).sort((a, b) => a.getTime() - b.getTime());
}
