"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPasswordAction, type ResetPasswordFormState } from "./actions";
import { HoneypotField } from "@/app/ui/honeypot-field";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("PasswordReset");
  const initialState: ResetPasswordFormState = {};
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  if (state.done) {
    return (
      <>
        <p role="status">{t("done")}</p>
        <p>
          <a href="/login">{t("backToLogin")}</a>
        </p>
      </>
    );
  }

  return (
    <form action={formAction}>
        <HoneypotField />
      <input type="hidden" name="token" value={token} />
      <label>
        {t("newPassword")}
        <input type="password" name="password" autoComplete="new-password" minLength={12} required />
      </label>
      <label>
        {t("confirmPassword")}
        <input type="password" name="confirmation" autoComplete="new-password" minLength={12} required />
      </label>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
