"use client";

// Lot 29b (JRJ-04, décision D8) — envoi d'un document de l'événement et renommage.
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";
import { renameEventDocumentAction, type EventDocumentFormState } from "./document-actions";

export function EventDocumentUploadForm({ eventId }: { eventId: string }) {
  const t = useTranslations("EventDocuments");
  const [state, action, pending] = useUploadAction<UploadState>(`/events/${eventId}/documents`);
  const ids = { label: useId(), file: useId() };
  return (
    <form action={action} className="stack">
      <label htmlFor={ids.label}>{t("label")}</label>
      <input id={ids.label} type="text" name="label" maxLength={200} placeholder={t("labelPlaceholder")} />
      <label htmlFor={ids.file}>{t("file")}</label>
      <input id={ids.file} type="file" name="file" accept="application/pdf,image/*" required />
      <button type="submit" disabled={pending}>
        {t("attach")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("attached")}</p> : null}
    </form>
  );
}

export function EventDocumentRenameForm({ eventId, documentId, label }: { eventId: string; documentId: string; label: string }) {
  const t = useTranslations("EventDocuments");
  const [state, action, pending] = useActionState(renameEventDocumentAction, {} as EventDocumentFormState);
  const id = useId();
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="documentId" value={documentId} />
      <label htmlFor={id} className="sr-only">
        {t("renameLabel", { label })}
      </label>
      <input id={id} type="text" name="label" defaultValue={label} maxLength={200} required />
      <button type="submit" className="button-ghost" disabled={pending}>
        {t("rename")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("renamed")}</p> : null}
    </form>
  );
}
