"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { DraftKeeper } from "@/app/ui/draft-keeper";
import { createProspectAction, type NewProspectFormState } from "./actions";
import type { EventType, ProspectSource } from "@/modules/events/service";
import type { Audience, ClientFieldLabels } from "@/lib/vocabulary";
import type { ContactChoice } from "@/app/contacts/actions";
import { ContactPicker } from "@/app/contacts/contact-picker";
import { SameDayNotice } from "../same-day-notice";

export function NewProspectForm({
  sources,
  eventTypes,
  clientLabels,
  initialContact = null,
  initialDate = "",
  confirmed = false,
}: {
  sources: ProspectSource[];
  eventTypes: EventType[];
  // Lot 16 (ADR 0045) : les libellés des clients suivent le type choisi.
  clientLabels: Record<Audience, ClientFieldLabels>;
  // Lot 36a (UX-02) : premier client déjà choisi (depuis la fiche d'un contact).
  initialContact?: ContactChoice | null;
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
  // Lot 36a (UX-02) : un contact choisi remplace la saisie de son nom.
  const tContacts = useTranslations("Contacts");

  return (
    <form action={formAction}>
      {/* Lot 39b (UX-09) : la saisie est gardée et se reprend sur tout appareil. */}
      <DraftKeeper formKey="event-new" submission={state} />
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
      <ContactPicker name="contactId1" legend={tContacts("pickerClient1")} initial={initialContact}>
        <label>
          {labels.client1FirstName}
          <input type="text" name="firstName1" required />
        </label>
        <label>
          {labels.client1LastName}
          <input type="text" name="lastName1" />
        </label>
      </ContactPicker>
      <ContactPicker name="contactId2" legend={tContacts("pickerClient2")}>
        <label>
          {labels.client2FirstName}
          <input type="text" name="firstName2" />
        </label>
        <label>
          {labels.client2LastName}
          <input type="text" name="lastName2" />
        </label>
      </ContactPicker>
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
