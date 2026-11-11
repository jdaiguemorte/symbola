"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { forgotPasswordAction, type ForgotPasswordFormState } from "./actions";
import { HoneypotField } from "@/app/ui/honeypot-field";

export function ForgotPasswordForm() {
  const t = useTranslations("PasswordReset");
  const initialState: ForgotPasswordFormState = {};
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  if (state.sent) return <p role="status">{t("sent")}</p>;

  return (
    <form action={formAction}>
        <HoneypotField />
      <label>
        {t("email")}
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("send")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
