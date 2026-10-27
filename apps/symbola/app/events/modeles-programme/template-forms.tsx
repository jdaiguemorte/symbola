"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addProgramTemplateItemAction,
  createProgramTemplateAction,
  loadStarterProgramAction,
  type ProgramTemplateFormState,
} from "./template-actions";

export function CreateProgramTemplateForm() {
  const t = useTranslations("Events");
  const initialState: ProgramTemplateFormState = {};
  const [state, formAction, pending] = useActionState(createProgramTemplateAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("newProgramTemplateName")}
        <input type="text" name="name" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("createProgramTemplate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("programTemplateCreated")}</p> : null}
    </form>
  );
}

export function LoadStarterProgramForm() {
  const t = useTranslations("Events");
  const initialState: ProgramTemplateFormState = {};
  const [state, formAction, pending] = useActionState(loadStarterProgramAction, initialState);

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending}>
        {t("loadStarterProgram")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("starterProgramLoaded")}</p> : null}
    </form>
  );
}

const EMPTY = { startTime: "", endTime: "", label: "", location: "", participantLabels: "" };

export function AddProgramTemplateItemForm({ templateId, templateName }: { templateId: string; templateName: string }) {
  const t = useTranslations("Events");
  const initialState: ProgramTemplateFormState = {};
  const [state, formAction, pending] = useActionState(addProgramTemplateItemAction, initialState);
  // Champs contrôlés : React 19 réinitialise le formulaire après chaque action.
  const [draft, setDraft] = useState(EMPTY);
  useEffect(() => {
    if (state.success) setDraft(EMPTY);
  }, [state]);
  const set = (field: keyof typeof EMPTY) => (event: { target: { value: string } }) =>
    setDraft({ ...draft, [field]: event.target.value });

  return (
    <form action={formAction}>
      <input type="hidden" name="templateId" value={templateId} />
      <fieldset>
        <legend>{t("addProgramTemplateItemTo", { name: templateName })}</legend>
        <label>
          {t("programStartTime")}
          <input type="time" name="startTime" required value={draft.startTime} onChange={set("startTime")} />
        </label>
        <label>
          {t("programEndTime")}
          <input type="time" name="endTime" value={draft.endTime} onChange={set("endTime")} />
        </label>
        <label>
          {t("programItemLabel")}
          <input type="text" name="label" required value={draft.label} onChange={set("label")} />
        </label>
        <label>
          {t("programLocation")}
          <input type="text" name="location" value={draft.location} onChange={set("location")} />
        </label>
        <label>
          {t("programTemplateParticipants")}
          <input type="text" name="participantLabels" value={draft.participantLabels} onChange={set("participantLabels")} />
        </label>
        <button type="submit" disabled={pending}>
          {t("addProgramTemplateItem")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("programTemplateItemAdded")}</p> : null}
      </fieldset>
    </form>
  );
}
