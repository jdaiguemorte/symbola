"use client";

// Lot 12 (L12-EVT-15) — ajouter un lieu de l'événement. Lot 34b (EVT-03, D10) : modifier un lieu
// (adresse, ville, horaires, contact).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { EventPlace } from "@/modules/events/service";
import { addPlaceAction, updatePlaceAction, type PlaceFormState } from "./place-actions";

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
        <label>
          {t("placeCity")}
          <input type="text" name="city" maxLength={200} />
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

export function EditPlaceForm({ eventId, place }: { eventId: string; place: EventPlace }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState(updatePlaceAction, {} as PlaceFormState);
  return (
    <details className="place-edit">
      <summary>{t("editPlace", { place: place.label })}</summary>
      <form action={action} className="stack">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="placeId" value={place.id} />
        <label>
          {t("placeLabel")}
          <input type="text" name="label" required maxLength={200} defaultValue={place.label} />
        </label>
        <label>
          {t("placeAddress")}
          <input type="text" name="address" maxLength={500} defaultValue={place.address ?? ""} />
        </label>
        <label>
          {t("placeCity")}
          <input type="text" name="city" maxLength={200} defaultValue={place.city ?? ""} />
        </label>
        <div className="row-wrap">
          <label>
            {t("placeStartTime")}
            <input type="time" name="startTime" defaultValue={place.startTime ?? ""} />
          </label>
          <label>
            {t("placeEndTime")}
            <input type="time" name="endTime" defaultValue={place.endTime ?? ""} />
          </label>
        </div>
        <label>
          {t("placeContactName")}
          <input type="text" name="contactName" maxLength={200} defaultValue={place.contactName ?? ""} />
        </label>
        <label>
          {t("placeContactPhone")}
          <input type="tel" name="contactPhone" maxLength={40} defaultValue={place.contactPhone ?? ""} />
        </label>
        <label>
          {t("placeContactEmail")}
          <input type="email" name="contactEmail" maxLength={320} defaultValue={place.contactEmail ?? ""} />
        </label>
        <button type="submit" disabled={pending}>
          {t("savePlace")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("placeSaved")}</p> : null}
      </form>
    </details>
  );
}
