// EVT-04 — arithmétique des dates sans heure (« AAAA-MM-JJ », CLAUDE.md
// §5). Calcul en UTC : un jour civil vaut toujours 24 h, donc aucun
// décalage au passage à l'heure d'été ou d'hiver.
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMs(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`date invalide : ${date}`);
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const ms = Date.UTC(year, month - 1, day);
  // Refuse « 2027-02-30 », que Date.UTC ramènerait au 2 mars.
  if (new Date(ms).toISOString().slice(0, 10) !== date) throw new RangeError(`date invalide : ${date}`);
  return ms;
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

// Échéance d'une tâche de modèle : date de l'événement + décalage (J-365 = -365).
export function dueDateFor(eventDate: string, offsetDays: number): string {
  return addDays(eventDate, offsetDays);
}

// Regroupement de la vue par mois (« AAAA-MM »).
export function monthKey(date: string): string {
  toUtcMs(date);
  return date.slice(0, 7);
}
