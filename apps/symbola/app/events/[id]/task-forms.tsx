"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { EventTask, TaskTemplate } from "@/modules/events/service";
import {
  addEventTaskAction,
  applyTaskTemplateAction,
  changeEventDateAction,
  updateEventTaskAction,
  type TaskFormState,
} from "./task-actions";
import { RESPONSIBLE_LABEL_KEYS, responsibleValue, type TaskMemberOption } from "./task-responsible";
import { SameDayNotice } from "../same-day-notice";

// Lot 34b (CHR-02, D12) : prestataires engagés sur l'événement, à qui une tâche peut être confiée.
export type TaskVendorOption = { candidateId: string; name: string };


// Lot 70a (CHR-02 ; A1, A3, A4) : « Vous », chaque collègue par son nom, les clients, chaque prestataire
// retenu. Une tâche restée à un accès retiré, ou sans personne nommée, garde sa valeur (choix désactivé).
export function ResponsibleSelect({ value, onChange, vendors, members = [] }: { value: string; onChange: (value: string) => void; vendors: TaskVendorOption[]; members?: TaskMemberOption[] }) {
  const t = useTranslations("Events");
  const active = members.filter((member) => !member.removed);
  const removed = members.find((member) => member.removed && `member:${member.id}` === value);
  const known = value === "clients" || active.some((member) => `member:${member.id}` === value) || vendors.some((vendor) => `vendor:${vendor.candidateId}` === value) || (value === "planner" && active.length === 0);
  return (
    <label>
      {t("taskResponsible")}
      <select name="responsible" value={value} onChange={(event) => onChange(event.target.value)}>
        {active.length === 0 ? <option value="planner">{t(RESPONSIBLE_LABEL_KEYS.planner)}</option> : null}
        {active.map((member) => (
          <option key={member.id} value={`member:${member.id}`}>
            {member.me ? t("responsibleYou") : member.name}
          </option>
        ))}
        <option value="clients">{t(RESPONSIBLE_LABEL_KEYS.clients)}</option>
        {vendors.map((vendor) => (
          <option key={vendor.candidateId} value={`vendor:${vendor.candidateId}`}>
            {t("responsibleVendorNamed", { name: vendor.name })}
          </option>
        ))}
        {/* Prestataire retiré de l'événement, accès retiré (A4) ou personne nommée : la tâche reste à confier. */}
        {!known ? (
          <option value={value} disabled>
            {removed ? t("responsibleMemberRemoved", { name: removed.name }) : value === "planner" ? t("responsibleNobody") : t("responsibleVendorRemoved")}
          </option>
        ) : null}
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
        <input type="date" name="eventDate" className="field-date" value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      {/* Lot 32b (CRM-04) : les autres évènements du même jour, avant d'enregistrer. */}
      <SameDayNotice date={value} excludeEventId={eventId} />
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

export function AddEventTaskForm({ eventId, vendors = [], members = [] }: { eventId: string; vendors?: TaskVendorOption[]; members?: TaskMemberOption[] }) {
  const t = useTranslations("Events");
  const initialState: TaskFormState = {};
  const [state, formAction, pending] = useActionState(addEventTaskAction, initialState);
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  // Lot 70a (A3) : par défaut, « Vous ».
  const me = members.find((member) => member.me && !member.removed);
  const [responsible, setResponsible] = useState(me ? `member:${me.id}` : "planner");
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
        {/* Lot 62c (UX-12) : la tâche, son échéance (champ court) et son responsable sur une ligne. */}
        <div className="field-row">
          <label>
            {t("taskLabel")}
            <input type="text" name="label" required value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label className="field-fit">
            {t("taskDueDate")}
            <input type="date" name="dueDate" className="field-date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <ResponsibleSelect value={responsible} onChange={setResponsible} vendors={vendors} members={members} />
        </div>
        <button type="submit" className="button-secondary" disabled={pending}>
          {t("addTask")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("taskAdded")}</p> : null}
      </fieldset>
    </form>
  );
}

export function EditEventTaskForm({ eventId, task, vendors = [], members = [] }: { eventId: string; task: EventTask; vendors?: TaskVendorOption[]; members?: TaskMemberOption[] }) {
  const t = useTranslations("Events");
  const initialState: TaskFormState = {};
  const [state, formAction, pending] = useActionState(updateEventTaskAction, initialState);
  const [label, setLabel] = useState(task.label);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [responsible, setResponsible] = useState(responsibleValue(task));

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
            <input type="date" name="dueDate" className="field-date" required value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <ResponsibleSelect value={responsible} onChange={setResponsible} vendors={vendors} members={members} />
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
