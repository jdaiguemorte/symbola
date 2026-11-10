"use client";

// EVT-05 — formulaires des modèles de programme. Lot 21 (EVT-21) : création
// et renommage dans le panneau latéral ; une même fiche pour ajouter ou
// modifier une ligne.
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createProgramTemplateAction,
  loadStarterProgramAction,
  renameProgramTemplateAction,
  saveProgramTemplateItemAction,
  type ProgramTemplateFormState,
} from "./template-actions";

export function CreateProgramTemplateForm() {
  const t = useTranslations("Events");
  const initialState: ProgramTemplateFormState = {};
  const [state, formAction, pending] = useActionState(createProgramTemplateAction, initialState);

  return (
    <form action={formAction} className="panel-form">
      <label>
        {t("newProgramTemplateName")}
        <input type="text" name="name" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("createProgramTemplate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

export function RenameProgramTemplateForm({ templateId, name }: { templateId: string; name: string }) {
  const t = useTranslations("Events");
  const initialState: ProgramTemplateFormState = {};
  const [state, formAction, pending] = useActionState(renameProgramTemplateAction, initialState);

  return (
    <form action={formAction} className="panel-form">
      <input type="hidden" name="templateId" value={templateId} />
      <label>
        {t("newProgramTemplateName")}
        <input type="text" name="name" required defaultValue={name} />
      </label>
      <button type="submit" disabled={pending}>
        {t("renameTemplateSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
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

export type ProgramTemplateItemDraft = { id?: string; startTime: string; endTime: string; label: string; location: string; participantLabels: string };

const EMPTY: ProgramTemplateItemDraft = { startTime: "", endTime: "", label: "", location: "", participantLabels: "" };

export function ProgramTemplateItemForm({ templateId, item }: { templateId: string; item?: ProgramTemplateItemDraft }) {
  const t = useTranslations("Events");
  const initialState: ProgramTemplateFormState = {};
  const [state, formAction, pending] = useActionState(saveProgramTemplateItemAction, initialState);
  // Champs contrôlés : React 19 réinitialise le formulaire après chaque action.
  const [draft, setDraft] = useState(item ?? EMPTY);
  useEffect(() => {
    if (state.success && !item?.id) setDraft(EMPTY);
  }, [state, item?.id]);
  const set = (field: keyof Omit<ProgramTemplateItemDraft, "id">) => (event: { target: { value: string } }) => setDraft({ ...draft, [field]: event.target.value });

  return (
    <form action={formAction} className="panel-form">
      <input type="hidden" name="templateId" value={templateId} />
      {item?.id ? <input type="hidden" name="itemId" value={item.id} /> : null}
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
        {item?.id ? t("saveTemplateLine") : t("addProgramTemplateItem")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("programTemplateItemAdded")}</p> : null}
    </form>
  );
}
