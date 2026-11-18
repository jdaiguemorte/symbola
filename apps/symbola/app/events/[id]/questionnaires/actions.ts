"use server";

// Lot 45 (POR-07, CRM-09 ; D6, D7 ; ADR 0090) — envoyer un questionnaire à un client de l'évènement
// (par son lien personnel, rubrique « Questionnaires ») ; trancher un écart entre une réponse et la
// fiche. Contrôlé côté serveur à chaque appel : session, organisation, module Évènements ouvert ;
// l'évènement, le client, le modèle et le questionnaire sont de l'organisation (RLS).
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { MailQuotaExceededError } from "@symbola/mail";
import {
  DemoEventRestrictionError,
  EventLinkInvalidError,
  EventNotFoundError,
  QuestionnaireNotFoundError,
  resolveQuestionnaireDifference,
  sendEventQuestionnaire,
} from "@/modules/events/service";
import { EmailVariableMissingError } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../../module-access";

export type QuestionnaireActionState = { ok?: string; error?: string };

async function access() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

export async function sendQuestionnaireAction(eventId: string, _state: QuestionnaireActionState, form: FormData): Promise<QuestionnaireActionState> {
  const t = await getTranslations("EventQuestionnaires");
  const who = await access();
  const templateId = String(form.get("templateId") ?? "");
  const eventClientId = String(form.get("eventClientId") ?? "");
  if (!who || !isValidId(eventId) || !isValidId(templateId) || !isValidId(eventClientId)) return { error: t("refused") };
  try {
    await sendEventQuestionnaire({ organizationId: who.organizationId, eventId, eventClientId, templateId, userId: who.userId, locale: (await getLocale()) === "en" ? "en" : "fr" });
  } catch (error) {
    if (error instanceof DemoEventRestrictionError) return { error: t("demo") };
    if (error instanceof EventLinkInvalidError) return { error: t("noEmail") };
    if (error instanceof EmailVariableMissingError) return { error: t("missing", { tokens: error.tokens.join(", ") }) };
    if (error instanceof MailQuotaExceededError) return { error: t("quota") };
    if (error instanceof QuestionnaireNotFoundError || error instanceof EventNotFoundError) return { error: t("refused") };
    throw error;
  }
  revalidatePath(`/events/${eventId}/questionnaires`);
  revalidatePath(`/events/${eventId}`);
  return { ok: t("sent") };
}

export async function resolveDifferenceAction(eventId: string, questionnaireId: string, key: string, choice: "answer" | "event"): Promise<boolean> {
  const who = await access();
  if (!who || !isValidId(eventId) || !isValidId(questionnaireId) || !/^[a-z0-9_-]{1,60}$/.test(key)) return false;
  try {
    await resolveQuestionnaireDifference({ organizationId: who.organizationId, eventId, questionnaireId, key, choice: choice === "answer" ? "answer" : "event" });
  } catch (error) {
    if (error instanceof QuestionnaireNotFoundError || error instanceof EventNotFoundError) return false;
    throw error;
  }
  revalidatePath(`/events/${eventId}/questionnaires`);
  revalidatePath(`/events/${eventId}`);
  return true;
}
