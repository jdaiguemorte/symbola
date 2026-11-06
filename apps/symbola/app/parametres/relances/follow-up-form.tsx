"use client";

// Lot 13 (HUB-15) — délais de relance du bloc « À traiter » de l'accueil.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { saveFollowUpDelaysAction, type FollowUpFormState } from "../actions";

export function FollowUpForm({ quoteDays, prospectDays }: { quoteDays: number; prospectDays: number }) {
  const t = useTranslations("Settings");
  const initialState: FollowUpFormState = {};
  const [state, formAction, pending] = useActionState(saveFollowUpDelaysAction, initialState);
  const [quote, setQuote] = useState(String(quoteDays));
  const [prospect, setProspect] = useState(String(prospectDays));

  return (
    <form action={formAction}>
      <label>
        {t("quoteFollowUpDays")}
        <input type="number" name="quoteFollowUpDays" min={1} max={365} value={quote} onChange={(event) => setQuote(event.target.value)} required />
      </label>
      <label>
        {t("prospectFollowUpDays")}
        <input type="number" name="prospectFollowUpDays" min={1} max={365} value={prospect} onChange={(event) => setProspect(event.target.value)} required />
      </label>
      <button type="submit" disabled={pending}>
        {t("saveFollowUpDelays")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("followUpDelaysSaved")}</p> : null}
    </form>
  );
}
