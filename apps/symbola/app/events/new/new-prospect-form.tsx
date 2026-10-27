"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createProspectAction, type NewProspectFormState } from "./actions";
import type { ProspectSource } from "@/modules/events/service";

export function NewProspectForm({ sources }: { sources: ProspectSource[] }) {
  const t = useTranslations("Events");
  const initialState: NewProspectFormState = {};
  const [state, formAction, pending] = useActionState(createProspectAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("client1FirstName")}
        <input type="text" name="firstName1" required />
      </label>
      <label>
        {t("client1LastName")}
        <input type="text" name="lastName1" />
      </label>
      <label>
        {t("client2FirstName")}
        <input type="text" name="firstName2" />
      </label>
      <label>
        {t("client2LastName")}
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
      {sources.length === 0 ? <p role="status">{t("noSourcesYet")}</p> : null}
      <label>
        {t("eventDate")}
        <input type="date" name="eventDate" />
      </label>
      <label>
        {t("venueName")}
        <input type="text" name="venueName" />
      </label>
      <label>
        {t("venueCity")}
        <input type="text" name="venueCity" />
      </label>
      <button type="submit" disabled={pending}>
        {t("createProspect")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
