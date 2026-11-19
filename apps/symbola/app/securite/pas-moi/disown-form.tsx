"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { disownDeviceAction, type DisownState } from "../actions";

export function DisownForm({ accountCenter }: { accountCenter: string }) {
  const t = useTranslations("Security");
  const [token, setToken] = useState("");
  const initial: DisownState = {};
  const [state, formAction, pending] = useActionState(disownDeviceAction, initial);
  useEffect(() => {
    setToken(window.location.hash.replace(/^#/, ""));
    // Le jeton quitte l'adresse affichée (historique, partage d'écran).
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  if (state.done) {
    return (
      <>
        <p role="status">{t("notMeDone")}</p>
        <p>
          <a className="button" href={accountCenter}>
            {t("notMeSecure")}
          </a>
        </p>
      </>
    );
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      {state.invalid ? <p role="alert">{t("notMeInvalid")}</p> : null}
      <button type="submit" disabled={pending || !token}>
        {t("notMeConfirm")}
      </button>
    </form>
  );
}
