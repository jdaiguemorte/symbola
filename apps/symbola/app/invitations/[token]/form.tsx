"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { acceptInvitationAction, type AcceptInvitationFormState } from "./actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const t = useTranslations("Invitation");
  const initialState: AcceptInvitationFormState = {};
  const [state, formAction, pending] = useActionState(acceptInvitationAction, initialState);

  if (state.success) {
    return <p role="status">{t("success")}</p>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <label>
        {t("choosePassword")}
        <input type="password" name="password" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("submit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
