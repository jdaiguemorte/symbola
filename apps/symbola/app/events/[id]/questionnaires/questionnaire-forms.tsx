"use client";

// Lot 45 (POR-07, CRM-09 ; D7) — envoyer un questionnaire ; trancher un écart (la réponse ou la fiche).
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { resolveDifferenceAction, sendQuestionnaireAction, type QuestionnaireActionState } from "./actions";

export function SendQuestionnaireForm({ eventId, templates, clients }: { eventId: string; templates: { id: string; name: string }[]; clients: { id: string; label: string; hasEmail: boolean }[] }) {
  const t = useTranslations("EventQuestionnaires");
  const [state, action, pending] = useActionState<QuestionnaireActionState, FormData>(sendQuestionnaireAction.bind(null, eventId), {});
  return (
    <form action={action} className="stack" aria-labelledby="questionnaire-send-title">
      <h2 id="questionnaire-send-title">{t("sendTitle")}</h2>
      <label htmlFor="questionnaire-template">{t("template")}</label>
      <select id="questionnaire-template" name="templateId" required>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
      <label htmlFor="questionnaire-client">{t("recipient")}</label>
      <select id="questionnaire-client" name="eventClientId" required>
        {clients.map((client) => (
          <option key={client.id} value={client.id} disabled={!client.hasEmail}>
            {client.hasEmail ? client.label : t("noEmailOption", { name: client.label })}
          </option>
        ))}
      </select>
      <p className="meta">{t("sendHint")}</p>
      <button type="submit" className="primary" disabled={pending}>
        {t("send")}
      </button>
      {state.ok ? <p role="status">{state.ok}</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

export function DifferenceChoice({ eventId, questionnaireId, itemKey, answerLabel, eventLabel }: { eventId: string; questionnaireId: string; itemKey: string; answerLabel: string; eventLabel: string }) {
  const t = useTranslations("EventQuestionnaires");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const choose = (choice: "answer" | "event") => startTransition(async () => setStatus((await resolveDifferenceAction(eventId, questionnaireId, itemKey, choice)) ? t("resolved") : t("refused")));
  return (
    <div className="row-wrap">
      <button type="button" className="button-ghost" disabled={pending} onClick={() => choose("answer")}>
        {answerLabel}
      </button>
      <button type="button" className="button-ghost" disabled={pending} onClick={() => choose("event")}>
        {eventLabel}
      </button>
      {status ? <span role="status">{status}</span> : null}
    </div>
  );
}
