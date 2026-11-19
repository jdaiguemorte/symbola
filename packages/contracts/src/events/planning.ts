// Lot 53 (CHR-10, CHR-05, HUB-24 ; D6, D8 ; ADR 0095) — tâches hors évènement et récurrentes, santé du
// planning qui s'explique, terme des clients par type d'évènement.
import { z } from "zod";

export const TASK_RECURRENCE_VALUES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type TaskRecurrenceValue = (typeof TASK_RECURRENCE_VALUES)[number];

export type StandaloneTask = {
  id: string;
  label: string;
  dueDate: string;
  recurrence: TaskRecurrenceValue | null;
  done: boolean;
  doneAt: string | null;
};

export const standaloneTaskInputSchema = z.object({
  label: z.string().trim().min(1).max(200),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence: z.enum(TASK_RECURRENCE_VALUES).nullable(),
});
export type StandaloneTaskInput = z.infer<typeof standaloneTaskInputSchema>;

export type PlanningHealthState = "good" | "watch" | "late";
export type PlanningHealthView = {
  state: PlanningHealthState;
  points: number;
  thresholds: { watchPoints: number; latePoints: number; milestoneWeight: number };
  // Les tâches qui le dégradent, jalons d'abord, avec leur retard en jours.
  contributors: { taskId: string; label: string; dueDate: string; daysLate: number; isMilestone: boolean; points: number }[];
};

export const planningHealthThresholdsSchema = z
  .object({ watchPoints: z.number().int().min(1).max(100), latePoints: z.number().int().min(1).max(100), milestoneWeight: z.number().int().min(1).max(10) })
  .refine((value) => value.watchPoints <= value.latePoints, { path: ["latePoints"] });

export const CLIENT_TERM_GENDERS = ["masculine", "feminine", "neuter"] as const;
export const CLIENT_TERM_NUMBERS = ["singular", "plural"] as const;
export type ClientTerm = { term: string; gender: (typeof CLIENT_TERM_GENDERS)[number]; number: (typeof CLIENT_TERM_NUMBERS)[number] };
export const clientTermSchema = z.object({ term: z.string().trim().min(1).max(40), gender: z.enum(CLIENT_TERM_GENDERS), number: z.enum(CLIENT_TERM_NUMBERS) });

// Le terme réglé de chaque type, par langue (null : le vocabulaire du type, mariés ou clients).
export type EventTypeVocabularyView = { eventTypeId: string; label: string; audience: "couple" | "clients"; terms: { fr: ClientTerm | null; en: ClientTerm | null } };
