"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createLossReasonAction, type EventsSettingsFormState } from "./actions";

export function LossReasonForm() {
  const t = useTranslations("Events");
  const initialState: EventsSettingsFormState = {};
  const [state, formAction, pending] = useActionState(createLossReasonAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("newReasonLabel")}
        <input type="text" name="label" required />
      </label>
      <label>
        <input type="checkbox" name="isFreeText" />
        {t("reasonFreeText")}
      </label>
      <button type="submit" disabled={pending}>
        {t("addReason")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("reasonAdded")}</p> : null}
    </form>
  );
}
