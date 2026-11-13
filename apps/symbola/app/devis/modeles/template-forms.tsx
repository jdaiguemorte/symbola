"use client";

// Lot 31a (FAC-01, HUB-21 ; décision D3) — renommer et dupliquer un modèle de devis.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { QuoteTemplateSummary } from "@/modules/quotes/service";
import { duplicateTemplateAction, renameTemplateAction, type TemplateFormState } from "./actions";

export function RenameTemplateForm({ template, eventTypes }: { template: QuoteTemplateSummary; eventTypes: { id: string; label: string }[] }) {
  const t = useTranslations("Quotes");
  const [state, action, pending] = useActionState(renameTemplateAction, {} as TemplateFormState);
  return (
    <form action={action} aria-label={t("renameTemplateNamed", { name: template.name })}>
      <input type="hidden" name="templateId" value={template.id} />
      <label>
        {t("templateName")}
        <input type="text" name="name" maxLength={120} required defaultValue={template.name} />
      </label>
      <label>
        {t("templateEventType")}
        <select name="eventTypeId" defaultValue={template.eventTypeId ?? ""}>
          <option value="">{t("templateAllEventTypes")}</option>
          {eventTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("renameTemplate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("templateRenamed")}</p> : null}
    </form>
  );
}

export function DuplicateTemplateForm({ template }: { template: QuoteTemplateSummary }) {
  const t = useTranslations("Quotes");
  const [state, action, pending] = useActionState(duplicateTemplateAction, {} as TemplateFormState);
  return (
    <form action={action} aria-label={t("duplicateTemplateNamed", { name: template.name })}>
      <input type="hidden" name="templateId" value={template.id} />
      <input type="hidden" name="sourceName" value={template.name} />
      <button type="submit" disabled={pending}>
        {t("duplicateTemplateNamed", { name: template.name })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("templateDuplicated")}</p> : null}
    </form>
  );
}
