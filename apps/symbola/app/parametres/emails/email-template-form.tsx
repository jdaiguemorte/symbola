"use client";

// Lot 38a (MSG-01 ; D5, D6, D7 ; ADR 0072) — l'écran d'un modèle d'e-mail : objet, texte, variables du
// modèle, enregistrement, aperçu avec des données fictives et essai envoyé à soi-même.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { EmailLocale, EmailTemplateKind } from "@symbola/contracts";
import type { EmailPreview } from "@/modules/hub/service";
import { emailTemplateAction, type EmailTemplateFormState } from "./actions";
import { EmailPreviewView } from "./email-preview";

export type TemplateVariable = { key: string; token: string; required: boolean; description: string };

export function EmailTemplateForm({
  kind,
  locale,
  template,
  variables,
  initialPreview,
  logoUrl,
  limits,
}: {
  kind: EmailTemplateKind;
  locale: EmailLocale;
  template: { subject: string; body: string };
  variables: TemplateVariable[];
  initialPreview: EmailPreview;
  logoUrl: string | null;
  limits: { subject: number; body: number };
}) {
  const t = useTranslations("EmailTemplates");
  const initialState: EmailTemplateFormState = {};
  const [state, formAction, pending] = useActionState(emailTemplateAction, initialState);
  const values = state.values ?? template;
  const preview = state.preview ?? initialPreview;
  return (
    <div className="email-template-editor">
      <form action={formAction} className="stack" aria-label={t("title")}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="locale" value={locale} />
        <label htmlFor="email-template-subject">{t("subjectLabel")}</label>
        <input key={`subject-${state.at ?? 0}`} id="email-template-subject" type="text" name="subject" defaultValue={values.subject} maxLength={limits.subject} required />
        <label htmlFor="email-template-body">{t("bodyLabel")}</label>
        <textarea
          key={`body-${state.at ?? 0}`}
          id="email-template-body"
          name="body"
          rows={14}
          defaultValue={values.body}
          maxLength={limits.body}
          aria-describedby="email-template-body-hint"
          required
        />
        <p id="email-template-body-hint" className="meta">
          {t("bodyHint")}
        </p>
        <section aria-labelledby="email-template-variables-title">
          <h2 id="email-template-variables-title">{t("variablesTitle")}</h2>
          <ul className="plain-list">
            {variables.map((variable) => (
              <li key={variable.key}>
                <code>{variable.token}</code> — {variable.description}
                {variable.required ? ` (${t("variableRequired")})` : null}
              </li>
            ))}
          </ul>
        </section>
        <div className="row-wrap">
          <button type="submit" name="intent" value="save" disabled={pending}>
            {t("save")}
          </button>
          <button type="submit" name="intent" value="preview" className="button-ghost" disabled={pending}>
            {t("preview")}
          </button>
          <button type="submit" name="intent" value="test" className="button-ghost" disabled={pending}>
            {t("sendTest")}
          </button>
        </div>
        <p className="meta">{t("testHint")}</p>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.problems && state.problems.length > 0 ? (
          <div role="alert">
            <ul>
              {state.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {state.saved ? <p role="status">{t("saved")}</p> : null}
        {state.testSentTo ? <p role="status">{t("testSent", { email: state.testSentTo })}</p> : null}
      </form>
      <section aria-labelledby="email-template-preview-title">
        <h2 id="email-template-preview-title">{t("previewTitle")}</h2>
        <p className="meta">{t("previewHint")}</p>
        <EmailPreviewView preview={preview} logoUrl={logoUrl} />
      </section>
    </div>
  );
}
