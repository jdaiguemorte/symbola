"use client";

// Lot 34a (EVT-05, ARC-17 ; D3, D4, D7, D9) — gestes du cycle de vie sur la fiche : confirmer un
// report (après la liste des tâches qui tomberaient dans le passé, et le devis signé qui suit),
// clôturer un évènement passé, choisir le fuseau de l'évènement.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changeEventStatusAction, confirmPostponementAction, setEventTimeZoneAction, type ChangeStatusFormState } from "./actions";

export function ConfirmPostponementForm({ eventId, hasSignedQuote }: { eventId: string; hasSignedQuote: boolean }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState<ChangeStatusFormState, FormData>(confirmPostponementAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      {hasSignedQuote ? (
        <label className="choice-item">
          <input type="checkbox" name="shiftQuote" value="1" defaultChecked />
          <span>{t("postponementShiftQuote")}</span>
        </label>
      ) : null}
      <button type="submit" disabled={pending}>
        {t("confirmPostponement")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

export function CloseEventForm({ eventId }: { eventId: string }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState<ChangeStatusFormState, FormData>(changeEventStatusAction, {});
  return (
    <form action={action} className="row-wrap">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="toStatus" value="closed" />
      <button type="submit" disabled={pending}>
        {t("closeButton")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

export function TimeZoneForm({ eventId, timeZone, zones }: { eventId: string; timeZone: string; zones: string[] }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState<ChangeStatusFormState, FormData>(setEventTimeZoneAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("timeZoneLabel")}
        <select name="timeZone" defaultValue={timeZone}>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{t("timeZoneHint")}</p>
      <button type="submit" disabled={pending}>
        {t("timeZoneSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("timeZoneSaved")}</p> : null}
    </form>
  );
}
