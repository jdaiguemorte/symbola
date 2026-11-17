"use server";

// Lot 38b (HUB-21 ; D10 ; ADR 0072) — Paramètres › Modèles de messages : créer, enregistrer (une
// version par texte changé), restaurer une version, dupliquer, supprimer, ajouter les modèles de
// départ. Session planner vérifiée ; le module Évènements doit être souscrit ; le type d'évènement
// choisi doit être un type de l'organisation.
import { offerUndo } from "@/lib/undo";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { listEventTypes } from "@/modules/events/service";
import {
  addStarterMessageTemplates,
  createMessageTemplate,
  deleteMessageTemplate,
  duplicateMessageTemplate,
  EMAIL_BODY_MAX,
  EMAIL_SUBJECT_MAX,
  getMessageTemplate,
  MESSAGE_TEMPLATE_NAME_MAX,
  MessageTemplateInvalidError,
  MessageTemplateNotFoundError,
  restoreMessageTemplateVersion,
  saveMessageTemplate,
} from "@/modules/hub/service";

export type MessageTemplateFormState = {
  problems?: string[];
  saved?: { version: number; changed: boolean };
  values?: { name: string; eventTypeId: string; subject: string; body: string };
  at?: number;
};

const PATH = "/parametres/messages";

async function access(): Promise<{ organizationId: string }> {
  const auth = await requirePlanner();
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) redirect(PATH);
  return { organizationId: auth.user.organizationId };
}

// Un type d'évènement de l'organisation, ou aucun (« tous les évènements »).
async function eventTypeOf(organizationId: string, value: string): Promise<string | null> {
  if (!isValidId(value)) return null;
  return (await listEventTypes(organizationId)).some((type) => type.id === value) ? value : null;
}

function readValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    eventTypeId: String(formData.get("eventTypeId") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
  };
}

async function problemMessages(error: MessageTemplateInvalidError): Promise<string[]> {
  const t = await getTranslations("MessageTemplates");
  const { problems } = error;
  const messages: string[] = [];
  if (problems.empty.length > 0) messages.push(t("errorEmpty"));
  if (problems.nameTooLong) messages.push(t("errorNameTooLong", { max: MESSAGE_TEMPLATE_NAME_MAX }));
  if (problems.unknown.length > 0) messages.push(t("errorUnknown", { tokens: problems.unknown.map((token) => `{{${token}}}`).join(", ") }));
  if (problems.tooLong.includes("subject")) messages.push(t("errorSubjectTooLong", { max: EMAIL_SUBJECT_MAX }));
  if (problems.tooLong.includes("body")) messages.push(t("errorBodyTooLong", { max: EMAIL_BODY_MAX }));
  return messages;
}

export async function createMessageTemplateAction(_prev: MessageTemplateFormState, formData: FormData): Promise<MessageTemplateFormState> {
  const { organizationId } = await access();
  const values = readValues(formData);
  const locale = formData.get("locale") === "en" ? "en" : "fr";
  let id: string;
  try {
    id = (await createMessageTemplate({ organizationId, locale, ...values, eventTypeId: await eventTypeOf(organizationId, values.eventTypeId) })).id;
  } catch (error) {
    if (error instanceof MessageTemplateInvalidError) return { problems: await problemMessages(error), values, at: Date.now() };
    throw error;
  }
  revalidatePath(PATH);
  redirect(`${PATH}/${id}`);
}

export async function saveMessageTemplateAction(_prev: MessageTemplateFormState, formData: FormData): Promise<MessageTemplateFormState> {
  const { organizationId } = await access();
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) redirect(PATH);
  const values = readValues(formData);
  try {
    const before = await getMessageTemplate(organizationId, templateId);
    if (!before) redirect(PATH);
    const saved = await saveMessageTemplate({ organizationId, templateId, ...values, eventTypeId: await eventTypeOf(organizationId, values.eventTypeId) });
    revalidatePath(PATH, "layout");
    return { saved: { version: saved.version, changed: saved.version !== before.version }, values: { name: saved.name, eventTypeId: saved.eventTypeId ?? "", subject: saved.subject, body: saved.body }, at: Date.now() };
  } catch (error) {
    if (error instanceof MessageTemplateInvalidError) return { problems: await problemMessages(error), values, at: Date.now() };
    if (error instanceof MessageTemplateNotFoundError) redirect(PATH);
    throw error;
  }
}

export async function restoreMessageTemplateAction(formData: FormData): Promise<void> {
  const { organizationId } = await access();
  const templateId = String(formData.get("templateId") ?? "");
  const version = Number(formData.get("version"));
  if (!isValidId(templateId) || !Number.isInteger(version)) redirect(PATH);
  try {
    await restoreMessageTemplateVersion({ organizationId, templateId, version });
  } catch (error) {
    if (error instanceof MessageTemplateNotFoundError) redirect(PATH);
    throw error;
  }
  revalidatePath(PATH, "layout");
  redirect(`${PATH}/${templateId}?restaure=${Date.now()}`);
}

export async function duplicateMessageTemplateAction(formData: FormData): Promise<void> {
  const { organizationId } = await access();
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) redirect(PATH);
  const template = await getMessageTemplate(organizationId, templateId);
  if (!template) redirect(PATH);
  const t = await getTranslations("MessageTemplates");
  const copy = await duplicateMessageTemplate({ organizationId, templateId, name: t("copyName", { name: template.name }) });
  revalidatePath(PATH);
  redirect(`${PATH}/${copy.id}`);
}

export async function deleteMessageTemplateAction(formData: FormData): Promise<void> {
  const { organizationId } = await access();
  const templateId = String(formData.get("templateId") ?? "");
  if (isValidId(templateId)) {
    try {
      await deleteMessageTemplate(organizationId, templateId);
      await offerUndo({ kind: "messageTemplate", id: templateId });
    } catch (error) {
      if (!(error instanceof MessageTemplateNotFoundError)) throw error;
    }
  }
  revalidatePath(PATH);
  redirect(PATH);
}

export async function addStarterMessageTemplatesAction(): Promise<void> {
  const { organizationId } = await access();
  const added = await addStarterMessageTemplates(organizationId, (await getLocale()) === "en" ? "en" : "fr");
  revalidatePath(PATH);
  redirect(`${PATH}?ajoutes=${added}`);
}
