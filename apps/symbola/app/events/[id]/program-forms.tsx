"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { EventVendorSlot, ProgramItem, ProgramTemplate } from "@/modules/events/service";
import {
  addProgramItemAction,
  applyProgramTemplateAction,
  updateProgramItemAction,
  type ProgramFormState,
} from "./program-actions";

type Draft = {
  startTime: string;
  endTime: string;
  label: string;
  location: string;
  internalNote: string;
  vendorSlotIds: string[];
  freeParticipants: string;
};

const EMPTY_DRAFT: Draft = {
  startTime: "",
  endTime: "",
  label: "",
  location: "",
  internalNote: "",
  vendorSlotIds: [],
  freeParticipants: "",
};

function draftOf(item: ProgramItem): Draft {
  return {
    startTime: item.startTime,
    endTime: item.endTime ?? "",
    label: item.label,
    location: item.location ?? "",
    internalNote: item.internalNote ?? "",
    vendorSlotIds: item.participants.flatMap((participant) => (participant.vendorSlotId ? [participant.vendorSlotId] : [])),
    freeParticipants: item.participants
      .filter((participant) => participant.vendorSlotId === null)
      .map((participant) => participant.label)
      .join(", "),
  };
}

// Champs contrôlés : React 19 réinitialise le formulaire après chaque
// action, une erreur ferait sinon perdre la saisie.
function ProgramItemFields({
  draft,
  setDraft,
  vendorSlots,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  vendorSlots: EventVendorSlot[];
}) {
  const t = useTranslations("Events");
  const set = (field: keyof Omit<Draft, "vendorSlotIds">) => (event: { target: { value: string } }) =>
    setDraft({ ...draft, [field]: event.target.value });

  return (
    <>
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
      {vendorSlots.length > 0 ? (
        <fieldset>
          <legend>{t("programVendorParticipants")}</legend>
          {vendorSlots.map((slot) => (
            <label key={slot.id}>
              <input
                type="checkbox"
                name="vendorSlotIds"
                value={slot.id}
                checked={draft.vendorSlotIds.includes(slot.id)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    vendorSlotIds: event.target.checked
                      ? [...draft.vendorSlotIds, slot.id]
                      : draft.vendorSlotIds.filter((id) => id !== slot.id),
                  })
                }
              />
              {slot.label}
            </label>
          ))}
        </fieldset>
      ) : null}
      <label>
        {t("programFreeParticipants")}
        <input type="text" name="freeParticipants" value={draft.freeParticipants} onChange={set("freeParticipants")} />
      </label>
      <label>
        {t("programInternalNote")}
        <textarea name="internalNote" value={draft.internalNote} onChange={set("internalNote")} />
      </label>
    </>
  );
}

export function AddProgramItemForm({ eventId, vendorSlots }: { eventId: string; vendorSlots: EventVendorSlot[] }) {
  const t = useTranslations("Events");
  const initialState: ProgramFormState = {};
  const [state, formAction, pending] = useActionState(addProgramItemAction, initialState);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  // Une ligne ajoutée vide le formulaire pour la suivante.
  useEffect(() => {
    if (state.success) setDraft(EMPTY_DRAFT);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <fieldset>
        <legend>{t("newProgramItem")}</legend>
        <ProgramItemFields draft={draft} setDraft={setDraft} vendorSlots={vendorSlots} />
        <button type="submit" disabled={pending}>
          {t("addProgramItem")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("programItemAdded")}</p> : null}
      </fieldset>
    </form>
  );
}

export function EditProgramItemForm({
  eventId,
  item,
  vendorSlots,
}: {
  eventId: string;
  item: ProgramItem;
  vendorSlots: EventVendorSlot[];
}) {
  const t = useTranslations("Events");
  const initialState: ProgramFormState = {};
  const [state, formAction, pending] = useActionState(updateProgramItemAction, initialState);
  const [draft, setDraft] = useState<Draft>(() => draftOf(item));

  return (
    <details>
      <summary>{t("editProgramItem", { label: item.label })}</summary>
      <form action={formAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="itemId" value={item.id} />
        <fieldset>
          <legend>{item.label}</legend>
          <ProgramItemFields draft={draft} setDraft={setDraft} vendorSlots={vendorSlots} />
          <button type="submit" disabled={pending}>
            {t("saveProgramItem")}
          </button>
          {state.error ? <p role="alert">{state.error}</p> : null}
          {state.success ? <p role="status">{t("programItemSaved")}</p> : null}
        </fieldset>
      </form>
    </details>
  );
}

export function ApplyProgramTemplateForm({ eventId, templates }: { eventId: string; templates: ProgramTemplate[] }) {
  const t = useTranslations("Events");
  const initialState: ProgramFormState = {};
  const [state, formAction, pending] = useActionState(applyProgramTemplateAction, initialState);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("programTemplateToApply")}
        <select name="templateId" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("applyProgramTemplate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("programTemplateApplied")}</p> : null}
    </form>
  );
}
