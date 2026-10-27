"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { TaskResponsible } from "@/modules/events/service";
import {
  addTaskTemplateItemAction,
  createTaskTemplateAction,
  loadStarterRetroplanningAction,
  type TaskTemplateFormState,
} from "./template-actions";

export function CreateTaskTemplateForm() {
  const t = useTranslations("Events");
  const initialState: TaskTemplateFormState = {};
  const [state, formAction, pending] = useActionState(createTaskTemplateAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("newTaskTemplateName")}
        <input type="text" name="name" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("createTaskTemplate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("taskTemplateCreated")}</p> : null}
    </form>
  );
}

export function LoadStarterRetroplanningForm() {
  const t = useTranslations("Events");
  const initialState: TaskTemplateFormState = {};
  const [state, formAction, pending] = useActionState(loadStarterRetroplanningAction, initialState);

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending}>
        {t("loadStarterRetroplanning")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("starterRetroplanningLoaded")}</p> : null}
    </form>
  );
}

export function AddTaskTemplateItemForm({ templateId, templateName }: { templateId: string; templateName: string }) {
  const t = useTranslations("Events");
  const initialState: TaskTemplateFormState = {};
  const [state, formAction, pending] = useActionState(addTaskTemplateItemAction, initialState);
  // Champs contrôlés : React 19 réinitialise le formulaire après chaque action.
  const [label, setLabel] = useState("");
  const [offsetDays, setOffsetDays] = useState("");
  const [responsible, setResponsible] = useState<TaskResponsible>("planner");
  useEffect(() => {
    if (!state.success) return;
    setLabel("");
    setOffsetDays("");
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="templateId" value={templateId} />
      <fieldset>
        <legend>{t("addTaskTemplateItemTo", { name: templateName })}</legend>
        <label>
          {t("taskLabel")}
          <input type="text" name="label" required value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
        <label>
          {t("taskOffsetDays")}
          <input
            type="number"
            name="offsetDays"
            required
            step={1}
            value={offsetDays}
            onChange={(event) => setOffsetDays(event.target.value)}
          />
        </label>
        <label>
          {t("taskResponsible")}
          <select
            name="responsible"
            value={responsible}
            onChange={(event) => setResponsible(event.target.value as TaskResponsible)}
          >
            <option value="planner">{t("responsiblePlanner")}</option>
            <option value="clients">{t("responsibleClients")}</option>
          </select>
        </label>
        <button type="submit" disabled={pending}>
          {t("addTaskTemplateItem")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("taskTemplateItemAdded")}</p> : null}
      </fieldset>
    </form>
  );
}
