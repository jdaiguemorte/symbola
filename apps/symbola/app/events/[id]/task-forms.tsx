"use client";
import { useActionState, useState } from "react";





import { useTranslations } from "next-intl";
import type { TaskTemplate } from "@/modules/events/service";
import { applyTaskTemplateAction, type TaskFormState } from "./task-actions";
import { FieldError } from "@/app/ui/field-error";

// Lot 71c (CHR-01, CHR-02 ; I3) : sur un mariage repris, les tâches du modèle déjà passées posent la même
// question que la liste reprise d'un tableur (aucune réponse cochée d'avance).
export function ApplyTaskTemplateForm({ eventId, templates, pastDue = {}, submitLabel }: { eventId: string; templates: TaskTemplate[]; pastDue?: Record<string, number>; submitLabel?: string }) {
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
        {submitLabel ?? t("applyTaskTemplate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("taskTemplateApplied")}</p> : null}
    </form>
  );
}
