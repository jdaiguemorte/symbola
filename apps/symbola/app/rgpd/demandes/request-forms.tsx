"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createRequestAction, extendRequestAction, type RequestFormState } from "./actions";

export function NewRequestForm({ types, today }: { types: readonly string[]; today: string }) {
  const t = useTranslations("Privacy");
  const initialState: RequestFormState = {};
  const [state, formAction, pending] = useActionState(createRequestAction, initialState);
  return (
    <form action={formAction}>
      <label>
        {t("requestTypeLabel")}
        <select name="type" required defaultValue="">
          <option value="" disabled>
            {t("requestTypePlaceholder")}
          </option>
          {types.map((type) => (
            <option key={type} value={type}>
              {t(`requestType.${type}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("personLabel")}
        <input type="text" name="personLabel" required maxLength={200} autoComplete="off" />
      </label>
      <label>
        {t("receivedOnLabel")}
        <input type="date" name="receivedOn" required defaultValue={today} max={today} />
      </label>
      <button type="submit" disabled={pending}>
        {t("createRequest")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("requestCreated")}</p> : null}
    </form>
  );
}

export function ExtendRequestForm({ requestId, personLabel }: { requestId: string; personLabel: string }) {
  const t = useTranslations("Privacy");
  const initialState: RequestFormState = {};
  const [state, formAction, pending] = useActionState(extendRequestAction, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="requestId" value={requestId} />
      <label>
        {t("extensionReasonLabel", { person: personLabel })}
        <textarea name="reason" required maxLength={2000} rows={2} />
      </label>
      <button type="submit" disabled={pending}>
        {t("extendRequest")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
