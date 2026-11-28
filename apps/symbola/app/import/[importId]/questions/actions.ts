"use server";

// Lot 71c (HUB-14, UX-10 ; spécification du lot 71, § 5.3) — « Continuer » de l'étape « Questions ».
// Session, organisation et rôle contrôlés ici ; l'import, le mariage visé, le type et la source le sont
// par les services (un identifiant d'une autre organisation répond comme un identifiant inconnu,
// SEC-13). Les réponses données sont gardées même s'il en manque : la planner ne recommence rien.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getPlannerAuthContext } from "@/lib/auth-context";
import type { MissingAnswer } from "@/lib/import/question-rules";
import { ImportTargetEventNotFoundError, saveQuestionAnswers } from "@/lib/import/questions";
import { getImportWizard, importStepHref } from "@/lib/import/wizard";
import { ImportAnswersInvalidError } from "@/modules/hub/service";
import { isValidId } from "../../access";
import { answersFromForm } from "./answers-from-form";

export type QuestionsFormState = { missing: MissingAnswer[]; error?: string };

export async function saveQuestionsAction(_previous: QuestionsFormState, formData: FormData): Promise<QuestionsFormState> {
  const t = await getTranslations("Import");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { missing: [], error: t("unauthenticated") };
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return { missing: [], error: t("importNotFound") };
  const organizationId = auth.user.organizationId;
  try {
    if (!(await saveQuestionAnswers(organizationId, importId, answersFromForm(formData)))) return { missing: [], error: t("importNotFound") };
  } catch (error) {
    // Un mariage, un type ou une source d'une autre organisation : la même réponse qu'un inconnu.
    if (error instanceof ImportTargetEventNotFoundError || error instanceof ImportAnswersInvalidError) return { missing: [{ key: "targetEvent", code: "choose" }] };
    throw error;
  }
  const wizard = await getImportWizard(organizationId, importId);
  if (!wizard) return { missing: [], error: t("importNotFound") };
  const missing = wizard.questions?.missing ?? [];
  if (missing.length > 0) return { missing };
  revalidatePath(`/import/${importId}`);
  redirect(importStepHref(importId, wizard.next));
}
