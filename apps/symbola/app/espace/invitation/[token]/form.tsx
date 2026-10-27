"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { acceptClientInvitationAction, type ClientInvitationFormState } from "./actions";

export function ClientInvitationForm({ token }: { token: string }) {
  const t = useTranslations("ClientSpace");
  const initialState: ClientInvitationFormState = {};
  const [state, formAction, pending] = useActionState(acceptClientInvitationAction, initialState);
  // Champs contrôlés : React 19 réinitialise le formulaire après chaque action.
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  if (state.success) {
    return (
      <p role="status">
        {t("accountCreated")} <Link href="/login">{t("goToLogin")}</Link>
      </p>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <label>
        {t("choosePassword")}
        <input
          type="password"
          name="password"
          required
          minLength={12}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        {t("confirmPassword")}
        <input
          type="password"
          name="passwordConfirmation"
          required
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </label>
      <button type="submit" disabled={pending}>
        {t("createAccount")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
