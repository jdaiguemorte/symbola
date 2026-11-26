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
  // Lot 70a (CHR-02 ; A3) : la personne qui s'en charge ; absente, la personne qui la crée.
  assigneeUserId: z.string().optional(),
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

// —— Lot 70a (CHR-02, UX-06, CHR-05 ; A19, Q47-4 ; ADR 0117, ADR 0118) ——————————————————————————

// L'état d'échéance d'une tâche à faire, le même partout (ligne, accueil, téléphone) : en retard (avant
// aujourd'hui), aujourd'hui, demain, bientôt (jusqu'au seuil de l'organisation), plus tard. Pas d'état
// « En cours » (Q47-4) ; une tâche faite n'a pas d'état d'échéance (null).
export const TASK_DUE_STATES = ["late", "today", "tomorrow", "soon", "later"] as const;
export type TaskDueStateKind = (typeof TASK_DUE_STATES)[number];
export type TaskDueState =
  | { kind: "late"; days: number }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "soon"; days: number }
  | { kind: "later"; days: number };

// Seuil de « Bientôt », en jours (M10) ; réglable par organisation, 7 au départ (planning-health.json).
export const taskSoonDaysSchema = z.number().int().min(1).max(30);

// Une tâche confiée à un membre de l'équipe (A19). Aucun libellé ni nom (SEC-20) : des identifiants.
// batch : la tâche fait partie d'une action en lot (« Confier à… » sur plusieurs tâches) ; le consommateur
// en fait une seule notification par destinataire (« 3 tâches vous ont été confiées »).
export const EVT_TASK_ASSIGNED = "events.task.assigned";
export const EVT_TASK_ASSIGNED_VERSION = 1;

export const taskAssignedPayloadSchema = z.object({
  taskId: z.string().uuid(),
  eventId: z.string().uuid().nullable(),
  assigneeUserId: z.string().uuid(),
  assignedByUserId: z.string().uuid(),
  batch: z.object({ id: z.string().uuid(), count: z.number().int().min(1).max(500) }).optional(),
});

export type TaskAssignedPayload = z.infer<typeof taskAssignedPayloadSchema>;
