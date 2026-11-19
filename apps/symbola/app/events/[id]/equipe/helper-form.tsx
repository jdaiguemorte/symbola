"use client";

// Lot 52 (EVT-06, D3) — ajouter un renfort du jour J : nom, e-mail (le code d'ouverture y part),
// téléphone facultatif (annuaire du jour).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addDayHelperAction, type AddHelperState } from "./actions";

export function DayHelperForm({ eventId }: { eventId: string }) {
  const t = useTranslations("EventTeam");
  const [state, action, pending] = useActionState<AddHelperState, FormData>(addDayHelperAction, {});
  return (
    <form action={action} className="stack" key={state.sent ? "sent" : "form"}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("helperName")}
        <input type="text" name="personName" required maxLength={120} autoComplete="off" />
      </label>
      <label>
        {t("helperEmail")}
        <input type="email" name="email" required maxLength={254} autoComplete="off" />
      </label>
      <label>
        {t("helperPhone")}
        <input type="tel" name="phone" maxLength={40} autoComplete="off" />
      </label>
      <p className="muted">{t("helperHint")}</p>
      <button type="submit" disabled={pending}>
        {t("helperAdd")}
      </button>
      {state.error ? <p role="alert">{t(`helperError.${state.error}`)}</p> : null}
      {state.sent ? <p role="status">{t("helperSent")}</p> : null}
    </form>
  );
}
