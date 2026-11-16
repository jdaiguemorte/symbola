"use client";

// Lot 38b (HUB-21 ; D10 ; ADR 0072) — le formulaire d'un modèle de message : nom, type d'évènement,
// langue (à la création), objet, texte et variables. React vide le formulaire après l'action : le
// texte saisi revient (values).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createMessageTemplateAction, saveMessageTemplateAction, type MessageTemplateFormState } from "./actions";

type Variable = { key: string; token: string; description: string };

export function MessageTemplateForm({
  template,
  eventTypes,
  variables,
  limits,
  locale,
}: {
  // Absent : un modèle nouveau.
  template?: { id: string; name: string; eventTypeId: string | null; subject: string; body: string };
  eventTypes: { id: string; label: string }[];
  variables: Variable[];
  limits: { name: number; subject: number; body: number };
  locale: "fr" | "en";
}) {
  const t = useTranslations("MessageTemplates");
  const initialState: MessageTemplateFormState = {};
  const [state, formAction, pending] = useActionState(template ? saveMessageTemplateAction : createMessageTemplateAction, initialState);
  const values = state.values ?? { name: template?.name ?? "", eventTypeId: template?.eventTypeId ?? "", subject: template?.subject ?? "", body: template?.body ?? "" };
  const key = state.at ?? 0;
  return (
    <form action={formAction} className="stack" aria-label={template ? t("edit", { name: template.name }) : t("newTitle")}>
      {template ? <input type="hidden" name="templateId" value={template.id} /> : null}
      <label htmlFor="message-template-name">{t("name")}</label>
      <input key={`name-${key}`} id="message-template-name" type="text" name="name" defaultValue={values.name} maxLength={limits.name} required />
      <label htmlFor="message-template-type">{t("eventType")}</label>
      <select key={`type-${key}`} id="message-template-type" name="eventTypeId" defaultValue={values.eventTypeId}>
        <option value="">{t("allTypes")}</option>
        {eventTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>
      {template ? null : (
        <>
          <label htmlFor="message-template-locale">{t("locale")}</label>
          <select id="message-template-locale" name="locale" defaultValue={locale}>
            <option value="fr">{t("language.fr")}</option>
            <option value="en">{t("language.en")}</option>
          </select>
        </>
      )}
      <label htmlFor="message-template-subject">{t("subject")}</label>
      <input key={`subject-${key}`} id="message-template-subject" type="text" name="subject" defaultValue={values.subject} maxLength={limits.subject} required />
      <label htmlFor="message-template-body">{t("body")}</label>
      <textarea key={`body-${key}`} id="message-template-body" name="body" rows={12} defaultValue={values.body} maxLength={limits.body} aria-describedby="message-template-body-hint" required />
      <p id="message-template-body-hint" className="meta">
        {t("bodyHint")}
      </p>
      <section aria-labelledby="message-template-variables-title">
        <h2 id="message-template-variables-title">{t("variablesTitle")}</h2>
        <ul className="plain-list">
          {variables.map((variable) => (
            <li key={variable.key}>
              <code>{variable.token}</code> — {variable.description}
            </li>
          ))}
        </ul>
      </section>
      <div className="row-wrap">
        <button type="submit" disabled={pending}>
          {template ? t("save") : t("create")}
        </button>
      </div>
      {state.problems && state.problems.length > 0 ? (
        <div role="alert">
          <ul>
            {state.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.saved ? <p role="status">{state.saved.changed ? t("saved", { version: state.saved.version }) : t("unchanged", { version: state.saved.version })}</p> : null}
    </form>
  );
}
