"use client";

// Lot 43 (BUD-06, D8) — ce que voit un payeur : sa part seule (par défaut), ou tout le budget.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setPayerVisibilityAction, type PayerVisibilityState } from "./actions";

export function PayerVisibilityForm({ payerId, name, ownShareOnly }: { payerId: string; name: string; ownShareOnly: boolean }) {
  const t = useTranslations("Payers");
  const [state, action, pending] = useActionState(setPayerVisibilityAction, {} as PayerVisibilityState);
  return (
    <form action={action} aria-label={t("visibilityFor", { name })}>
      <input type="hidden" name="payerId" value={payerId} />
      <fieldset>
        <legend>{t("visibilityFor", { name })}</legend>
        <label>
          <input type="radio" name="visibility" value="share" defaultChecked={ownShareOnly} /> {t("visibilityShare")}
        </label>
        <label>
          <input type="radio" name="visibility" value="all" defaultChecked={!ownShareOnly} /> {t("visibilityAll")}
        </label>
      </fieldset>
      <button type="submit" disabled={pending}>
        {t("visibilitySave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("visibilitySaved")}</p> : null}
    </form>
  );
}
