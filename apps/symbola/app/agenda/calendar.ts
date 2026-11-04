// HUB-02 — calcul du calendrier de l'accueil (sans rendu) : mois, cases du
// lundi au dimanche, ton de chaque date et événements du même week-end.
import type { EventStatus } from "@/modules/events/service";

export type CalendarEvent = { id: string; date: string; status: EventStatus; names: string; isDemo: boolean };

// « confirmed » : mariage confirmé ou réalisé (plein) ; « tentative » : date
// posée sur un prospect ou un devis envoyé (atténué).
export type CalendarTone = "confirmed" | "tentative" | "none";

export type CalendarCell = {
  date: string;
  day: number;
  weekend: boolean;
  events: CalendarEvent[];
  tone: CalendarTone;
  // Événements du week-end (samedi + dimanche) qui contient cette date.
  weekendEvents: CalendarEvent[];
  weekendCount: number;
};

export type CalendarMonth = { key: string; cells: (CalendarCell | null)[] };

const CONFIRMED: EventStatus[] = ["confirmed", "done"];
const TENTATIVE: EventStatus[] = ["prospect", "quote_sent"];

export function addMonths(month: string, count: number): string {
  const [year, value] = month.split("-").map(Number) as [number, number];
  const index = year * 12 + (value - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildCalendar(input: { start: string; months: number; events: CalendarEvent[] }): CalendarMonth[] {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of input.events) {
    if (!CONFIRMED.includes(event.status) && !TENTATIVE.includes(event.status)) continue;
    byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  }
  const weekendOf = (date: Date): CalendarEvent[] => {
    const weekday = (date.getUTCDay() + 6) % 7; // lundi = 0
    if (weekday < 5) return [];
    const saturday = new Date(date);
    saturday.setUTCDate(date.getUTCDate() - (weekday - 5));
    const sunday = new Date(saturday);
    sunday.setUTCDate(saturday.getUTCDate() + 1);
    return [...(byDate.get(iso(saturday)) ?? []), ...(byDate.get(iso(sunday)) ?? [])];
  };

  return Array.from({ length: input.months }, (_, offset) => {
    const key = addMonths(input.start, offset);
    const [year, month] = key.split("-").map(Number) as [number, number];
    const first = new Date(Date.UTC(year, month - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells: (CalendarCell | null)[] = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= days; day++) {
      const date = new Date(Date.UTC(year, month - 1, day));
      const dayEvents = byDate.get(iso(date)) ?? [];
      const weekendEvents = weekendOf(date);
      const weekday = (date.getUTCDay() + 6) % 7;
      cells.push({
        date: iso(date),
        day,
        weekend: weekday >= 5,
        events: dayEvents,
        tone: dayEvents.some((event) => CONFIRMED.includes(event.status)) ? "confirmed" : dayEvents.length > 0 ? "tentative" : "none",
        weekendEvents,
        weekendCount: weekendEvents.length,
      });
    }
    return { key, cells };
  });
}
