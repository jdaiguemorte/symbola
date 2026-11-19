"use client";

// Lot 55 (MSG-03 ; D3 ; ADR 0101) — formulaires de l'équipe : nouveau sujet, prestataires du sujet, et
// les deux zones d'écriture distinctes. La zone partagée nomme ses destinataires sur son bouton
// (« Envoyer à Léa et Maxime ») ; la zone interne dit qu'elle reste dans l'équipe. Elles postent vers
// deux routes différentes : rien ne choisit la visibilité dans un champ.
import { useActionState, useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";
import { createMessageTopicAction, setTopicVendorsAction, type MessageTopicFormState } from "./actions";

export function NewTopicForm({ eventId }: { eventId: string }) {
  const t = useTranslations("Messages");
  const [state, action, pending] = useActionState(createMessageTopicAction, {} as MessageTopicFormState);
  const id = useId();
  return (
    <form action={action} className="stack" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t("newTopicTitle")}</h2>
      <input type="hidden" name="eventId" value={eventId} />
      <label htmlFor={id}>{t("newTopicName")}</label>
      <input id={id} name="name" maxLength={120} required />
      <button type="submit" disabled={pending}>
        {t("createTopic")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

export function TopicVendorsForm({ eventId, topicId, choices, selected }: { eventId: string; topicId: string; choices: { linkId: string; name: string }[]; selected: string[] }) {
  const t = useTranslations("Messages");
  const [state, action, pending] = useActionState(setTopicVendorsAction, {} as MessageTopicFormState);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="topicId" value={topicId} />
      <fieldset>
        <legend>{t("vendorsTitle")}</legend>
        <p className="field-hint">{t("vendorsHint")}</p>
        {choices.map((choice) => (
          <label key={choice.linkId} className="checkbox">
            <input type="checkbox" name="vendorLinkIds" value={choice.linkId} defaultChecked={selected.includes(choice.linkId)} />
            {choice.name}
          </label>
        ))}
      </fieldset>
      <button type="submit" className="button-ghost" disabled={pending}>
        {t("saveVendors")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("vendorsSaved")}</p> : null}
    </form>
  );
}

function useResetOnSuccess(state: UploadState) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);
  return form;
}

export function SharedMessageForm({ endpoint, recipientsLabel, recipientsDigest }: { endpoint: string; recipientsLabel: string; recipientsDigest: string }) {
  const t = useTranslations("Messages");
  const [state, action, pending] = useUploadAction<UploadState>(endpoint);
  const form = useResetOnSuccess(state);
  const ids = { body: useId(), files: useId(), title: useId() };
  return (
    <form ref={form} action={action} className="composer composer-shared" aria-labelledby={ids.title}>
      <h3 id={ids.title}>{t("sharedZoneTitle")}</h3>
      <p className="field-hint">{t("sharedHint")}</p>
      <input type="hidden" name="recipientsDigest" value={recipientsDigest} />
      <label htmlFor={ids.body}>{t("sharedBodyLabel")}</label>
      <textarea id={ids.body} name="body" rows={5} maxLength={5000} required />
      <label htmlFor={ids.files}>{t("filesLabel")}</label>
      <input id={ids.files} type="file" name="files" multiple accept="application/pdf,image/*" />
      <button type="submit" className="primary" disabled={pending}>
        {t("sendTo", { names: recipientsLabel })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success && !state.error ? <p role="status">{t("sent")}</p> : null}
    </form>
  );
}

export function InternalNoteForm({ endpoint }: { endpoint: string }) {
  const t = useTranslations("Messages");
  const [state, action, pending] = useUploadAction<UploadState>(endpoint);
  const form = useResetOnSuccess(state);
  const ids = { body: useId(), files: useId(), title: useId() };
  return (
    <form ref={form} action={action} className="composer composer-internal" aria-labelledby={ids.title}>
      <h3 id={ids.title}>{t("internalZoneTitle")}</h3>
      <p className="field-hint">{t("internalHint")}</p>
      <label htmlFor={ids.body}>{t("internalBodyLabel")}</label>
      <textarea id={ids.body} name="body" rows={3} maxLength={5000} required />
      <label htmlFor={ids.files}>{t("filesLabel")}</label>
      <input id={ids.files} type="file" name="files" multiple accept="application/pdf,image/*" />
      <button type="submit" disabled={pending}>
        {t("saveInternal")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("internalSaved")}</p> : null}
    </form>
  );
}
