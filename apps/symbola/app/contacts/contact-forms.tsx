"use client";

// Lot 36a (CRM-03, DAT-12) — formulaires du contact : créer, modifier la fiche, annoter. Une adresse
// e-mail déjà prise renvoie vers le contact qui la porte.
import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { Contact } from "@symbola/contracts";
import { addContactNoteAction, createContactAction, updateContactAction, type ContactFormState, type NoteFormState } from "./actions";

function ContactFields({ contact }: { contact?: Contact }) {
  const t = useTranslations("Contacts");
  return (
    <>
      <div className="form-row">
        <label>
          {t("firstName")}
          <input type="text" name="firstName" required maxLength={300} defaultValue={contact?.firstName ?? ""} autoComplete="off" />
        </label>
        <label>
          {t("lastName")}
          <input type="text" name="lastName" maxLength={300} defaultValue={contact?.lastName ?? ""} autoComplete="off" />
        </label>
      </div>
      <div className="form-row">
        <label>
          {t("email")}
          <input type="email" name="email" maxLength={254} defaultValue={contact?.email ?? ""} autoComplete="off" />
        </label>
        <label>
          {t("phone")}
          <input type="tel" name="phone" maxLength={300} defaultValue={contact?.phone ?? ""} autoComplete="off" />
        </label>
      </div>
      <label>
        {t("addressLine")}
        <input type="text" name="addressLine" maxLength={300} defaultValue={contact?.addressLine ?? ""} autoComplete="off" />
      </label>
      <div className="form-row">
        <label>
          {t("postalCode")}
          <input type="text" name="postalCode" maxLength={300} defaultValue={contact?.postalCode ?? ""} autoComplete="off" />
        </label>
        <label>
          {t("city")}
          <input type="text" name="city" maxLength={300} defaultValue={contact?.city ?? ""} autoComplete="off" />
        </label>
        <label>
          {t("country")}
          <input type="text" name="country" maxLength={300} defaultValue={contact?.country ?? ""} autoComplete="off" />
        </label>
      </div>
      <label>
        {t("billingAddress")}
        <textarea name="billingAddress" rows={2} maxLength={1000} defaultValue={contact?.billingAddress ?? ""} />
      </label>
      <p className="meta">{t("billingAddressHint")}</p>
    </>
  );
}

function Feedback({ state }: { state: ContactFormState }) {
  const t = useTranslations("Contacts");
  return (
    <>
      {state.error ? (
        <p role="alert">
          {state.error}
          {state.existingContactId ? (
            <>
              {" "}
              <Link href={`/contacts/${state.existingContactId}`}>{t("openExisting")}</Link>
            </>
          ) : null}
        </p>
      ) : null}
      <p role="status">{state.saved ? t("saved") : ""}</p>
    </>
  );
}

export function NewContactForm() {
  const t = useTranslations("Contacts");
  const [state, action, pending] = useActionState<ContactFormState, FormData>(createContactAction, {});
  return (
    <form action={action} aria-label={t("newTitle")} className="stack">
      <ContactFields />
      <button type="submit" disabled={pending}>
        {t("create")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ContactForm({ contact }: { contact: Contact }) {
  const t = useTranslations("Contacts");
  const [state, action, pending] = useActionState<ContactFormState, FormData>(updateContactAction, {});
  return (
    <form action={action} aria-label={t("identityTitle")} className="stack">
      <input type="hidden" name="contactId" value={contact.id} />
      <ContactFields contact={contact} />
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function NoteForm({ contactId }: { contactId: string }) {
  const t = useTranslations("Contacts");
  const [state, action, pending] = useActionState<NoteFormState, FormData>(addContactNoteAction, {});
  return (
    <form action={action} aria-label={t("noteAdd")} className="stack" key={state.added ? "added" : "form"}>
      <input type="hidden" name="contactId" value={contactId} />
      <label>
        {t("noteBody")}
        <textarea name="body" rows={3} maxLength={2000} required />
      </label>
      <button type="submit" disabled={pending}>
        {t("noteAdd")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <p role="status">{state.added ? t("noteAdded") : ""}</p>
    </form>
  );
}
