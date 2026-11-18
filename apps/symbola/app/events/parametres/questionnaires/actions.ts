"use server";

// Lot 45 (HUB-21, POR-07 ; D6, D8 ; ADR 0090) — modèles de questionnaires : ajouter ceux de départ, en
// créer, enregistrer les questions (une version de plus si elles changent), dupliquer, retirer.
// Contrôlé côté serveur à chaque appel : session, organisation, module Évènements ouvert ; le modèle et
// le type d'évènement sont de l'organisation (RLS). Toute la planification est validée par le module.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  addStarterQuestionnaires,
  createQuestionnaireTemplate,
  deleteQuestionnaireTemplate,
  duplicateQuestionnaireTemplate,
  QuestionInvalidError,
  QuestionnaireNotFoundError,
  QuestionnaireTemplateInvalidError,
  saveQuestionnaireTemplate,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../../module-access";

export type TemplateActionState = { ok?: string; error?: string };

async function access() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

const questionSchema = z.object({
  key: z.string().max(60).nullable().optional(),
  label: z.string().max(1000),
  help: z.string().max(2000).nullable().optional(),
  nature: z.string().max(40),
  choices: z.array(z.string().max(500)).max(50).optional(),
  eventField: z.string().max(40).nullable().optional(),
});
const templateSchema = z.object({ name: z.string().max(500), eventTypeId: z.string().nullable(), questions: z.array(questionSchema).max(120) });

function refresh() {
  revalidatePath("/events/parametres/questionnaires");
}

export async function addStarterQuestionnairesAction(): Promise<TemplateActionState> {
  const t = await getTranslations("QuestionnaireTemplates");
  const who = await access();
  if (!who) return { error: t("refused") };
  const added = await addStarterQuestionnaires(who.organizationId, (await getLocale()) === "en" ? "en" : "fr");
  refresh();
  return { ok: t("startersAdded", { count: added }) };
}

export async function createQuestionnaireAction(_state: TemplateActionState, form: FormData): Promise<TemplateActionState> {
  const t = await getTranslations("QuestionnaireTemplates");
  const who = await access();
  if (!who) return { error: t("refused") };
  let id: string;
  try {
    const created = await createQuestionnaireTemplate({ organizationId: who.organizationId, name: String(form.get("name") ?? ""), eventTypeId: null, locale: (await getLocale()) === "en" ? "en" : "fr", questions: [{ label: t("firstQuestion"), nature: "long_text" }] });
    id = created.id;
  } catch (error) {
    if (error instanceof QuestionnaireTemplateInvalidError) return { error: t("nameInvalid") };
    throw error;
  }
  refresh();
  redirect(`/events/parametres/questionnaires/${id}`);
}

export async function saveQuestionnaireAction(templateId: string, raw: unknown): Promise<TemplateActionState> {
  const t = await getTranslations("QuestionnaireTemplates");
  const who = await access();
  const parsed = templateSchema.safeParse(raw);
  if (!who || !parsed.success || !isValidId(templateId)) return { error: t("refused") };
  try {
    const saved = await saveQuestionnaireTemplate({
      organizationId: who.organizationId,
      templateId,
      name: parsed.data.name,
      eventTypeId: parsed.data.eventTypeId && isValidId(parsed.data.eventTypeId) ? parsed.data.eventTypeId : null,
      questions: parsed.data.questions.map((question) => ({ key: question.key ?? null, label: question.label, help: question.help ?? null, nature: question.nature, choices: question.choices ?? [], eventField: question.eventField ?? null })),
    });
    refresh();
    revalidatePath(`/events/parametres/questionnaires/${templateId}`);
    return { ok: t("saved", { version: saved.version }) };
  } catch (error) {
    if (error instanceof QuestionInvalidError) return { error: t(`questionInvalid.${error.reason}`) };
    if (error instanceof QuestionnaireTemplateInvalidError) return { error: t(error.reason === "name" ? "nameInvalid" : "refused") };
    if (error instanceof QuestionnaireNotFoundError) return { error: t("refused") };
    throw error;
  }
}

export async function duplicateQuestionnaireAction(templateId: string, name: string): Promise<TemplateActionState> {
  const t = await getTranslations("QuestionnaireTemplates");
  const who = await access();
  if (!who || !isValidId(templateId)) return { error: t("refused") };
  try {
    await duplicateQuestionnaireTemplate({ organizationId: who.organizationId, templateId, name });
  } catch (error) {
    if (error instanceof QuestionnaireNotFoundError || error instanceof QuestionnaireTemplateInvalidError) return { error: t("refused") };
    throw error;
  }
  refresh();
  return { ok: t("duplicated") };
}

export async function deleteQuestionnaireAction(templateId: string): Promise<TemplateActionState> {
  const t = await getTranslations("QuestionnaireTemplates");
  const who = await access();
  if (!who || !isValidId(templateId)) return { error: t("refused") };
  try {
    await deleteQuestionnaireTemplate(who.organizationId, templateId);
  } catch (error) {
    if (error instanceof QuestionnaireNotFoundError) return { error: t("refused") };
    throw error;
  }
  refresh();
  return { ok: t("deleted") };
}
