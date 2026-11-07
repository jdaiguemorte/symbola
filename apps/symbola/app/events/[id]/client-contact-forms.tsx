"use client";

// Lot 14 (décisions I et K) — coordonnées de chaque client de l'événement,
// budget souhaité.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { EventClient } from "@/modules/events/service";
import { setWantedBudgetAction, updateClientContactAction, type ClientContactFormState } from "./client-contact-actions";

export function ClientContactForm({ eventId, client }: { eventId: string; client: EventClient }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState<ClientContactFormState, FormData>(updateClientContactAction, {});
  const name = `${client.firstName} ${client.lastName ?? ""}`.trim();
  return (
    <form action={action} className="client-contact-form" aria-label={t("clientContactFormLabel", { name })}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="clientId" value={client.id} />
      <fieldset>
        <legend>{name}</legend>
        <label>
          {t("contactEmail")}
          <input type="email" name="email" defaultValue={client.email ?? ""} autoComplete="off" />
        </label>
        <label>
          {t("contactPhone")}
          <input type="tel" name="phone" defaultValue={client.phone ?? ""} autoComplete="off" />
        </label>
        <label>
          {t("contactAddressLine")}
          <input type="text" name="addressLine" defaultValue={client.addressLine ?? ""} autoComplete="off" />
        </label>
        <label>
          {t("contactPostalCode")}
          <input type="text" name="postalCode" defaultValue={client.postalCode ?? ""} autoComplete="off" />
        </label>
        <label>
          {t("contactCity")}
          <input type="text" name="city" defaultValue={client.city ?? ""} autoComplete="off" />
        </label>
      </fieldset>
      <button type="submit" disabled={pending}>
        {t("clientContactSave", { name })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("clientContactSaved")}</p> : null}
    </form>
  );
}

export function WantedBudgetForm({ eventId, wantedBudgetCents }: { eventId: string; wantedBudgetCents: number | null }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState<ClientContactFormState, FormData>(setWantedBudgetAction, {});
  const initial = wantedBudgetCents === null ? "" : `${Math.trunc(wantedBudgetCents / 100)}${wantedBudgetCents % 100 ? `,${String(wantedBudgetCents % 100).padStart(2, "0")}` : ""}`;
  return (
    <form action={action}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("wantedBudget")}
        <input type="text" inputMode="decimal" name="wantedBudget" defaultValue={initial} />
      </label>
      <button type="submit" disabled={pending}>
        {t("wantedBudgetSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("wantedBudgetSaved")}</p> : null}
    </form>
  );
}
