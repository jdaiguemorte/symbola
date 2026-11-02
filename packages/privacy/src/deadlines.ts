// RGPD-04 — échéances légales d'une demande d'exercice de droits (RGPD
// art. 12.3) : un mois à compter de la réception, prolongeable de deux mois
// (trois mois au total) pour une demande complexe. Dates sans heure
// (« AAAA-MM-JJ », CLAUDE.md §5), jour de Paris ; fonctions pures, testées
// avec une horloge simulée.

function parts(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return [year, month, day];
}

function iso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Mois calendaires ajoutés ; un jour qui n'existe pas dans le mois d'arrivée
// est ramené au dernier jour du mois (31 janvier + 1 mois = 28 ou 29 février).
export function addMonths(date: string, months: number): string {
  const [year, month, day] = parts(date);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return iso(targetYear, targetMonth, Math.min(day, lastDay));
}

export const LEGAL_RESPONSE_MONTHS = 1;
export const EXTENDED_RESPONSE_MONTHS = 3;

export function requestDueDate(receivedOn: string, extended: boolean): string {
  return addMonths(receivedOn, extended ? EXTENDED_RESPONSE_MONTHS : LEGAL_RESPONSE_MONTHS);
}

// Jours entre deux dates (positif si `to` est après `from`).
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

// Jour de Paris d'un instant : la date de réception par défaut, et « aujourd'hui ».
export function parisDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

// « Échéance à moins de N jours » : en alerte quand il reste moins de N jours
// (ou que l'échéance est passée).
export function isDueSoon(today: string, dueOn: string, alertDays: number): boolean {
  return daysBetween(today, dueOn) < alertDays;
}
