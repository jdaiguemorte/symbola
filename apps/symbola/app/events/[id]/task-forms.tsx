"use client";
import { useActionState, useState } from "react";





import { useTranslations } from "next-intl";
import type { TaskTemplate } from "@/modules/events/service";
import { applyTaskTemplateAction, changeEventDateAction, type TaskFormState } from "./task-actions";
import { SameDayNotice } from "../same-day-notice";
import { FieldError } from "@/app/ui/field-error";

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

// Lot 71c (CHR-01, CHR-02 ; I3) : sur un mariage repris, les tâches du modèle déjà passées posent la même
// question que la liste reprise d'un tableur (aucune réponse cochée d'avance).
export function ApplyTaskTemplateForm({ eventId, templates, pastDue = {} }: { eventId: string; templates: TaskTemplate[]; pastDue?: Record<string, number> }) {
  const t = useTranslations("Events");
  const tImport = useTranslations("Import");
  const initialState: TaskFormState = {};
  const [state, formAction, pending] = useActionState(applyTaskTemplateAction, initialState);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [answer, setAnswer] = useState("");
  const past = pastDue[templateId] ?? 0;

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
      {past > 0 ? (
        <fieldset className="standing-choice" aria-describedby={state.pastDueError ? "template-past-due-error" : undefined}>
          <legend>{t("templatePastDueLegend", { count: past })}</legend>
          <p className="meta">{t("templatePastDueHint")}</p>
          {(["keep", "redate", "done"] as const).map((value) => (
            <label key={value} className="standing-option">
              <input type="radio" name="pastDueTasks" value={value} checked={answer === value} onChange={() => setAnswer(value)} />
              <span>
                <strong>{tImport(value === "keep" ? "questions.pastDueKeep" : value === "redate" ? "questions.pastDueRedate" : "questions.pastDueDone")}</strong>
                <span className="meta">{value === "keep" ? tImport("questions.pastDueKeepHint", { count: past }) : value === "redate" ? tImport("questions.pastDueRedateHint", { count: past }) : null}</span>
              </span>
            </label>
          ))}
          {answer === "redate" ? (
            <label>
              {tImport("questions.pastDueDate")}
              <input type="date" name="pastDueDate" />
            </label>
          ) : null}
          <FieldError id="template-past-due-error" message={state.pastDueError} />
        </fieldset>
      ) : null}
      <button type="submit" disabled={pending}>
        {t("applyTaskTemplate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("taskTemplateApplied")}</p> : null}
    </form>
  );
}
