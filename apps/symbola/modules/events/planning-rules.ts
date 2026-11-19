// Lot 53 (CHR-10, CHR-05 ; D6 ; ADR 0095) — règles pures des tâches récurrentes et de la santé du planning,
// sans base. Dates « AAAA-MM-JJ », jours calendaires.
import type { TaskRecurrence } from "@symbola/db/schema/events";

function shiftMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  // Le 31 d'un mois de 30 jours (ou février) devient le dernier jour du mois.
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.toISOString().slice(0, 10);
}

// L'occurrence suivante d'une tâche qui se répète (D6).
export function nextOccurrence(dueDate: string, recurrence: TaskRecurrence): string {
  if (recurrence === "weekly") {
    const date = new Date(`${dueDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 7);
    return date.toISOString().slice(0, 10);
  }
  return shiftMonths(dueDate, recurrence === "monthly" ? 1 : recurrence === "quarterly" ? 3 : 12);
}

// La suivante se crée quand celle-ci est faite, ou à sa date (une seule fois).
export function shouldSpawnNext(task: { recurrence: TaskRecurrence | null; recurrenceSpawnedAt: Date | null; doneAt: Date | null; dueDate: string }, today: string): boolean {
  return task.recurrence !== null && task.recurrenceSpawnedAt === null && (task.doneAt !== null || task.dueDate <= today);
}

export type HealthThresholds = { watchPoints: number; latePoints: number; milestoneWeight: number };
export type HealthState = "good" | "watch" | "late";
export type HealthContributor = { taskId: string; label: string; dueDate: string; daysLate: number; isMilestone: boolean; points: number };
export type PlanningHealth = { state: HealthState; points: number; thresholds: HealthThresholds; contributors: HealthContributor[] };

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

// CHR-05 : l'indicateur s'explique — il liste les tâches qui le dégradent, jalons d'abord, les plus en
// retard ensuite. Une tâche en retard compte un point, un jalon en retard milestoneWeight points.
export function planningHealth(tasks: { id: string; label: string; dueDate: string; done: boolean; isMilestone: boolean }[], today: string, thresholds: HealthThresholds): PlanningHealth {
  const contributors = tasks
    .filter((task) => !task.done && task.dueDate < today)
    .map((task) => ({ taskId: task.id, label: task.label, dueDate: task.dueDate, daysLate: daysBetween(task.dueDate, today), isMilestone: task.isMilestone, points: task.isMilestone ? thresholds.milestoneWeight : 1 }))
    .sort((a, b) => Number(b.isMilestone) - Number(a.isMilestone) || b.daysLate - a.daysLate || a.label.localeCompare(b.label));
  const points = contributors.reduce((total, contributor) => total + contributor.points, 0);
  const state: HealthState = points >= thresholds.latePoints ? "late" : points >= thresholds.watchPoints ? "watch" : "good";
  return { state, points, thresholds, contributors };
}
