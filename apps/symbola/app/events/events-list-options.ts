// Lot 13 (L13-EVT-18) — options de la liste des événements : années proposées
// au filtre (celles des événements, plus l'année en cours et la suivante :
// jamais 1 ni −1) et effectifs des onglets.
import type { EventStatus } from "@/modules/events/service";

export const UPCOMING_STATUSES: EventStatus[] = ["prospect", "quote_sent", "confirmed"];
export const PAST_STATUSES: EventStatus[] = ["done", "lost"];

export function yearOptions(eventDates: (string | null)[], today: string): number[] {
  const current = Number(today.slice(0, 4));
  const years = new Set<number>([current, current + 1]);
  for (const date of eventDates) if (date) years.add(Number(date.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

export function tabCounts(statuses: EventStatus[]): { upcoming: number; past: number } {
  return {
    upcoming: statuses.filter((status) => UPCOMING_STATUSES.includes(status)).length,
    past: statuses.filter((status) => PAST_STATUSES.includes(status)).length,
  };
}

// Une année hors des options (saisie à la main dans l'adresse) est ignorée.
export function parseYear(value: string | undefined, options: number[]): number | undefined {
  const year = Number(value);
  return Number.isInteger(year) && options.includes(year) ? year : undefined;
}
