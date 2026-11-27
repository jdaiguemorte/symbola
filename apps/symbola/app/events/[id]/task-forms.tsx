"use client";
import { useActionState, useState } from "react";





import { useTranslations } from "next-intl";
import type { TaskTemplate } from "@/modules/events/service";
import { applyTaskTemplateAction, changeEventDateAction, type TaskFormState } from "./task-actions";
import { SameDayNotice } from "../same-day-notice";

export function EventDateForm({ eventId, eventDate }: { eventId: string; eventDate: string | null }) {
  const t = useTranslations("Events");
  const initialState: TaskFormState = {};
  const [state, formAction, pending] = useActionState(changeEventDateAction, initialState);
  // Champ contrôlé : React 19 réinitialise le formulaire après chaque action.
  const [value, setValue] = useState(eventDate ?? "");

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("eventDate")}
        <input type="date" name="eventDate" className="field-date" value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      {/* Lot 32b (CRM-04) : les autres évènements du même jour, avant d'enregistrer. */}
      <SameDayNotice date={value} excludeEventId={eventId} />
      <button type="submit" disabled={pending}>
        {t("changeEventDate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("eventDateChanged")}</p> : null}
    </form>
  );
}

export function ApplyTaskTemplateForm({ eventId, templates }: { eventId: string; templates: TaskTemplate[] }) {
  const t = useTranslations("Events");
  const initialState: TaskFormState = {};
  const [state, formAction, pending] = useActionState(applyTaskTemplateAction, initialState);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("taskTemplateToApply")}
        <select name="templateId" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("applyTaskTemplate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("taskTemplateApplied")}</p> : null}
    </form>
  );
}
