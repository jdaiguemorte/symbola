// DEV-03 — règles pures de l'échéancier d'un devis (testées avec une
// horloge simulée). Montants en centimes entiers, pourcentages en points de
// base ; dates calendaires « YYYY-MM-DD » en heure de Paris.
import { roundHalfUp } from "./amounts";

export type ScheduleAmount = { amountCents: number | null; percentageBasisPoints: number | null };

// Le solde n'est jamais stocké : il se recalcule à chaque lecture, donc il
// suit tout changement du total de la version.
export function resolveSchedule(
  items: ScheduleAmount[],
  totalTtcCents: number,
): { amounts: number[]; balanceCents: number; exceedsTotal: boolean } {
  const amounts = items.map((item) =>
    item.amountCents !== null ? item.amountCents : roundHalfUp(totalTtcCents * (item.percentageBasisPoints ?? 0), 10000),
  );
  const balanceCents = totalTtcCents - amounts.reduce((sum, amount) => sum + amount, 0);
  return { amounts, balanceCents, exceedsTotal: balanceCents < 0 };
}

const PARIS_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function parisToday(now: Date): string {
  return PARIS_DATE.format(now);
}

// En retard à partir du lendemain de l'échéance (le jour même, il est
// encore temps de payer).
export function isOverdue(dueDate: string, now: Date): boolean {
  return dueDate < parisToday(now);
}

export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function groupByMonth(items: { dueDate: string; amountCents: number }[]): { month: string; totalCents: number }[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const month = item.dueDate.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + item.amountCents);
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, totalCents]) => ({ month, totalCents }));
}
