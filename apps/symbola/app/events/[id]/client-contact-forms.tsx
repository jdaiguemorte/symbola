"use client";

// Lot 14 (décisions I et K) — coordonnées de chaque client de l'événement,
// budget souhaité.
import Link from "next/link";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { EventClient, EventDetail } from "@/modules/events/service";
import { autosaveEventIdentityAction, setWantedBudgetAction, updateClientContactAction, type ClientContactFormState, setVenueAction } from "./client-contact-actions";
import { AutoSaveForm } from "@/app/ui/autosave-form";

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

// Lot 31b (FAC-04, DOC-02) — lieu de l'événement, pour la variable {evenement.lieu} du contrat
// (les lieux complets viennent au lot 34).
export function VenueForm({ eventId, venueName, venueCity }: { eventId: string; venueName: string | null; venueCity: string | null }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState<ClientContactFormState, FormData>(setVenueAction, {});
  return (
    <form action={action} aria-label={t("venueFormTitle")}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("venueName")}
        <input type="text" name="venueName" maxLength={200} defaultValue={venueName ?? ""} />
      </label>
      <label>
        {t("venueCity")}
        <input type="text" name="venueCity" maxLength={200} defaultValue={venueCity ?? ""} />
      </label>
      <button type="submit" disabled={pending}>
        {t("venueSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("venueSaved")}</p> : null}
    </form>
  );
}

// Lot 34b (EVT-03, D11) — fiche d'identité : invités estimés et confirmés (le nombre confirmé se
// saisit à la main jusqu'au module Invités), style, notes.
// Lot 39b (UX-09 ; D7, D8) : la fiche s'enregistre toute seule ; une modification faite entre-temps
// est fusionnée ou montrée en conflit (AutoSaveForm).
export function EventIdentityForm({ eventId, identity, version }: { eventId: string; identity: Pick<EventDetail, "guestsEstimated" | "guestsConfirmed" | "style" | "notes">; version: string }) {
  const t = useTranslations("Events");
  return (
    <AutoSaveForm
      action={autosaveEventIdentityAction}
      recordId={eventId}
      version={version}
      values={{ guestsEstimated: identity.guestsEstimated?.toString() ?? "", guestsConfirmed: identity.guestsConfirmed?.toString() ?? "", style: identity.style ?? "", notes: identity.notes ?? "" }}
      fieldLabels={{ guestsEstimated: t("guestsEstimated"), guestsConfirmed: t("guestsConfirmed"), style: t("eventStyle"), notes: t("eventNotes") }}
      ariaLabel={t("identityTitle")}
      submitLabel={t("identitySave")}
      savedLabel={t("identitySaved")}
      className="stack"
    >
      <div className="row-wrap">
        <label>
          {t("guestsEstimated")}
          <input type="number" name="guestsEstimated" min={0} max={100000} step={1} inputMode="numeric" defaultValue={identity.guestsEstimated ?? ""} />
        </label>
        <label>
          {t("guestsConfirmed")}
          <input type="number" name="guestsConfirmed" min={0} max={100000} step={1} inputMode="numeric" defaultValue={identity.guestsConfirmed ?? ""} />
        </label>
      </div>
      <label>
        {t("eventStyle")}
        <input type="text" name="style" maxLength={2000} defaultValue={identity.style ?? ""} />
      </label>
      <FreeTextNotice />
      <label>
        {t("eventNotes")}
        <textarea name="notes" maxLength={10000} rows={4} defaultValue={identity.notes ?? ""} />
      </label>
      <FreeTextNotice />
    </AutoSaveForm>
  );
}
