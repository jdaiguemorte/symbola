"use client";

// Lot 34a (EVT-05, ARC-17 ; D9) — le fuseau de l'évènement. Lot 72d : confirmer un report passe par
// « Fixer la nouvelle date… » de la frise (status-timeline.tsx), clôturer par la liste de clôture.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setEventTimeZoneAction, type ChangeStatusFormState } from "./actions";

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
