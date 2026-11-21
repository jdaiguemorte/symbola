"use client";

// Lot 16 (ADR 0045) — formulaires de la rubrique « Types d'événements ».
// Lot 62b (UX-13, D1) : la liste est un tableau éditable. Le nom et « vos clients sont » s'enregistrent
// à la sortie du champ ; « Supprimer » est une action de ligne (un type qui a des évènements ouvre la
// ligne, le temps de choisir le type qui les reprend). Plus de « Enregistrer » par ligne.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { EventType } from "@/modules/events/service";
import { AutosaveList, useAutosaveList, useAutosaveRow } from "@/app/ui/autosave-list";
import { createEventTypeAction, removeEventTypeAction, updateEventTypeAction, type EventTypeFormState } from "./event-type-actions";

function Feedback({ state, success }: { state: EventTypeFormState; success: string }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  return state.success ? <p role="status">{success}</p> : null;
}

function EventTypeRow({ type, eventCount, others, removing, onRemoving }: { type: EventType; eventCount: number; others: EventType[]; removing: boolean; onRemoving: (open: boolean) => void }) {
  const t = useTranslations("EventTypes");
  const { run } = useAutosaveList();
  const { ref, rowProps } = useAutosaveRow((data) => updateEventTypeAction({}, data), { label: type.label, audience: type.audience });
  const [moveTo, setMoveTo] = useState("");

  const remove = (destination: string | null) => {
    const data = new FormData();
    data.set("eventTypeId", type.id);
    if (destination) data.set("moveTo", destination);
    void run({ apply: () => removeEventTypeAction({}, data) }).then((done) => {
      if (done) onRemoving(false);
    });
  };

  return (
    <>
      <div className="edit-row" role="row" ref={ref} {...rowProps}>
        <input type="hidden" name="eventTypeId" value={type.id} />
        <span role="cell" className="edit-cell">
          <span className="edit-cell-label" aria-hidden="true">
            {t("label")}
          </span>
          <input type="text" name="label" defaultValue={type.label} required maxLength={80} aria-label={t("labelFor", { label: type.label })} />
        </span>
        <span role="cell" className="edit-cell">
          <span className="edit-cell-label" aria-hidden="true">
            {t("audience")}
          </span>
          <select name="audience" defaultValue={type.audience} aria-label={t("audienceFor", { label: type.label })}>
            <option value="couple">{t("audienceCouple")}</option>
            <option value="clients">{t("audienceClients")}</option>
          </select>
        </span>
        <span role="cell" className="edit-cell-meta">
          {t("eventsCount", { count: eventCount })}
        </span>
        <span role="cell" className="row-actions">
          {others.length > 0 ? (
            <button type="button" className="button-ghost" aria-label={t("removeFor", { label: type.label })} aria-expanded={eventCount > 0 ? removing : undefined} onClick={() => (eventCount > 0 ? onRemoving(!removing) : remove(null))}>
              {t("remove")}
            </button>
          ) : null}
        </span>
      </div>
      {removing ? (
        <div className="edit-row-open" role="row">
          <div role="cell" className="form-inline">
            <label>
              {t("moveToFor", { label: type.label })}
              <select value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
                <option value="" disabled>
                  {t("moveToChoose")}
                </option>
                {others.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button-danger" disabled={moveTo === ""} onClick={() => remove(moveTo)}>
              {t("removeConfirm")}
            </button>
            <button type="button" className="button-ghost" onClick={() => onRemoving(false)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function EventTypeList({ types, counts }: { types: EventType[]; counts: Record<string, number> }) {
  const t = useTranslations("EventTypes");
  // Une seule ligne ouverte à la fois.
  const [removingId, setRemovingId] = useState<string | null>(null);
  return (
    <AutosaveList>
      <div className="edit-list-scroll settings-list" role="region" aria-label={t("tableLabel")}>
        <div className="edit-list event-types-list" role="table">
          <div className="edit-list-head" role="row">
            <span role="columnheader">{t("columnLabel")}</span>
            <span role="columnheader">{t("audience")}</span>
            <span role="columnheader">{t("columnEvents")}</span>
            <span role="columnheader">
              <span className="sr-only">{t("columnActions")}</span>
            </span>
          </div>
          {types.map((type) => (
            <EventTypeRow
              key={type.id}
              type={type}
              eventCount={counts[type.id] ?? 0}
              others={types.filter((other) => other.id !== type.id)}
              removing={removingId === type.id}
              onRemoving={(open) => setRemovingId(open ? type.id : null)}
            />
          ))}
        </div>
      </div>
    </AutosaveList>
  );
}

export function AddEventTypeForm() {
  const t = useTranslations("EventTypes");
  const [state, action, pending] = useActionState(createEventTypeAction, {});
  return (
    <form action={action} className="form-inline">
      <label>
        {t("label")}
        <input type="text" name="label" required maxLength={80} />
      </label>
      <label>
        {t("audience")}
        <select name="audience" defaultValue="clients">
          <option value="couple">{t("audienceCouple")}</option>
          <option value="clients">{t("audienceClients")}</option>
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("add")}
      </button>
      <Feedback state={state} success={t("added")} />
    </form>
  );
}
