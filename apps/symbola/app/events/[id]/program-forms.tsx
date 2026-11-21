"use client";

// Lot 62c (UX-13, D1) : l'ajout et la modification des séquences sont dans program-editor.tsx (un
// seul « Enregistrer le programme ») ; restent ici le modèle, la diffusion et l'envoi par e-mail.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { ProgramTemplate } from "@/modules/events/service";
import {
  applyProgramTemplateAction,
  notifyProgramAction,
  publishProgramAction,
  type ProgramFormState,
  type ProgramNotifyState,
  type ProgramPublishState,
} from "./program-actions";
import { RecipientsGuard } from "../../recipients-guard";

export function ApplyProgramTemplateForm({ eventId, templates }: { eventId: string; templates: ProgramTemplate[] }) {
  const t = useTranslations("Events");
  const initialState: ProgramFormState = {};
  const [state, formAction, pending] = useActionState(applyProgramTemplateAction, initialState);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");

  return (
    <form action={formAction} className="form-inline">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("programTemplateToApply")}
        <select name="templateId" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="button-secondary" disabled={pending}>
        {t("applyProgramTemplate")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("programTemplateApplied")}</p> : null}
    </form>
  );
}

// Lot 37b (CHR-07, D8) : diffuser le programme fige la version suivante ; le bouton dit laquelle.
export function ProgramPublishForm({ eventId, nextNumber, canPublish }: { eventId: string; nextNumber: number; canPublish: boolean }) {
  const t = useTranslations("Events");
  const initialState: ProgramPublishState = {};
  const [state, formAction, pending] = useActionState(publishProgramAction, initialState);
  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <button type="submit" className="button-secondary" disabled={pending || !canPublish}>
        {t("programPublish", { number: nextNumber })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.published ? <p role="status">{t("programPublished", { number: state.published })}</p> : null}
    </form>
  );
}

// Lot 38a (D9 ; MSG-02, D8) : prévenir les destinataires de la dernière version diffusée. À plusieurs,
// le bouton ouvre l'écran du garde-fou (nombre et liste), puis « Envoyer à N personnes ».
export function ProgramNotifyForm({ eventId, number, recipients }: { eventId: string; number: number; recipients: number }) {
  const t = useTranslations("Events");
  const initialState: ProgramNotifyState = {};
  const [state, formAction, pending] = useActionState(notifyProgramAction, initialState);
  return (
    <form action={formAction} aria-label={t("programNotify", { number })}>
      <input type="hidden" name="eventId" value={eventId} />
      <p className="meta">{t("programNotifyHint", { count: recipients })}</p>
      {state.confirmRecipients ? (
        <RecipientsGuard review={state.confirmRecipients} pending={pending} />
      ) : (
        <button type="submit" className="button-secondary" disabled={pending}>
          {t("programNotify", { number })}
        </button>
      )}
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.sent ? <p role="status">{state.notSent ? t("programNotifyPartial", { sent: state.sent, notSent: state.notSent }) : t("programNotifySent", { count: state.sent })}</p> : null}
    </form>
  );
}
