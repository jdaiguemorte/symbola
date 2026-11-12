"use client";

// Lot 30a (JRJ-03, décision D4) — ajouter un contact du jour J (nom, rôle, téléphone).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addDayContactAction, type DayContactFormState } from "./day-contact-actions";

export function AddDayContactForm({ eventId }: { eventId: string }) {
  const t = useTranslations("DayContacts");
  const [state, action, pending] = useActionState(addDayContactAction, {} as DayContactFormState);
  return (
    <form action={action} className="inline-add">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("name")}
        <input type="text" name="name" maxLength={120} required />
      </label>
      <label>
        {t("role")}
        <input type="text" name="role" maxLength={120} />
      </label>
      <label>
        {t("phone")}
        <input type="tel" name="phone" maxLength={40} autoComplete="off" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("add")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? (
        <p role="status" className="saved">
          {t("added")}
        </p>
      ) : null}
    </form>
  );
}
