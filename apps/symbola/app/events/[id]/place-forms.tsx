"use client";

// Lot 12 (EVT-15) — ajouter un lieu de l'événement.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addPlaceAction, type PlaceFormState } from "./place-actions";

export function AddPlaceForm({ eventId, suggestions }: { eventId: string; suggestions: { label: string; vendorId: string | null }[] }) {
  const t = useTranslations("Events");
  const initial: PlaceFormState = {};
  const [state, action, pending] = useActionState(addPlaceAction, initial);
  return (
    <div className="stack">
      {suggestions.length > 0 ? (
        <div className="row-wrap">
          {suggestions.map((suggestion) => (
            <form key={suggestion.label} action={action}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="label" value={suggestion.label} />
              <input type="hidden" name="vendorId" value={suggestion.vendorId ?? ""} />
              <button type="submit" disabled={pending}>
                {t("addSuggestedPlace", { place: suggestion.label })}
              </button>
            </form>
          ))}
        </div>
      ) : null}
      <form action={action} className="inline-add">
        <input type="hidden" name="eventId" value={eventId} />
        <label>
          {t("placeLabel")}
          <input type="text" name="label" required />
        </label>
        <label>
          {t("placeAddress")}
          <input type="text" name="address" />
        </label>
        <button type="submit" disabled={pending}>
          {t("addPlace")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status" className="saved">{t("placeAdded")}</p> : null}
      </form>
    </div>
  );
}
