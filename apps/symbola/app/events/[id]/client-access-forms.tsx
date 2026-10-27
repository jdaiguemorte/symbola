"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { inviteClientAction, type ClientAccessFormState } from "./client-access-actions";

export function InviteClientForm({ eventId }: { eventId: string }) {
  const t = useTranslations("Events");
  const initialState: ClientAccessFormState = {};
  const [state, formAction, pending] = useActionState(inviteClientAction, initialState);
  // Champ contrôlé : React 19 réinitialise le formulaire après chaque action.
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (state.success) setEmail("");
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("clientEmail")}
        <input
          type="email"
          name="email"
          required
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <button type="submit" disabled={pending}>
        {t("inviteClient")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{state.linked ? t("clientLinked") : t("clientInvited")}</p> : null}
    </form>
  );
}
