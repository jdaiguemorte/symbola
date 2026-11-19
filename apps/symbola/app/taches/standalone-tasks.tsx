"use client";

// Lot 53 (CHR-10 ; D6) — formulaire d'une tâche hors évènement : intitulé, échéance, répétition.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addStandaloneTaskAction, type StandaloneTaskFormState } from "./standalone-actions";

export function AddStandaloneTaskForm({ today }: { today: string }) {
  const t = useTranslations("StandaloneTasks");
  const [state, formAction, pending] = useActionState<StandaloneTaskFormState, FormData>(addStandaloneTaskAction, {});
  return (
    <form action={formAction} className="standalone-task-form">
      <div className="form-row">
        <label>
          {t("label")}
          <input type="text" name="label" maxLength={200} required />
        </label>
        <label>
          {t("dueDate")}
          <input type="date" name="dueDate" defaultValue={today} required />
        </label>
        <label>
          {t("recurrence")}
          <select name="recurrence" defaultValue="">
            <option value="">{t("recurrenceNone")}</option>
            {(["weekly", "monthly", "quarterly", "yearly"] as const).map((value) => (
              <option key={value} value={value}>
                {t(`recurrenceValue.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="submit" disabled={pending}>
        {t("add")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("added")}</p> : null}
    </form>
  );
}
