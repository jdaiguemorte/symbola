"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction, type LoginFormState } from "./actions";

export default function LoginPage() {
  const t = useTranslations("Login");
  const initialState: LoginFormState = {};
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main>
      <h1>{t("title")}</h1>
      <form action={formAction}>
        <label>
          {t("email")}
          <input type="email" name="email" required />
        </label>
        <label>
          {t("password")}
          <input type="password" name="password" required />
        </label>
        <button type="submit" disabled={pending}>
          {t("submit")}
        </button>
      </form>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </main>
  );
}
