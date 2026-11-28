"use client";

// Lot 70e (EVT-01, EVT-07, CRM-03 ; A14) — ce que « Nouvel évènement » ne demande plus : la source du
// prospect, et un (second) client, se complètent ici, depuis la fiche, onglet des mariés.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ContactPicker } from "@/app/contacts/contact-picker";
import { addEventClientAction, setEventSourceAction, type EventOriginFormState } from "./event-origin-actions";

export function EventSourceForm({ eventId, sources, current }: { eventId: string; sources: { id: string; label: string }[]; current: string | null }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState<EventOriginFormState, FormData>(setEventSourceAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("source")}
        {/* Lot 72d : la source enregistrée reste affichée (React remet le formulaire à zéro après l'envoi :
            la liste repart de sa nouvelle valeur, pas de celle d'avant). */}
        <select key={current ?? "none"} name="prospectSourceId" defaultValue={current ?? ""}>
          <option value="">{t("sourceNone")}</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="button-secondary" disabled={pending}>
        {t("sourceSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("sourceSaved")}</p> : null}
    </form>
  );
}

export function AddClientForm({ eventId, labels }: { eventId: string; labels: { firstName: string; lastName: string } }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState<EventOriginFormState, FormData>(addEventClientAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <ContactPicker name="contactId" legend={t("addClientTitle")} searchLabel={t("newClientHint")}>
        <label>
          {labels.firstName}
          <input type="text" name="firstName" autoComplete="off" />
        </label>
        <label>
          {labels.lastName}
          <input type="text" name="lastName" autoComplete="off" />
        </label>
      </ContactPicker>
      <button type="submit" className="button-secondary" disabled={pending}>
        {t("addClientSubmit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("clientAdded")}</p> : null}
    </form>
  );
}
