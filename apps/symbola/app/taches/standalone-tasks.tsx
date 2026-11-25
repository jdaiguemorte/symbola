"use client";

// Lot 53 (CHR-10 ; D6) — formulaire d'une tâche hors évènement : intitulé, échéance, répétition.
import { useActionState, useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { RequiredMark } from "@/app/ui/required-mark";
import { addStandaloneTaskAction, updateStandaloneTaskAction, type StandaloneTaskFormState } from "./standalone-actions";

export function AddStandaloneTaskForm({ today }: { today: string }) {
  const t = useTranslations("StandaloneTasks");
  const [state, formAction, pending] = useActionState<StandaloneTaskFormState, FormData>(addStandaloneTaskAction, {});
  return (
    <form action={formAction} className="standalone-task-form">
      <div className="form-row">
        <label>
          <span>
            {t("label")}
            <RequiredMark />
          </span>
          <input type="text" name="label" maxLength={200} required />
        </label>
        <label>
          <span>
            {t("dueDate")}
            <RequiredMark />
          </span>
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

const RECURRENCES = ["weekly", "monthly", "quarterly", "yearly"] as const;

// Lot 67b (CHR-10 ; recette du 24/11/2026, R02) — « Modifier » une tâche hors évènement : la fenêtre
// d'une tâche (même motif que celle d'une tâche d'évènement), avec ses trois champs. Enregistrée, la
// fenêtre se ferme et la ligne montre les nouvelles valeurs.
export function EditStandaloneTask({ task }: { task: { id: string; label: string; dueDate: string; recurrence: string | null } }) {
  const t = useTranslations("StandaloneTasks");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState<StandaloneTaskFormState, FormData>(updateStandaloneTaskAction, {});
  useEffect(() => {
    if (state.success) dialog.current?.close();
  }, [state]);
  return (
    <>
      <button type="button" className="button-secondary" aria-haspopup="dialog" aria-label={t("editLabel", { label: task.label })} onClick={() => dialog.current?.showModal()}>
        {t("edit")}
      </button>
      <dialog ref={dialog} className="task-dialog" aria-labelledby={titleId}>
        <div className="task-dialog-head">
          <h2 id={titleId}>{t("editTitle")}</h2>
          <button type="button" className="button-ghost" onClick={() => dialog.current?.close()}>
            {t("editClose")}
          </button>
        </div>
        <div className="task-dialog-body">
          <div className="task-dialog-content">
            <form action={formAction} id={`${titleId}-form`} className="task-dialog-form" key={`${task.label}-${task.dueDate}-${task.recurrence ?? ""}`}>
              <input type="hidden" name="taskId" value={task.id} />
              <label>
                <span>
                  {t("label")}
                  <RequiredMark />
                </span>
                <input type="text" name="label" maxLength={200} required defaultValue={task.label} />
              </label>
              <div className="field-row">
                <label className="field-fit">
                  <span>
                    {t("dueDate")}
                    <RequiredMark />
                  </span>
                  <input type="date" name="dueDate" required defaultValue={task.dueDate} />
                </label>
                <label className="field-fit">
                  <span>{t("recurrence")}</span>
                  <select name="recurrence" defaultValue={task.recurrence ?? ""}>
                    <option value="">{t("recurrenceNone")}</option>
                    {RECURRENCES.map((value) => (
                      <option key={value} value={value}>
                        {t(`recurrenceValue.${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="meta">{t("editRecurrenceHint")}</p>
              {state.error ? <p role="alert">{state.error}</p> : null}
            </form>
          </div>
        </div>
        <div className="task-dialog-actions">
          <span className="task-dialog-actions-main">
            <button type="button" className="button-secondary" onClick={() => dialog.current?.close()}>
              {t("editCancel")}
            </button>
            <button type="submit" form={`${titleId}-form`} disabled={pending}>
              {t("editSave")}
            </button>
          </span>
        </div>
      </dialog>
    </>
  );
}
