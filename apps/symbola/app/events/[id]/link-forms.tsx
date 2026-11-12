"use client";

// Lot 26a (UX-11, POR-01, POR-10 ; ADR 0053, décisions D3 et D10) — formulaires
// des liens personnels sur la fiche de l'événement. Le lien créé ou renouvelé
// n'est montré qu'une fois, avec « Copier le lien » ; seul son haché reste en base.
import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { LINK_RUBRICS, type LinkRubric } from "@symbola/contracts";
import { createLinkAction, renewLinkAction, updateLinkAction, type LinkFormState } from "./link-actions";

export type LinkFormClient = { id: string; name: string; email: string | null };
export type LinkFormSlot = { id: string; label: string };
export type LinkFormProfile = { key: string; label: string; budgetScope: "all" | "selected" };
export type EditableLink = {
  id: string;
  personName: string;
  email: string;
  eventClientId: string | null;
  rubrics: LinkRubric[];
  budgetScope: "all" | "selected";
  sharedSlotIds: string[];
  customExpiresOn: string | null;
};

function LinkDelivered({ state }: { state: LinkFormState }) {
  const t = useTranslations("Events");
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  if (!state.success || !state.url) return null;
  return (
    <div className="link-delivered" role="status">
      <p>{state.renewed ? t("linkRenewed", { email: state.email ?? "" }) : t("linkCreated", { email: state.email ?? "" })}</p>
      <label>
        {t("linkUrlLabel", { name: state.name ?? "" })}
        <input type="text" readOnly value={state.url} onFocus={(event) => event.currentTarget.select()} />
      </label>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(state.url!);
            setCopy("copied");
          } catch {
            setCopy("failed");
          }
        }}
      >
        {t("copyLink")}
      </button>
      <span className="meta">{copy === "copied" ? t("linkCopied") : copy === "failed" ? t("linkCopyFailed") : ""}</span>
      <p className="muted">{t("linkUrlOnce")}</p>
    </div>
  );
}

function SlotChoices({ slots, selected }: { slots: LinkFormSlot[]; selected: string[] }) {
  const t = useTranslations("Events");
  if (slots.length === 0) return null;
  return (
    <fieldset>
      <legend>{t("linkSharedSlots")}</legend>
      <p className="muted">{t("linkSharedSlotsHint")}</p>
      {slots.map((slot) => (
        <label key={slot.id} className="checkbox">
          <input type="checkbox" name="sharedSlotIds" value={slot.id} defaultChecked={selected.includes(slot.id)} />
          {slot.label}
        </label>
      ))}
    </fieldset>
  );
}

export function CreateLinkForm({ eventId, clients, slots, profiles }: { eventId: string; clients: LinkFormClient[]; slots: LinkFormSlot[]; profiles: LinkFormProfile[] }) {
  const t = useTranslations("Events");
  const [state, formAction, pending] = useActionState(createLinkAction, {} as LinkFormState);
  // Choisir un client de l'événement remplit son nom et son e-mail.
  const [person, setPerson] = useState({ clientId: "", name: "", email: "" });
  const [profileKey, setProfileKey] = useState(profiles[0]?.key ?? "");
  const profile = profiles.find((candidate) => candidate.key === profileKey);
  const ids = { person: useId(), profile: useId() };
  return (
    <form action={formAction} className="link-form">
      <h3>{t("createLinkTitle")}</h3>
      <input type="hidden" name="eventId" value={eventId} />
      <label htmlFor={ids.person}>{t("linkPerson")}</label>
      <select
          id={ids.person}
          name="eventClientId"
          value={person.clientId}
          onChange={(event) => {
            const client = clients.find((candidate) => candidate.id === event.target.value);
            setPerson(client ? { clientId: client.id, name: client.name, email: client.email ?? "" } : { clientId: "", name: "", email: "" });
          }}
        >
          <option value="">{t("linkPersonOther")}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
      </select>
      <label>
        {t("linkPersonName")}
        <input name="personName" required maxLength={120} value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} />
      </label>
      <label>
        {t("linkEmail")}
        <input type="email" name="email" required autoComplete="off" value={person.email} onChange={(event) => setPerson({ ...person, email: event.target.value })} />
      </label>
      <label htmlFor={ids.profile}>{t("linkProfile")}</label>
      <select id={ids.profile} name="profile" value={profileKey} onChange={(event) => setProfileKey(event.target.value)}>
        {profiles.map((candidate) => (
          <option key={candidate.key} value={candidate.key}>
            {candidate.label}
          </option>
        ))}
      </select>
      {profile?.budgetScope === "selected" ? <SlotChoices slots={slots} selected={[]} /> : null}
      <label>
        {t("linkExpiresOn")}
        <input type="date" name="customExpiresOn" />
      </label>
      <p className="muted">{t("linkExpiresOnHint")}</p>
      <button type="submit" className="primary" disabled={pending}>
        {t("createLink")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <LinkDelivered state={state} />
    </form>
  );
}

export function EditLinkForm({ eventId, link, clients, slots }: { eventId: string; link: EditableLink; clients: LinkFormClient[]; slots: LinkFormSlot[] }) {
  const t = useTranslations("Events");
  const [state, formAction, pending] = useActionState(updateLinkAction, {} as LinkFormState);
  const [scope, setScope] = useState(link.budgetScope);
  const personId = useId();
  return (
    <form action={formAction} className="link-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="linkId" value={link.id} />
      <label>
        {t("linkPersonName")}
        <input name="personName" required maxLength={120} defaultValue={link.personName} />
      </label>
      <label>
        {t("linkEmail")}
        <input type="email" name="email" required autoComplete="off" defaultValue={link.email} />
      </label>
      <label htmlFor={personId}>{t("linkPerson")}</label>
      <select id={personId} name="eventClientId" defaultValue={link.eventClientId ?? ""}>
        <option value="">{t("linkPersonOther")}</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
      <fieldset>
        <legend>{t("linkRubrics")}</legend>
        {LINK_RUBRICS.map((rubric) => (
          <label key={rubric} className="checkbox">
            <input type="checkbox" name="rubrics" value={rubric} defaultChecked={link.rubrics.includes(rubric)} />
            {t(`linkRubric.${rubric}`)}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t("linkBudgetScope")}</legend>
        <label className="checkbox">
          <input type="radio" name="budgetScope" value="all" checked={scope === "all"} onChange={() => setScope("all")} />
          {t("linkBudgetScopeAll")}
        </label>
        <label className="checkbox">
          <input type="radio" name="budgetScope" value="selected" checked={scope === "selected"} onChange={() => setScope("selected")} />
          {t("linkBudgetScopeSelected")}
        </label>
      </fieldset>
      {scope === "selected" ? <SlotChoices slots={slots} selected={link.sharedSlotIds} /> : null}
      <label>
        {t("linkExpiresOn")}
        <input type="date" name="customExpiresOn" defaultValue={link.customExpiresOn ?? ""} />
      </label>
      <button type="submit" disabled={pending}>
        {t("saveLink", { name: link.personName })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("linkSaved")}</p> : null}
    </form>
  );
}

export function RenewLinkForm({ eventId, linkId, personName }: { eventId: string; linkId: string; personName: string }) {
  const t = useTranslations("Events");
  const [state, formAction, pending] = useActionState(renewLinkAction, {} as LinkFormState);
  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="linkId" value={linkId} />
      <button type="submit" disabled={pending}>
        {t("renewLink", { name: personName })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <LinkDelivered state={state} />
    </form>
  );
}
