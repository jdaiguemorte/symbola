"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createProspectSourceAction, type EventsSettingsFormState } from "./actions";

export function ProspectSourceForm() {
  const t = useTranslations("Events");
  const initialState: EventsSettingsFormState = {};
  const [state, formAction, pending] = useActionState(createProspectSourceAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("newSourceLabel")}
        <input type="text" name="label" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("addSource")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("sourceAdded")}</p> : null}
    </form>
  );
}
