// Lot 70b (UX-10 ; P-18, C-04) — les champs obligatoires d'une tâche, contrôlés de la même façon dans
// la fenêtre de la tâche, les formulaires d'ajout et les actions du serveur. Messages : clés du domaine
// « Validation ».
import { z } from "zod";
import { isCalendarDate } from "./field-validation";

export const TASK_LABEL_MAX = 300;

export const dueDateField = z
  .string()
  .trim()
  .min(1, { message: "dueDateRequired" })
  .refine(isCalendarDate, { message: "dateInvalid" });

export const taskFieldsSchema = z.object({
  label: z.string().trim().min(1, { message: "taskLabelRequired" }).max(TASK_LABEL_MAX, { message: "taskLabelTooLong" }),
  dueDate: dueDateField,
});
