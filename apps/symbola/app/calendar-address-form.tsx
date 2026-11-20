"use client";

// Lot 38b (HUB-29 ; D11 ; ADR 0072) — créer ou régénérer l'adresse secrète d'un flux de calendrier ;
// l'adresse s'affiche une seule fois, à copier dans son agenda. Le même composant reste en place
// quand l'adresse existe (la page se recharge), pour garder l'adresse affichée.
// Lot 61 (retours de recette) : le retrait se fait ici aussi, pour que la zone de l'adresse
// disparaisse dès qu'elle est retirée (elle restait affichée alors que l'adresse ne répondait plus) ;
// l'adresse se copie d'un geste, à côté du champ, et les trois étapes pour l'ajouter à son agenda
// sont écrites sous l'adresse.
import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { issueCalendarAddressAction, revokeCalendarAddressStateAction, type CalendarAddressState } from "./calendar-actions";

export function CalendarAddressForm({ eventId, hasActive, labels }: { eventId: string | null; hasActive: boolean; labels: { create: string; renew: string; revoke: string; form: string } }) {
  const t = useTranslations("Calendar");
  const initialState: CalendarAddressState = {};
  const [state, formAction, pending] = useActionState(issueCalendarAddressAction, initialState);
  const [revoked, revokeAction, revoking] = useActionState(revokeCalendarAddressStateAction, initialState);
  const [copied, setCopied] = useState<number | null>(null);
  const fieldId = `calendar-address-${eventId ?? "person"}`;
  const revokeFormId = useId();
  const issuedAt = state.at ?? 0;
  const revokedAt = revoked.at ?? 0;
  // L'adresse n'est montrée que tant qu'elle répond : retirée, sa zone s'efface.
  const url = hasActive && state.url && issuedAt > revokedAt ? state.url : null;
  const error = issuedAt >= revokedAt ? state.error : revoked.error;
  return (
    <div className="calendar-address">
      <form action={formAction} className="stack" aria-label={labels.form}>
        {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}
        {url ? (
          <div className="notice stack" role="status">
            <label htmlFor={fieldId}>{t("addressLabel")}</label>
            <div className="copy-field">
              <input id={fieldId} type="text" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
              <button
                type="button"
                className="button-secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(url);
                  setCopied(issuedAt);
                }}
              >
                {t("copy")}
              </button>
            </div>
            {copied === issuedAt ? <p className="copy-done">{t("copied")}</p> : null}
            <p>{t("shownOnce")}</p>
            <ol className="calendar-steps">
              <li>{t("stepCopy")}</li>
              <li>
                {t("stepSubscribe")}
                <ul>
                  <li>{t("stepGoogle")}</li>
                  <li>{t("stepApple")}</li>
                  <li>{t("stepOutlook")}</li>
                </ul>
              </li>
              <li>{t("stepPaste")}</li>
            </ol>
            <p className="field-hint">{t("refreshDelay")}</p>
          </div>
        ) : null}
        {!hasActive && revoked.revoked && revokedAt > issuedAt ? <p role="status">{t("revoked")}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className="row-wrap">
          <button type="submit" className={hasActive ? "button-secondary" : "button-primary"} disabled={pending || revoking}>
            {hasActive ? labels.renew : labels.create}
          </button>
          {hasActive ? (
            <button type="submit" form={revokeFormId} className="button-ghost" disabled={pending || revoking}>
              {labels.revoke}
            </button>
          ) : null}
        </div>
        {hasActive ? <p className="field-hint">{t("regenerateHint")}</p> : null}
      </form>
      {/* Formulaire du retrait, à part (pas de formulaire dans un formulaire) ; son bouton est ci-dessus. */}
      <form id={revokeFormId} action={revokeAction} hidden>
        {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}
      </form>
    </div>
  );
}
