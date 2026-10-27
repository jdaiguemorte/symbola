"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { HelpButton } from "@symbola/ui";
import { loginAction, type LoginFormState } from "./actions";

export default function LoginPage() {
  const t = useTranslations("Login");
  const tHelp = useTranslations("Help");
  const initialState: LoginFormState = {};
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main>
      <h1>{t("title")}</h1>
      <HelpButton title={tHelp("login.title")} body={tHelp("login.body")} />
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
