// Lot 70a (CHR-03 ; § 3.3) — les périodes de la liste des tâches, en dates de début et de fin comprises
// (null : sans borne). Fonctions pures, appliquées ensuite dans la requête (jamais en mémoire). Exposé
// seulement par service.ts (ADR 0011).
import type { TaskListPeriod } from "@symbola/contracts";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: string): Date {
  if (!DAY.test(value)) throw new RangeError("date attendue au format AAAA-MM-JJ");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new RangeError("date invalide");
  return date;
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function plusDays(value: string, days: number): string {
  const date = parseDay(value);
  date.setUTCDate(date.getUTCDate() + days);
  return day(date);
}

export function periodRange(period: TaskListPeriod, today: string): { from: string | null; to: string | null } {
  const now = parseDay(today);
  switch (period.kind) {
    case "late":
      return { from: null, to: plusDays(today, -1) };
    case "week": {
      // Lundi = 1 … dimanche = 7.
      const weekday = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
      return { from: plusDays(today, 1 - weekday), to: plusDays(today, 7 - weekday) };
    }
    case "fortnight":
      return { from: null, to: plusDays(today, 14) };
    case "month": {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
      return { from: day(first), to: day(last) };
    }
    case "between": {
      if (parseDay(period.from) > parseDay(period.to)) throw new RangeError("période inversée");
      return { from: period.from, to: period.to };
    }
  }
}
