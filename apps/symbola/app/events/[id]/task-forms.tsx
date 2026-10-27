"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { EventTask, TaskResponsible, TaskTemplate } from "@/modules/events/service";
import {
  addEventTaskAction,
  applyTaskTemplateAction,
  changeEventDateAction,
  updateEventTaskAction,
  type TaskFormState,
} from "./task-actions";
import { RESPONSIBLE_LABEL_KEYS } from "./task-responsible";

function ResponsibleSelect({
  value,
  onChange,
}: {
  value: TaskResponsible;
  onChange: (value: TaskResponsible) => void;
}) {
  const t = useTranslations("Events");
  return (
    <label>
      {t("taskResponsible")}
      <select name="responsible" value={value} onChange={(event) => onChange(event.target.value as TaskResponsible)}>
        {(Object.keys(RESPONSIBLE_LABEL_KEYS) as TaskResponsible[]).map((key) => (
          <option key={key} value={key}>
            {t(RESPONSIBLE_LABEL_KEYS[key])}
          </option>
        ))}
      </select>
    </label>
  );
}

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
        <input type="date" name="eventDate" value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
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

export function AddEventTaskForm({ eventId }: { eventId: string }) {
  const t = useTranslations("Events");
  const initialState: TaskFormState = {};
  const [state, formAction, pending] = useActionState(addEventTaskAction, initialState);
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [responsible, setResponsible] = useState<TaskResponsible>("planner");
  // Une tâche ajoutée vide le formulaire pour la suivante ; une erreur garde la saisie.
  useEffect(() => {
    if (!state.success) return;
    setLabel("");
    setDueDate("");
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <fieldset>
        <legend>{t("newTask")}</legend>
        <label>
          {t("taskLabel")}
          <input type="text" name="label" required value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
        <label>
          {t("taskDueDate")}
          <input
            type="date"
            name="dueDate"
            required
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        <ResponsibleSelect value={responsible} onChange={setResponsible} />
        <button type="submit" disabled={pending}>
          {t("addTask")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("taskAdded")}</p> : null}
      </fieldset>
    </form>
  );
}

export function EditEventTaskForm({ eventId, task }: { eventId: string; task: EventTask }) {
  const t = useTranslations("Events");
  const initialState: TaskFormState = {};
  const [state, formAction, pending] = useActionState(updateEventTaskAction, initialState);
  const [label, setLabel] = useState(task.label);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [responsible, setResponsible] = useState<TaskResponsible>(task.responsible);

  return (
    <details>
      <summary>{t("editTask", { label: task.label })}</summary>
      <form action={formAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="taskId" value={task.id} />
        <fieldset>
          <legend>{task.label}</legend>
          <label>
            {t("taskLabel")}
            <input type="text" name="label" required value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label>
            {t("taskDueDate")}
            <input
              type="date"
              name="dueDate"
              required
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
          <ResponsibleSelect value={responsible} onChange={setResponsible} />
          <button type="submit" disabled={pending}>
            {t("saveTask")}
          </button>
          {state.error ? <p role="alert">{state.error}</p> : null}
          {state.success ? <p role="status">{t("taskSaved")}</p> : null}
        </fieldset>
      </form>
    </details>
  );
}
