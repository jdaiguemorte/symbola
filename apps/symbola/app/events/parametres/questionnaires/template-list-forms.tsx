"use client";

// Lot 45 (HUB-21) — ajouter les questionnaires de départ, créer, dupliquer, retirer un modèle.
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { addStarterQuestionnairesAction, createQuestionnaireAction, deleteQuestionnaireAction, duplicateQuestionnaireAction, type TemplateActionState } from "./actions";

export function StarterQuestionnairesButton() {
  const t = useTranslations("QuestionnaireTemplates");
  const [state, setState] = useState<TemplateActionState>({});
  const [pending, startTransition] = useTransition();
  return (
    <div className="stack">
      <button type="button" className="button-ghost" disabled={pending} onClick={() => startTransition(async () => setState(await addStarterQuestionnairesAction()))}>
        {t("addStarters")}
      </button>
      {state.ok ? <p role="status">{state.ok}</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
    </div>
  );
}

export function CreateQuestionnaireForm() {
  const t = useTranslations("QuestionnaireTemplates");
  const [state, action, pending] = useActionState<TemplateActionState, FormData>(createQuestionnaireAction, {});
  return (
    <form action={action} className="stack" aria-labelledby="questionnaire-create-title">
      <h2 id="questionnaire-create-title">{t("createTitle")}</h2>
      <label htmlFor="questionnaire-new-name">{t("name")}</label>
      <input id="questionnaire-new-name" name="name" maxLength={120} required />
      <button type="submit" disabled={pending}>
        {t("create")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

export function TemplateRowActions({ templateId, name }: { templateId: string; name: string }) {
  const t = useTranslations("QuestionnaireTemplates");
  const [state, setState] = useState<TemplateActionState>({});
  const [pending, startTransition] = useTransition();
  return (
    <span className="row-wrap">
      <button type="button" className="button-ghost" disabled={pending} onClick={() => startTransition(async () => setState(await duplicateQuestionnaireAction(templateId, t("copyName", { name }))))}>
        {t("duplicate")}
      </button>
      <button
        type="button"
        className="button-ghost"
        disabled={pending}
        onClick={() => {
          if (window.confirm(t("deleteConfirm", { name }))) startTransition(async () => setState(await deleteQuestionnaireAction(templateId)));
        }}
      >
        {t("delete")}
      </button>
      {state.ok ? <span role="status">{state.ok}</span> : null}
      {state.error ? <span role="alert">{state.error}</span> : null}
    </span>
  );
}
