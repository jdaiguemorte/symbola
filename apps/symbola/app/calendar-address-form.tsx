"use client";

// Lot 38b (HUB-29 ; D11 ; ADR 0072) — créer ou régénérer l'adresse secrète d'un flux de calendrier ;
// l'adresse s'affiche une seule fois, à copier dans son agenda. Le même composant reste en place
// quand l'adresse existe (la page se recharge), pour garder l'adresse affichée.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { issueCalendarAddressAction, type CalendarAddressState } from "./calendar-actions";

export function CalendarAddressForm({ eventId, hasActive, labels }: { eventId: string | null; hasActive: boolean; labels: { create: string; renew: string; form: string } }) {
  const t = useTranslations("Calendar");
  const initialState: CalendarAddressState = {};
  const [state, formAction, pending] = useActionState(issueCalendarAddressAction, initialState);
  const [copied, setCopied] = useState<number | null>(null);
  const fieldId = `calendar-address-${eventId ?? "person"}`;
  return (
    <form action={formAction} className="stack" aria-label={labels.form}>
      {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}
      <div className="row-wrap">
        <button type="submit" className={hasActive ? "button-ghost" : undefined} disabled={pending}>
          {hasActive ? labels.renew : labels.create}
        </button>
      </div>
      {hasActive ? <p className="meta">{t("regenerateHint")}</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.url ? (
        <div className="notice stack" role="status">
          <label htmlFor={fieldId}>{t("addressLabel")}</label>
          <input id={fieldId} type="text" readOnly value={state.url} onFocus={(event) => event.currentTarget.select()} />
          <p>{t("shownOnce")}</p>
          <div className="row-wrap">
            <button
              type="button"
              className="button-ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(state.url!);
                setCopied(state.at ?? 0);
              }}
            >
              {t("copy")}
            </button>
            {copied === (state.at ?? 0) ? <span>{t("copied")}</span> : null}
          </div>
        </div>
      ) : null}
    </form>
  );
}
