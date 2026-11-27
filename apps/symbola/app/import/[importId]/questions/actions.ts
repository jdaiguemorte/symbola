"use server";

// Lot 71c (HUB-14, UX-10 ; spécification du lot 71, § 5.3) — « Continuer » de l'étape « Questions ».
// Session, organisation et rôle contrôlés ici ; l'import, le mariage visé, le type et la source le sont
// par les services (un identifiant d'une autre organisation répond comme un identifiant inconnu,
// SEC-13). Les réponses données sont gardées même s'il en manque : la planner ne recommence rien.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { CONTRACTS_ANSWERS, DEPOSITS_PAID_ANSWERS, EVENT_STAGE_ANSWERS, PAST_DUE_TASKS_ANSWERS, type ImportAnswers } from "@symbola/contracts";
import { getPlannerAuthContext } from "@/lib/auth-context";
import type { MissingAnswer } from "@/lib/import/question-rules";
import { ImportTargetEventNotFoundError, saveQuestionAnswers } from "@/lib/import/questions";
import { getImportWizard, importStepHref } from "@/lib/import/wizard";
import { ImportAnswersInvalidError } from "@/modules/hub/service";
import { isValidId } from "../../access";

export type QuestionsFormState = { missing: MissingAnswer[]; error?: string };

const rowIndexes = z.array(z.coerce.number().int().nonnegative()).max(5000);
const isoDate = z.iso.date();

function oneOf<T extends string>(values: readonly T[], value: FormDataEntryValue | null): T | undefined {
  return values.find((candidate) => candidate === value);
}

function optionalId(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text !== "" && isValidId(text) ? text : undefined;
}

// Le formulaire → les réponses (validées encore par le hub, Zod strict).
export async function answersFromForm(formData: FormData): Promise<ImportAnswers> {
  const answers: ImportAnswers = {};
  const target = formData.get("targetEvent");
  if (target === "new") {
    const date = String(formData.get("newEventDate") ?? "").trim();
    answers.newEvent = { name: String(formData.get("newEventName") ?? "").trim().slice(0, 200), eventDate: isoDate.safeParse(date).success ? date : null };
  } else {
    const id = optionalId(target);
    if (id) answers.targetEvent = id;
  }
  const deposits = oneOf(DEPOSITS_PAID_ANSWERS, formData.get("depositsPaid"));
  if (deposits) {
    const paid = rowIndexes.safeParse(formData.getAll("depositPaidRow"));
    answers.depositsPaid = deposits === "some" ? { answer: deposits, paidRows: paid.success ? paid.data : [] } : { answer: deposits };
  }
  const contracts = oneOf(CONTRACTS_ANSWERS, formData.get("contracts"));
  if (contracts) {
    const signed = rowIndexes.safeParse(formData.getAll("contractSignedRows").flatMap((value) => String(value).split(",")).filter((value) => value !== ""));
    answers.contracts = contracts === "per_line" ? { answer: contracts, signedRows: signed.success ? signed.data : [] } : { answer: contracts };
  }
  const eventTypeId = optionalId(formData.get("eventTypeId"));
  if (eventTypeId) answers.eventTypeId = eventTypeId;
  const stage = oneOf(EVENT_STAGE_ANSWERS, formData.get("eventStage"));
  if (stage) answers.eventStage = stage;
  const source = optionalId(formData.get("prospectSourceId"));
  if (source) answers.prospectSourceId = source;
  if (formData.get("nameCase") === "keep") answers.nameCase = "keep";
  const pastDue = oneOf(PAST_DUE_TASKS_ANSWERS, formData.get("pastDueTasks"));
  if (pastDue) {
    const date = String(formData.get("pastDueDate") ?? "").trim();
    answers.pastDueTasks = pastDue === "redate" && isoDate.safeParse(date).success ? { answer: pastDue, date } : { answer: pastDue };
  }
  return answers;
}

export async function saveQuestionsAction(_previous: QuestionsFormState, formData: FormData): Promise<QuestionsFormState> {
  const t = await getTranslations("Import");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { missing: [], error: t("unauthenticated") };
  const importId = String(formData.get("importId") ?? "");
  if (!isValidId(importId)) return { missing: [], error: t("importNotFound") };
  const organizationId = auth.user.organizationId;
  try {
    if (!(await saveQuestionAnswers(organizationId, importId, await answersFromForm(formData)))) return { missing: [], error: t("importNotFound") };
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
