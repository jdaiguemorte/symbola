// Lot 32b (EVT-07, CRM-04, CHR-03 ; décisions D10 et D11) — calculs du portefeuille, purs : la
// charge par mois, les évènements d'un même jour, la grille d'un mois. Les dates sont des dates
// civiles (AAAA-MM-JJ) : aucun fuseau n'entre en jeu.
import { addMonths } from "@/app/agenda/calendar";

type PortfolioStatus = "prospect" | "quote_sent" | "confirmed" | "done" | "lost";
export type PortfolioEvent = { id: string; eventDate: string | null; status: PortfolioStatus; isDemo: boolean };

const CONFIRMED: PortfolioStatus[] = ["confirmed", "done"];
// Une « option » : une date posée sur un prospect ou un devis envoyé (cahier des charges, CRM-04).
const OPTIONS: PortfolioStatus[] = ["prospect", "quote_sent"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function counts(event: PortfolioEvent): boolean {
  return !event.isDemo && event.eventDate !== null && (CONFIRMED.includes(event.status) || OPTIONS.includes(event.status));
}

export type MonthLoad = { month: string; confirmed: number; options: number };

// EVT-07 : charge par mois, du mois de départ sur `months` mois.
export function monthlyLoad(events: PortfolioEvent[], startMonth: string, months = 12): MonthLoad[] {
  const load = Array.from({ length: months }, (_, index) => ({ month: addMonths(startMonth, index), confirmed: 0, options: 0 }));
  const byMonth = new Map(load.map((entry) => [entry.month, entry]));
  for (const event of events) {
    if (!counts(event)) continue;
    const entry = byMonth.get(event.eventDate!.slice(0, 7));
    if (!entry) continue;
    if (CONFIRMED.includes(event.status)) entry.confirmed += 1;
    else entry.options += 1;
  }
  return load;
}

// CRM-04 : les confirmés et les options d'une date, sans l'évènement en cours de saisie.
export function sameDayEvents<T extends PortfolioEvent>(events: T[], date: string, excludeEventId?: string): T[] {
  if (!DATE.test(date)) return [];
  return events.filter((event) => counts(event) && event.status !== "done" && event.eventDate === date && event.id !== excludeEventId);
}

// EVT-07 : les dates partagées par deux évènements en cours au moins (identifiants, dans l'ordre).
export function sharedDates(events: PortfolioEvent[]): Map<string, string[]> {
  const byDate = new Map<string, string[]>();
  for (const event of events) {
    if (!counts(event) || event.status === "done") continue;
    byDate.set(event.eventDate!, [...(byDate.get(event.eventDate!) ?? []), event.id]);
  }
  return new Map([...byDate].filter(([, ids]) => ids.length >= 2));
}

export type DayCell = { date: string; day: number; weekend: boolean };

// CHR-03 : la grille d'un mois (« AAAA-MM »), du lundi au dimanche, cases vides avant le 1er.
export function monthGrid(month: string): (DayCell | null)[] {
  const [year, value] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(year, value - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, value, 0)).getUTCDate();
  const cells: (DayCell | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) {
    const date = new Date(Date.UTC(year, value - 1, day));
    cells.push({ date: date.toISOString().slice(0, 10), day, weekend: (date.getUTCDay() + 6) % 7 >= 5 });
  }
  return cells;
}
