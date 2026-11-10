"use client";

// EVT-04 — formulaires des modèles de rétroplanning. Lot 21 (EVT-22) :
// création et renommage dans le panneau latéral ; une même fiche pour ajouter
// ou modifier une tâche.
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { TaskResponsible } from "@/modules/events/service";
import {
  createTaskTemplateAction,
  loadStarterRetroplanningAction,
  renameTaskTemplateAction,
  saveTaskTemplateItemAction,
  type TaskTemplateFormState,
} from "./template-actions";

export function CreateTaskTemplateForm() {
  const t = useTranslations("Events");
  const initialState: TaskTemplateFormState = {};
  const [state, formAction, pending] = useActionState(createTaskTemplateAction, initialState);

  return (
    <form action={formAction} className="panel-form">
      <label>
        {t("newTaskTemplateName")}
        <input type="text" name="name" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("createTaskTemplate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

export function RenameTaskTemplateForm({ templateId, name }: { templateId: string; name: string }) {
  const t = useTranslations("Events");
  const initialState: TaskTemplateFormState = {};
  const [state, formAction, pending] = useActionState(renameTaskTemplateAction, initialState);

  return (
    <form action={formAction} className="panel-form">
      <input type="hidden" name="templateId" value={templateId} />
      <label>
        {t("newTaskTemplateName")}
        <input type="text" name="name" required defaultValue={name} />
      </label>
      <button type="submit" disabled={pending}>
        {t("renameTemplateSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
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

export type TaskTemplateItemDraft = { id?: string; label: string; offsetDays: string; responsible: TaskResponsible };

const EMPTY: TaskTemplateItemDraft = { label: "", offsetDays: "", responsible: "planner" };

export function TaskTemplateItemForm({ templateId, item }: { templateId: string; item?: TaskTemplateItemDraft }) {
  const t = useTranslations("Events");
  const initialState: TaskTemplateFormState = {};
  const [state, formAction, pending] = useActionState(saveTaskTemplateItemAction, initialState);
  // Champs contrôlés : React 19 réinitialise le formulaire après chaque action.
  const [draft, setDraft] = useState(item ?? EMPTY);
  useEffect(() => {
    if (state.success && !item?.id) setDraft((current) => ({ ...EMPTY, responsible: current.responsible }));
  }, [state, item?.id]);

  return (
    <form action={formAction} className="panel-form">
      <input type="hidden" name="templateId" value={templateId} />
      {item?.id ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <label>
        {t("taskLabel")}
        <input type="text" name="label" required value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
      </label>
      <label>
        {t("taskOffsetDays")}
        <input type="number" name="offsetDays" required step={1} value={draft.offsetDays} onChange={(event) => setDraft({ ...draft, offsetDays: event.target.value })} />
      </label>
      <label>
        {t("taskResponsible")}
        <select name="responsible" value={draft.responsible} onChange={(event) => setDraft({ ...draft, responsible: event.target.value as TaskResponsible })}>
          <option value="planner">{t("responsiblePlanner")}</option>
          <option value="clients">{t("responsibleClients")}</option>
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {item?.id ? t("saveTemplateTask") : t("addTaskTemplateItem")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("taskTemplateItemAdded")}</p> : null}
    </form>
  );
}
