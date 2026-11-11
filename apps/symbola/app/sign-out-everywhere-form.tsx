"use client";

// Lot 24b (SEC-06) — « Déconnecter tous mes autres appareils » (Mon compte,
// sécurité de l'espace des mariés).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signOutEverywhereAction, type SignOutEverywhereFormState } from "./sign-out-everywhere-actions";

export function SignOutEverywhereForm() {
  const t = useTranslations("SignOutEverywhere");
  const initialState: SignOutEverywhereFormState = {};
  const [state, formAction, pending] = useActionState(signOutEverywhereAction, initialState);

  return (
    <section aria-labelledby="sign-out-everywhere-title">
      <h2 id="sign-out-everywhere-title">{t("title")}</h2>
      <p>{t("intro")}</p>
      <form action={formAction}>
        <button type="submit" disabled={pending}>
          {t("submit")}
        </button>
      </form>
      {state.closed !== undefined ? <p role="status">{t("done", { count: state.closed })}</p> : null}
    </section>
  );
}
