"use server";

// Lot 38a (MSG-01 ; D3, D5, D6, D7 ; ADR 0072) — l'écran d'un modèle d'e-mail : enregistrer (variables
// inconnues refusées, variable indispensable exigée), mettre à jour l'aperçu, s'envoyer un essai avec
// le texte affiché, revenir au texte de départ. Session planner vérifiée ; un modèle d'un module non
// souscrit est refusé. React vide le formulaire après l'action : le texte saisi revient (values).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MailQuotaExceededError } from "@symbola/mail";
import type { EmailLocale, EmailTemplateKind } from "@symbola/contracts";
import { requirePlanner } from "@/lib/guards";
import {
  EMAIL_BODY_MAX,
  EMAIL_SUBJECT_MAX,
  EmailTemplateInvalidError,
  EmailVariableMissingError,
  isEmailTemplateKind,
  previewEmailTemplate,
  resetEmailTemplate,
  saveEmailTemplate,
  sendTestEmail,
  validateEmailTemplate,
  variableToken,
  type EmailPreview,
  type EmailTemplateProblems,
} from "@/modules/hub/service";
import { isTemplateAvailable } from "./groups";

export type EmailTemplateFormState = {
  error?: string;
  problems?: string[];
  saved?: boolean;
  testSentTo?: string;
  preview?: EmailPreview;
  values?: { subject: string; body: string };
  at?: number;
};

type Translate = Awaited<ReturnType<typeof getTranslations<"EmailTemplates">>>;

function problemMessages(problems: EmailTemplateProblems & { empty: ("subject" | "body")[] }, locale: EmailLocale, t: Translate): string[] {
  const messages: string[] = [];
  if (problems.empty.length > 0) messages.push(t("errorEmpty"));
  if (problems.unknown.length > 0) messages.push(t("errorUnknown", { tokens: problems.unknown.map((token) => `{{${token}}}`).join(", ") }));
  if (problems.missingRequired.length > 0) messages.push(t("errorRequired", { tokens: problems.missingRequired.map((key) => variableToken(key, locale)).join(", ") }));
  if (problems.tooLong.includes("subject")) messages.push(t("errorSubjectTooLong", { max: EMAIL_SUBJECT_MAX }));
  if (problems.tooLong.includes("body")) messages.push(t("errorBodyTooLong", { max: EMAIL_BODY_MAX }));
  return messages;
}

async function readTarget(formData: FormData, organizationId: string): Promise<{ kind: EmailTemplateKind; locale: EmailLocale }> {
  const kind = String(formData.get("kind") ?? "");
  const locale = String(formData.get("locale") ?? "");
  if (!isEmailTemplateKind(kind) || (locale !== "fr" && locale !== "en") || !(await isTemplateAvailable(organizationId, kind))) redirect("/parametres/emails");
  return { kind, locale };
}

export async function emailTemplateAction(_prev: EmailTemplateFormState, formData: FormData): Promise<EmailTemplateFormState> {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("EmailTemplates");
  const target = await readTarget(formData, organizationId);
  const values = { subject: String(formData.get("subject") ?? ""), body: String(formData.get("body") ?? "") };
  const text = { subject: values.subject.trim(), body: values.body.replace(/\r\n/g, "\n").trim() };
  const echo = { values, at: Date.now() };
  const intent = String(formData.get("intent") ?? "save");

  if (intent === "preview") {
    return { ...echo, preview: await previewEmailTemplate({ organizationId, ...target, template: text }) };
  }

  if (intent === "test") {
    // Un essai part avec le texte affiché, dans les mêmes limites qu'un modèle enregistré.
    const problems = validateEmailTemplate(target.kind, text);
    const empty: ("subject" | "body")[] = [...(text.subject ? [] : ["subject" as const]), ...(text.body ? [] : ["body" as const])];
    if (empty.length > 0 || problems.unknown.length > 0 || problems.tooLong.length > 0) {
      return { ...echo, problems: problemMessages({ ...problems, missingRequired: [], empty }, target.locale, t) };
    }
    try {
      const { to } = await sendTestEmail({ organizationId, userId: auth.user.id, ...target, template: text });
      return { ...echo, testSentTo: to, preview: await previewEmailTemplate({ organizationId, ...target, template: text }) };
    } catch (error) {
      if (error instanceof MailQuotaExceededError) {
        return { ...echo, error: (await getTranslations("Events"))("mailQuotaReached", { minutes: Math.max(1, Math.ceil(error.retryAfterSeconds / 60)) }) };
      }
      if (error instanceof EmailVariableMissingError) return { ...echo, error: t("previewMissing", { tokens: error.tokens.join(", ") }) };
      // Messagerie injoignable : nom de l'erreur seulement au journal (SEC-20).
      console.error("essai d'e-mail non parti", error instanceof Error ? error.name : "erreur");
      return { ...echo, error: t("testFailed") };
    }
  }

  try {
    const saved = await saveEmailTemplate({ organizationId, ...target, ...text });
    revalidatePath("/parametres/emails", "layout");
    return {
      saved: true,
      values: { subject: saved.subject, body: saved.body },
      at: Date.now(),
      preview: await previewEmailTemplate({ organizationId, ...target }),
    };
  } catch (error) {
    if (error instanceof EmailTemplateInvalidError) return { ...echo, problems: problemMessages(error.problems, target.locale, t) };
    throw error;
  }
}

export async function resetEmailTemplateAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  const target = await readTarget(formData, auth.user.organizationId);
  await resetEmailTemplate(auth.user.organizationId, target.kind, target.locale);
  revalidatePath("/parametres/emails", "layout");
  // La marque change à chaque retour : la page remonte le formulaire avec le texte de départ.
  redirect(`/parametres/emails/${target.kind}?langue=${target.locale}&retabli=${Date.now()}`);
}
