// Lot 74b (B7, L74-D2) — lecture des réponses de l'étape « Les échéances déjà passées » de « Nouvel évènement » :
// une par tâche du modèle (« pastDue:<identifiant> », « done » ou « todo ») et la répartition des tâches à faire
// (« pastDueSpread », 4 semaines si l'étape n'a pas eu lieu). Null si la saisie ne se lit pas (Zod).
import { DEFAULT_PAST_DUE_SPREAD, pastDueAnswersSchema, type PastDueAnswers } from "@symbola/contracts";

export function readPastDueAnswers(formData: FormData): PastDueAnswers | null {
  const answers: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) if (key.startsWith("pastDue:")) answers[key.slice("pastDue:".length)] = value;
  const parsed = pastDueAnswersSchema.safeParse({ spread: formData.get("pastDueSpread") ?? DEFAULT_PAST_DUE_SPREAD, answers });
  return parsed.success ? parsed.data : null;
}
