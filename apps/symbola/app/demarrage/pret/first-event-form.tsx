"use client";

// Lot 33b (PAR-01, étape 5) — le premier évènement en trois réponses : type, prénoms des clients,
// date. Les libellés des clients suivent le type choisi (« les mariés » ou « le client »).
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { EventType } from "@/modules/events/service";
import type { Audience, ClientFieldLabels } from "@/lib/vocabulary";
import { SameDayNotice } from "@/app/events/same-day-notice";
import { createFirstEventAction, type FirstEventFormState } from "./actions";

export function FirstEventForm({ eventTypes, clientLabels }: { eventTypes: Pick<EventType, "id" | "label" | "audience">[]; clientLabels: Record<Audience, ClientFieldLabels> }) {
  const t = useTranslations("Onboarding");
  const tEvents = useTranslations("Events");
  const [state, action, pending] = useActionState<FirstEventFormState, FormData>(createFirstEventAction, {});
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id ?? "");
  const [eventDate, setEventDate] = useState("");
  const labels = clientLabels[eventTypes.find((type) => type.id === eventTypeId)?.audience ?? "couple"];

  return (
    <form action={action} className="stack">
      <label>
        {tEvents("eventType")}
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
        <input type="text" name="firstName1" required maxLength={120} autoComplete="off" />
      </label>
      <label>
        {labels.client2FirstName}
        <input type="text" name="firstName2" maxLength={120} autoComplete="off" />
      </label>
      <label>
        {tEvents("eventDate")}
        <input type="date" name="eventDate" required value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
      </label>
      <SameDayNotice date={eventDate} />
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" className="primary-button" disabled={pending}>
        {t("ready.firstEventSubmit")}
      </button>
    </form>
  );
}
