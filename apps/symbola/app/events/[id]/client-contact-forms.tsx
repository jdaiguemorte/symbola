"use client";

// Lot 14 (décisions I et K) — coordonnées de chaque client de l'événement (lot 72e : le budget souhaité, le
// lieu, la fiche d'identité et les notes passent dans « Modifier les informations »).
import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { EventClient } from "@/modules/events/service";
import { updateClientContactAction, type ClientContactFormState } from "./client-contact-actions";

export function ClientContactForm({ eventId, client }: { eventId: string; client: EventClient }) {
  const t = useTranslations("Events");
  const tContacts = useTranslations("Contacts");
  const [state, action, pending] = useActionState<ClientContactFormState, FormData>(updateClientContactAction, {});
  const name = `${client.firstName} ${client.lastName ?? ""}`.trim();
  // Lot 36a : un client retiré par le RGPD n'a plus de fiche.
  if (!client.contactId) return null;
  return (
    <form action={action} className="client-contact-form" aria-label={t("clientContactFormLabel", { name })}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="clientId" value={client.id} />
      <fieldset>
        <legend>{name}</legend>
        {/* Lot 36a (CRM-03) : ce sont les coordonnées du contact, partout dans l'organisation. */}
        <p className="meta">
          {tContacts("sharedHint")} <Link href={`/contacts/${client.contactId}`}>{tContacts("openContact", { name })}</Link>
        </p>
        {/* Lot 62c (UX-12) : formulaire en grille — e-mail et téléphone côte à côte ; adresse ; code postal et ville. */}
        <div className="form-grid">
          <label>
            {t("contactEmail")}
            <input type="email" name="email" defaultValue={client.email ?? ""} autoComplete="off" />
          </label>
          <label>
            {t("contactPhone")}
            <input type="tel" name="phone" defaultValue={client.phone ?? ""} autoComplete="off" />
          </label>
          <label className="span-all">
            {t("contactAddressLine")}
            <input type="text" name="addressLine" defaultValue={client.addressLine ?? ""} autoComplete="off" />
          </label>
          <div className="field-row span-all">
            <label className="field-fit">
              {t("contactPostalCode")}
              <input type="text" name="postalCode" className="field-code" defaultValue={client.postalCode ?? ""} autoComplete="off" />
            </label>
            <label>
              {t("contactCity")}
              <input type="text" name="city" defaultValue={client.city ?? ""} autoComplete="off" />
            </label>
          </div>
        </div>
        <div className="row-wrap">
          <button type="submit" className="button-secondary" disabled={pending}>
            {t("clientContactSave", { name })}
          </button>
          {state.error ? <p role="alert">{state.error}</p> : null}
          {state.success ? <p role="status">{t("clientContactSaved")}</p> : null}
        </div>
      </fieldset>
    </form>
  );
}
