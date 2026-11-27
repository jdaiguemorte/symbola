// Lot 71c (HUB-14) — pour les tests écrits avant l'étape « Questions » : répondre à ce qu'elle demande,
// sans changer ce que ces tests vérifient. Les réponses données l'emportent ; les autres reprennent la
// règle d'avant le lot (acomptes dus, contrats non signés, échéances gardées, fiche « Signé »).
import type { ImportAnswers } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { confirmImport } from "@/lib/import/apply";
import { getImportQuestions, saveQuestionAnswers } from "@/lib/import/questions";
import { getImportAnswers } from "@/modules/hub/service";

export async function answerImportQuestions(organizationId: string, importId: string, given: ImportAnswers = {}, now: Date = new Date()): Promise<ImportAnswers> {
  const view = await getImportQuestions(organizationId, importId, { now });
  // Import inconnu, d'une autre organisation ou déjà écrit : confirmImport répondra.
  if (!view) return given;
  const answers: ImportAnswers = { ...((await getImportAnswers(appDatabase(), organizationId, importId)) ?? {}), ...given };
  if (view.asked.depositsPaid && !answers.depositsPaid) answers.depositsPaid = { answer: "no" };
  if (view.asked.contracts && !answers.contracts) answers.contracts = { answer: "none" };
  if (view.asked.eventStage && !answers.eventStage) answers.eventStage = "signed";
  if (view.asked.eventType && !answers.eventTypeId) answers.eventTypeId = view.eventType!.options[0]!.id;
  if (view.asked.pastDueTasks && !answers.pastDueTasks) answers.pastDueTasks = { answer: "keep" };
  if (Object.keys(answers).length > 0 && !(await saveQuestionAnswers(organizationId, importId, answers))) throw new Error("réponses refusées");
  return answers;
}

// confirmImport, après avoir répondu à ce que l'étape « Questions » demande encore.
export async function confirmWithAnswers(input: Parameters<typeof confirmImport>[0] & { answers?: ImportAnswers }): Promise<Awaited<ReturnType<typeof confirmImport>>> {
  const { answers, ...confirm } = input;
  await answerImportQuestions(input.organizationId, input.importId, answers ?? {}, input.now ?? new Date());
  return confirmImport(confirm);
}
