"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { confirmOwnershipAction, type ConfirmOwnershipState } from "./actions";

export function ConfirmOwnershipForm() {
  const t = useTranslations("Ownership");
  const [token, setToken] = useState("");
  const initial: ConfirmOwnershipState = {};
  const [state, formAction, pending] = useActionState(confirmOwnershipAction, initial);
  useEffect(() => {
    setToken(window.location.hash.replace(/^#/, ""));
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  if (state.outcome === "transferred") {
    return (
      <p role="status">
        {t("done")} <a href="/parametres/equipe">{t("openTeam")}</a>
      </p>
    );
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      {state.outcome ? <p role="alert">{t(`outcome.${state.outcome}`)}</p> : null}
      <button type="submit" disabled={pending || !token}>
        {t("confirm")}
      </button>
    </form>
  );
}
