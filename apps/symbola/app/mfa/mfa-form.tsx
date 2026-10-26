"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { confirmMfaAction, type MfaFormState } from "./actions";

export function MfaForm() {
  const t = useTranslations("Mfa");
  const initialState: MfaFormState = {};
  const [state, formAction, pending] = useActionState(confirmMfaAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("code")}
        <input type="text" name="code" inputMode="numeric" pattern="[0-9]{6}" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("submit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
