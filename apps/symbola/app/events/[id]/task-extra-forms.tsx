"use client";

// Lot 34b (CHR-02, D13) — dans le panneau d'une tâche : joindre un fichier, commenter. Réservés à
// l'équipe (rien n'est partagé avec les tiers, POR-10).
import { useActionState, useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";
import { addTaskCommentAction, type TaskCommentFormState } from "./task-extra-actions";

export function TaskAttachmentUploadForm({ eventId, taskId }: { eventId: string; taskId: string }) {
  const t = useTranslations("Events");
  const tDocuments = useTranslations("EventDocuments");
  const [state, action, pending] = useUploadAction<UploadState>(`/events/${eventId}/taches/${taskId}/pieces`);
  const ids = { label: useId(), file: useId() };
  return (
    <form action={action} className="stack" aria-label={t("taskAttachmentAdd")}>
      <label htmlFor={ids.label}>{tDocuments("label")}</label>
      <input id={ids.label} type="text" name="label" maxLength={200} />
      <label htmlFor={ids.file}>{tDocuments("file")}</label>
      <input id={ids.file} type="file" name="file" accept="application/pdf,image/*" required />
      <button type="submit" disabled={pending}>
        {t("taskAttachmentAdd")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("taskAttachmentAdded")}</p> : null}
    </form>
  );
}

export function TaskCommentForm({ eventId, taskId }: { eventId: string; taskId: string }) {
  const t = useTranslations("Events");
  const [state, action, pending] = useActionState(addTaskCommentAction, {} as TaskCommentFormState);
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  // Un commentaire envoyé vide le champ pour le suivant ; une erreur garde la saisie.
  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="taskId" value={taskId} />
      <label htmlFor={id}>{t("taskCommentLabel")}</label>
      <textarea id={id} name="body" maxLength={2000} required rows={3} />
      <button type="submit" disabled={pending}>
        {t("taskCommentAdd")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("taskCommentAdded")}</p> : null}
    </form>
  );
}
