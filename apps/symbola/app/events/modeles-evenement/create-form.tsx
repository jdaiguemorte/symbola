"use client";

// Lot 58 (EVT-08) — « Créer un évènement » depuis un modèle : la date suffit, tout le reste se recalcule.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createFromTemplateAction, type TemplateFormState } from "./actions";

export function CreateFromTemplateForm({ templateId, name }: { templateId: string; name: string }) {
  const t = useTranslations("EventTemplates");
  const [state, action, pending] = useActionState<TemplateFormState, FormData>(createFromTemplateAction, {});
  return (
    <form action={action} className="row-wrap" aria-label={t("createLabel", { name })}>
      <input type="hidden" name="templateId" value={templateId} />
      <label>
        {t("eventDate")}
        <input type="date" name="eventDate" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("create")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
