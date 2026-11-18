"use client";

// Lot 49 (EVT-04 premier pas, D2) — temps forts de l'évènement sur la synthèse de la fiche : nom,
// date, heure de début facultative, lieu facultatif parmi ceux de l'évènement.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { EventPlace, KeyMoment } from "@symbola/contracts";
import { addKeyMomentAction, removeKeyMomentAction, updateKeyMomentAction, type KeyMomentFormState } from "./key-moment-actions";

function Fields({ moment, places, defaultDate }: { moment?: KeyMoment; places: Pick<EventPlace, "id" | "label">[]; defaultDate: string | null }) {
  const t = useTranslations("Events");
  return (
    <>
      <label>
        {t("keyMomentName")}
        <input name="name" required maxLength={100} defaultValue={moment?.name ?? ""} placeholder={t("keyMomentNamePlaceholder")} />
      </label>
      <label>
        {t("keyMomentDate")}
        <input type="date" name="date" required defaultValue={moment?.date ?? defaultDate ?? ""} />
      </label>
      <label>
        {t("keyMomentTime")}
        <input type="time" name="startTime" defaultValue={moment?.startTime ?? ""} />
      </label>
      {places.length > 0 ? (
        <label>
          {t("keyMomentPlace")}
          <select name="placeId" defaultValue={moment?.placeId ?? ""}>
            <option value="">{t("keyMomentNoPlace")}</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}

export function AddKeyMomentForm({ eventId, places, defaultDate }: { eventId: string; places: Pick<EventPlace, "id" | "label">[]; defaultDate: string | null }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState(addKeyMomentAction, {} as KeyMomentFormState);
  return (
    <details>
      <summary>{t("keyMomentAdd")}</summary>
      <form action={action} className="stack">
        <input type="hidden" name="eventId" value={eventId} />
        <Fields places={places} defaultDate={defaultDate} />
        <button type="submit" disabled={pending}>
          {t("keyMomentAdd")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("keyMomentAdded")}</p> : null}
      </form>
    </details>
  );
}

export function EditKeyMomentForm({ eventId, moment, places }: { eventId: string; moment: KeyMoment; places: Pick<EventPlace, "id" | "label">[] }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState(updateKeyMomentAction, {} as KeyMomentFormState);
  return (
    <details>
      <summary>{t("keyMomentEdit", { name: moment.name })}</summary>
      <form action={action} className="stack">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="keyMomentId" value={moment.id} />
        <Fields moment={moment} places={places} defaultDate={null} />
        <button type="submit" disabled={pending}>
          {t("keyMomentSave")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("keyMomentSaved")}</p> : null}
      </form>
      <form action={removeKeyMomentAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="keyMomentId" value={moment.id} />
        <button type="submit" className="button-ghost">
          {t("keyMomentRemove", { name: moment.name })}
        </button>
      </form>
    </details>
  );
}
