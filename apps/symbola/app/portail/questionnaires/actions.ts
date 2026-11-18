"use server";

// Lot 45 (POR-07, CRM-09 ; D7 ; ADR 0090) — réponses d'un questionnaire depuis le lien personnel :
// chaque réponse est enregistrée aussitôt (reprise possible) ; « Terminer » prévient la planner et
// préremplit l'évènement. L'accès est relu à chaque requête (lien valable, rubrique ouverte, module
// ouvert) ; l'évènement et le lien sont toujours ceux de la session, jamais ceux du formulaire.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { AnswerInvalidError, answerQuestionnaireOfLink, finishQuestionnaireOfLink, QuestionnaireClosedError, QuestionnaireNotFoundError } from "@/modules/events/service";
import { isValidId } from "@/app/events/module-access";
import { portalQuestionnairesAccess } from "./access";

export type AnswerResult = { ok: true } | { ok: false; error: string };

const answerSchema = z.object({ questionnaireId: z.string(), key: z.string().max(60), value: z.union([z.string().max(6000), z.array(z.string().max(200)).max(40), z.null()]) });

async function failure(error: unknown): Promise<AnswerResult> {
  const t = await getTranslations("PortalQuestionnaires");
  if (error instanceof AnswerInvalidError) return { ok: false, error: t(`invalid.${error.reason}`) };
  if (error instanceof QuestionnaireClosedError) return { ok: false, error: t("closed") };
  if (error instanceof QuestionnaireNotFoundError) return { ok: false, error: t("denied") };
  throw error;
}

export async function saveAnswerAction(raw: unknown): Promise<AnswerResult> {
  const t = await getTranslations("PortalQuestionnaires");
  const access = await portalQuestionnairesAccess();
  const parsed = answerSchema.safeParse(raw);
  if (!access || !parsed.success || !isValidId(parsed.data.questionnaireId)) return { ok: false, error: t("denied") };
  try {
    await answerQuestionnaireOfLink(access, parsed.data.questionnaireId, parsed.data.key, parsed.data.value);
  } catch (error) {
    return failure(error);
  }
  return { ok: true };
}

export async function finishQuestionnaireAction(questionnaireId: string): Promise<AnswerResult> {
  const t = await getTranslations("PortalQuestionnaires");
  const access = await portalQuestionnairesAccess();
  if (!access || !isValidId(questionnaireId)) return { ok: false, error: t("denied") };
  try {
    await finishQuestionnaireOfLink(access, questionnaireId);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/portail/questionnaires");
  return { ok: true };
}
