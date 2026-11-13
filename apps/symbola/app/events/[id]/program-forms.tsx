"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import type { EventVendorSlot, ProgramItem, ProgramTemplate } from "@/modules/events/service";
import { endTimeAfter, minutesBetween } from "@/lib/program-spans";
import {
  addProgramItemAction,
  applyProgramTemplateAction,
  updateProgramItemAction,
  type ProgramFormState,
} from "./program-actions";

type Draft = {
  startTime: string;
  endTime: string;
  // Lot 30b (CHR-06, D7) : la durée et l'heure de fin se calculent l'une l'autre.
  durationMinutes: string;
  label: string;
  location: string;
  internalNote: string;
  responsible: string;
  vendorSlotIds: string[];
  freeParticipants: string;
};

const EMPTY_DRAFT: Draft = {
  startTime: "",
  endTime: "",
  durationMinutes: "",
  label: "",
  location: "",
  internalNote: "",
  responsible: "",
  vendorSlotIds: [],
  freeParticipants: "",
};

function draftOf(item: ProgramItem): Draft {
  return {
    startTime: item.startTime,
    endTime: item.endTime ?? "",
    durationMinutes: item.endTime ? String(minutesBetween(item.startTime, item.endTime)) : "",
    label: item.label,
    location: item.location ?? "",
    internalNote: item.internalNote ?? "",
    responsible: item.responsible ?? "",
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
  // Lot 30b (CHR-06, D7) : le début garde la durée ; la fin donne la durée ; la durée
  // donne la fin.
  const validDuration = (value: string) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 1440;
  const setStart = (event: { target: { value: string } }) => {
    const startTime = event.target.value;
    if (startTime && validDuration(draft.durationMinutes)) setDraft({ ...draft, startTime, endTime: endTimeAfter(startTime, Number(draft.durationMinutes)) });
    else setDraft({ ...draft, startTime });
  };
  const setEnd = (event: { target: { value: string } }) => {
    const endTime = event.target.value;
    const durationMinutes = endTime && draft.startTime ? String(minutesBetween(draft.startTime, endTime)) : endTime ? draft.durationMinutes : "";
    setDraft({ ...draft, endTime, durationMinutes });
  };
  const setDuration = (event: { target: { value: string } }) => {
    const durationMinutes = event.target.value;
    if (!durationMinutes) setDraft({ ...draft, durationMinutes, endTime: "" });
    else if (draft.startTime && validDuration(durationMinutes)) setDraft({ ...draft, durationMinutes, endTime: endTimeAfter(draft.startTime, Number(durationMinutes)) });
    else setDraft({ ...draft, durationMinutes });
  };

  return (
    <>
      <label>
        {t("programStartTime")}
        <input type="time" name="startTime" required value={draft.startTime} onChange={setStart} />
      </label>
      <label>
        {t("programEndTime")}
        <input type="time" name="endTime" value={draft.endTime} onChange={setEnd} />
      </label>
      <label>
        {t("programDuration")}
        <input type="number" name="durationMinutes" min={1} max={1440} step={1} inputMode="numeric" value={draft.durationMinutes} onChange={setDuration} />
      </label>
      <label>
        {t("programItemLabel")}
        <input type="text" name="label" required value={draft.label} onChange={set("label")} />
      </label>
      <label>
        {t("programLocation")}
        <input type="text" name="location" list="event-place-options" value={draft.location} onChange={set("location")} />
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
        {t("programResponsible")}
        <input type="text" name="responsible" maxLength={120} list="program-responsible-options" value={draft.responsible} onChange={set("responsible")} />
      </label>
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
    <details className="program-edit">
      <summary className="icon-button" title={t("editProgramItem", { label: item.label })}>
        <Pencil size={16} aria-hidden="true" />
        <span className="sr-only">{t("editProgramItem", { label: item.label })}</span>
      </summary>
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
