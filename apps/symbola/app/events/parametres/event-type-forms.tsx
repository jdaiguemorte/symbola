"use client";

// Lot 16 (ADR 0045) — formulaires de la rubrique « Types d'événements ».
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { EventType } from "@/modules/events/service";
import { createEventTypeAction, removeEventTypeAction, updateEventTypeAction, type EventTypeFormState } from "./event-type-actions";

function AudienceSelect({ defaultValue, label }: { defaultValue: EventType["audience"]; label: string }) {
  const t = useTranslations("EventTypes");
  return (
    <select name="audience" defaultValue={defaultValue} aria-label={label}>
      <option value="couple">{t("audienceCouple")}</option>
      <option value="clients">{t("audienceClients")}</option>
    </select>
  );
}

function Feedback({ state, success }: { state: EventTypeFormState; success: string }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  return state.success ? <p role="status">{success}</p> : null;
}

export function EventTypeRow({ type, eventCount, others }: { type: EventType; eventCount: number; others: EventType[] }) {
  const t = useTranslations("EventTypes");
  const [updateState, updateAction, updatePending] = useActionState(updateEventTypeAction, {});
  const [removeState, removeAction, removePending] = useActionState(removeEventTypeAction, {});
  return (
    <tr>
      <th scope="row">
        <form action={updateAction} className="inline-form">
          <input type="hidden" name="eventTypeId" value={type.id} />
          <input type="text" name="label" defaultValue={type.label} required maxLength={80} aria-label={t("labelFor", { label: type.label })} />
          <AudienceSelect defaultValue={type.audience} label={t("audienceFor", { label: type.label })} />
          <button type="submit" disabled={updatePending} aria-label={t("saveFor", { label: type.label })}>
            {t("save")}
          </button>
          <Feedback state={updateState} success={t("saved")} />
        </form>
      </th>
      <td>{t("eventsCount", { count: eventCount })}</td>
      <td>
        {others.length > 0 ? (
          <form action={removeAction} className="inline-form">
            <input type="hidden" name="eventTypeId" value={type.id} />
            {eventCount > 0 ? (
              <select name="moveTo" required defaultValue="" aria-label={t("moveToFor", { label: type.label })}>
                <option value="" disabled>
                  {t("moveTo")}
                </option>
                {others.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.label}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="submit" className="button-ghost" disabled={removePending} aria-label={t("removeFor", { label: type.label })}>
              {t("remove")}
            </button>
            <Feedback state={removeState} success={t("removed")} />
          </form>
        ) : null}
      </td>
    </tr>
  );
}

export function AddEventTypeForm() {
  const t = useTranslations("EventTypes");
  const [state, action, pending] = useActionState(createEventTypeAction, {});
  return (
    <form action={action} className="stack">
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
