// Lot 70a (UX-06, CHR-05, UX-01 ; M10, Q47-4 ; ADR 0117) — l'état d'échéance d'une tâche à faire, calculé
// à un seul endroit et lu par tous les écrans (ligne de « Tâches », fiche, « Aujourd'hui », téléphone) :
// en retard, aujourd'hui, demain, bientôt (jusqu'au seuil réglé par l'organisation), plus tard. Les
// dates sont des jours (« AAAA-MM-JJ ») ; « aujourd'hui » est le jour à Paris : un changement d'heure ne
// fait ni gagner ni perdre un jour. Exposé seulement par service.ts (ADR 0011).
import type { TaskDueState } from "@symbola/contracts";
import { parisToday } from "@symbola/i18n";

// Valeur de départ (planning-health.json, « soonDays ») ; gardée ici pour les écrans qui n'ont pas
// encore lu le réglage de l'organisation.
export const DEFAULT_SOON_DAYS = 7;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(value: string): number {
  if (!DAY.test(value)) throw new RangeError("date attendue au format AAAA-MM-JJ");
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) throw new RangeError("date invalide");
  return Math.round(time / DAY_MS);
}

export function taskDueState(task: { dueDate: string; done: boolean }, today: string, soonDays: number = DEFAULT_SOON_DAYS): TaskDueState | null {
  const days = dayNumber(task.dueDate) - dayNumber(today);
  if (task.done) return null;
  if (days < 0) return { kind: "late", days: -days };
  if (days === 0) return { kind: "today" };
  if (days === 1) return { kind: "tomorrow" };
  if (days <= soonDays) return { kind: "soon", days };
  return { kind: "later", days };
}

// La même chose à un instant donné (horloge simulée des tests, tâche périodique).
export function dueStateAt(task: { dueDate: string; done: boolean }, now: Date, soonDays: number = DEFAULT_SOON_DAYS): TaskDueState | null {
  return taskDueState(task, parisToday(now), soonDays);
}
