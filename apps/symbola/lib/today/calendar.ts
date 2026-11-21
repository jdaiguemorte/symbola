// Lot 63d (HUB-08, BUD-03, BUD-11, CHR-03 ; recette du 21/11/2026, maquette M3) — le calendrier du mois
// d'« Aujourd'hui », sans rendu : les évènements, les rendez-vous, les tâches (de la couleur de leur
// catégorie) et les échéances de paiement non réglées, chacun à sa date, du lundi au dimanche. Sur
// téléphone, la semaine en cours en liste. Les instants (rendez-vous) se rangent au jour de Paris.
import { parisToday } from "@symbola/i18n";

export type CalendarItemKind = "event" | "appointment" | "payment" | "task";

export type CalendarItem = {
  key: string;
  kind: CalendarItemKind;
  date: string;
  label: string;
  // Ce qui précise la ligne dans le détail du jour (évènement de la tâche, montant…).
  detail: string | null;
  href: string;
  // Couleur de la pastille (catégorie, rendez-vous, paiements) ; nulle : sans couleur (tâche sans
  // catégorie). Un évènement est un pavé plein, sans pastille.
  color: string | null;
  // Nom écrit de la catégorie (toujours lu avec la couleur, jamais la couleur seule).
  categoryLabel: string | null;
  overdue: boolean;
  highPriority: boolean;
  // Heure d'un rendez-vous (« 14:30 »), pour l'ordre et l'affichage.
  time: string | null;
};

export type CalendarDay = { date: string; day: number; weekend: boolean; today: boolean; inMonth: boolean; items: CalendarItem[] };

const ORDER: Record<CalendarItemKind, number> = { event: 0, appointment: 1, payment: 2, task: 3 };

export function isMonthKey(value: string | undefined): value is string {
  return value !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const value = utc(date);
  value.setUTCDate(value.getUTCDate() + days);
  return iso(value);
}

// Le lundi de la semaine qui contient cette date.
export function mondayOf(date: string): string {
  const weekday = (utc(date).getUTCDay() + 6) % 7;
  return addDays(date, -weekday);
}

// Premier et dernier jour du mois (« AAAA-MM »).
export function monthBounds(month: string): { first: string; last: string } {
  const [year, value] = month.split("-").map(Number) as [number, number];
  return { first: `${month}-01`, last: iso(new Date(Date.UTC(year, value, 0))) };
}

// Le jour de Paris d'un instant ISO (un rendez-vous à 0 h 30 à Paris tombe ce jour-là, pas la veille UTC).
export function parisDay(instant: string): string {
  return parisToday(new Date(instant));
}

export function sortItems(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || (a.time ?? "").localeCompare(b.time ?? "") || Number(b.highPriority) - Number(a.highPriority) || a.label.localeCompare(b.label));
}

function byDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
  for (const [date, list] of map) map.set(date, sortItems(list));
  return map;
}

function dayOf(date: string, today: string, month: string | null, items: Map<string, CalendarItem[]>): CalendarDay {
  const value = utc(date);
  return { date, day: value.getUTCDate(), weekend: (value.getUTCDay() + 6) % 7 >= 5, today: date === today, inMonth: month === null || date.startsWith(month), items: items.get(date) ?? [] };
}

// Les semaines entières qui couvrent le mois (du lundi qui précède le 1er au dimanche qui suit le dernier
// jour) ; les jours d'un autre mois sont marqués (« inMonth » faux) et restent vides.
export function monthWeeks(month: string, today: string, items: CalendarItem[]): CalendarDay[][] {
  const { first, last } = monthBounds(month);
  const map = byDate(items.filter((item) => item.date.startsWith(month)));
  const weeks: CalendarDay[][] = [];
  for (let start = mondayOf(first); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => dayOf(addDays(start, index), today, month, map)));
  }
  return weeks;
}

// La semaine en cours (lundi à dimanche), pour le téléphone.
export function currentWeek(today: string, items: CalendarItem[]): CalendarDay[] {
  const start = mondayOf(today);
  const map = byDate(items);
  return Array.from({ length: 7 }, (_, index) => dayOf(addDays(start, index), today, null, map));
}

// Ce que le calendrier doit charger : le mois affiché et, pour le téléphone, la semaine en cours (qui
// peut déborder sur le mois voisin).
export function calendarRange(month: string, today: string): { from: string; until: string } {
  const { first, last } = monthBounds(month);
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  return { from: first < weekStart ? first : weekStart, until: last > weekEnd ? last : weekEnd };
}
