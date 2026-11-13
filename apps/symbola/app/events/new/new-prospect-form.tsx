"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createProspectAction, type NewProspectFormState } from "./actions";
import type { EventType, ProspectSource } from "@/modules/events/service";
import type { Audience, ClientFieldLabels } from "@/lib/vocabulary";
import { SameDayNotice } from "../same-day-notice";

export function NewProspectForm({
  sources,
  eventTypes,
  clientLabels,
  initialDate = "",
  confirmed = false,
}: {
  sources: ProspectSource[];
  eventTypes: EventType[];
  // Lot 16 (ADR 0045) : les libellés des clients suivent le type choisi.
  clientLabels: Record<Audience, ClientFieldLabels>;
  initialDate?: string;
  confirmed?: boolean;
}) {
  const t = useTranslations("Events");
  const initialState: NewProspectFormState = {};
  const [state, formAction, pending] = useActionState(createProspectAction, initialState);
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id ?? "");
  // Lot 32b (CRM-04) : la date suivie, pour signaler les évènements du même jour avant l'enregistrement.
  const [eventDate, setEventDate] = useState(initialDate);
  const labels = clientLabels[eventTypes.find((type) => type.id === eventTypeId)?.audience ?? "couple"];

  return (
    <form action={formAction}>
      {confirmed ? <input type="hidden" name="confirmed" value="1" /> : null}
      <label>
        {t("eventType")}
        <select name="eventTypeId" required value={eventTypeId} onChange={(event) => setEventTypeId(event.target.value)}>
          {eventTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {labels.client1FirstName}
        <input type="text" name="firstName1" required />
      </label>
      <label>
        {labels.client1LastName}
        <input type="text" name="lastName1" />
      </label>
      <label>
        {labels.client2FirstName}
        <input type="text" name="firstName2" />
      </label>
      <label>
        {labels.client2LastName}
        <input type="text" name="lastName2" />
      </label>
      <label>
        {t("source")}
        <select name="prospectSourceId" required defaultValue="">
          <option value="" disabled>
            {t("sourceChoose")}
          </option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("eventDate")}
        <input type="date" name="eventDate" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
      </label>
      <SameDayNotice date={eventDate} />
      <label>
        {t("venueName")}
        <input type="text" name="venueName" />
      </label>
      <label>
        {t("venueCity")}
        <input type="text" name="venueCity" />
      </label>
      <button type="submit" disabled={pending}>
        {t(confirmed ? "createConfirmedEvent" : "createProspect")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
