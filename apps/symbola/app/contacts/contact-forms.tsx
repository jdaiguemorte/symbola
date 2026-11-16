"use client";

// Lot 36a (CRM-03, DAT-12) — formulaires du contact : créer, modifier la fiche, annoter. Une adresse
// e-mail déjà prise renvoie vers le contact qui la porte. Lot 36b (D2) : un foyer ou une entreprise
// a un nom ; une entreprise, ses identifiants (SIREN ou SIRET, TVA) ; on y ajoute des personnes.
import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Contact, ContactInput, ContactKind } from "@symbola/contracts";
import {
  addContactMemberAction,
  addContactNoteAction,
  createContactAction,
  updateContactAction,
  type ContactFormState,
  type MemberFormState,
  type NoteFormState,
} from "./actions";
import { ContactPicker } from "./contact-picker";

const KINDS: readonly ContactKind[] = ["person", "household", "company"];

// Valeurs de départ : celles de la fiche, ou celles renvoyées après une erreur.
function ContactFields({ contact, kind }: { contact?: ContactInput | Contact; kind: ContactKind }) {
  const t = useTranslations("Contacts");
  return (
    <>
      {kind === "person" ? (
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
      ) : (
        <label>
          {t(kind === "company" ? "nameCompany" : "nameHousehold")}
          <input type="text" name="name" required maxLength={300} defaultValue={contact?.name ?? ""} autoComplete="off" />
        </label>
      )}
      {kind === "company" ? (
        <div className="form-row">
          <label>
            {t("companyIdNumber")}
            <input type="text" name="companyIdNumber" inputMode="numeric" maxLength={20} defaultValue={contact?.companyIdNumber ?? ""} autoComplete="off" />
          </label>
          <label>
            {t("vatNumber")}
            <input type="text" name="vatNumber" maxLength={20} defaultValue={contact?.vatNumber ?? ""} autoComplete="off" />
          </label>
        </div>
      ) : null}
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
  const [kind, setKind] = useState<ContactKind>("person");
  // Après une erreur, React vide le formulaire : il est reconstruit avec la nature et les valeurs
  // saisies (clé : la marque d'envoi).
  const round = state.at ?? 0;
  return (
    <form action={action} aria-label={t("newTitle")} className="stack">
      <fieldset key={round} className="row-wrap">
        <legend>{t("kindLegend")}</legend>
        {KINDS.map((option) => (
          <label key={option}>
            <input type="radio" name="kind" value={option} checked={kind === option} onChange={() => setKind(option)} />
            {t(`kind.${option}`)}
          </label>
        ))}
      </fieldset>
      <ContactFields key={`${kind}-${round}`} kind={kind} {...(state.values ? { contact: state.values } : {})} />
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
      <ContactFields key={state.at ?? 0} contact={state.error && state.values ? state.values : contact} kind={contact.kind} />
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

// Lot 36b (CRM-03, D2) — ajouter une personne à un foyer ou à une entreprise : choisie parmi les
// contacts (des personnes seulement), avec un rôle libre.
export function MemberForm({ groupContactId, kind }: { groupContactId: string; kind: ContactKind }) {
  const t = useTranslations("Contacts");
  const [state, action, pending] = useActionState<MemberFormState, FormData>(addContactMemberAction, {});
  // Après chaque ajout, le choix et le rôle repartent à vide.
  const round = state.addedAt ?? 0;
  return (
    <form action={action} aria-label={t(kind === "company" ? "memberAddCompany" : "memberAddHousehold")} className="stack">
      <input type="hidden" name="groupContactId" value={groupContactId} />
      <ContactPicker key={round} name="memberContactId" legend={t("memberPickerLegend")} kinds={["person"]} searchLabel={t("memberSearch")} />
      <label>
        {t("memberRole")}
        <input key={round} type="text" name="role" maxLength={100} autoComplete="off" />
      </label>
      <p className="meta">{t(kind === "company" ? "memberRoleHintCompany" : "memberRoleHintHousehold")}</p>
      <button type="submit" disabled={pending}>
        {t("memberAdd")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <p role="status">{state.addedAt ? t("memberAdded") : ""}</p>
    </form>
  );
}
