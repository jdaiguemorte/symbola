"use client";

// Lot 45 (CRM-05 ; D1 ; ADR 0090) — le message se relit et se modifie avant l'envoi (critère), puis
// part de Symbola (à l'image de l'organisation, réponses à l'adresse de la planner, rangé dans
// l'historique) ou s'ouvre dans la messagerie de la planner (noté « préparé »). La brochure garde sa
// variable jusqu'à l'envoi : son lien sécurisé n'existe qu'alors.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { prepareForMailAction, sendFromSymbolaAction, type WriteResult } from "./actions";
import { CopyMessageButton } from "./copy-message-button";

type Props = {
  eventId: string;
  templateId: string | null;
  contactIds: string[];
  subject: string;
  body: string;
  locale: "fr" | "en";
  recipientCount: number;
};

export function WriteForm(props: Props) {
  const t = useTranslations("WriteToClient");
  const [subject, setSubject] = useState(props.subject);
  const [body, setBody] = useState(props.body);
  const [result, setResult] = useState<WriteResult | null>(null);
  const [pending, startTransition] = useTransition();
  const draft = () => ({ eventId: props.eventId, templateId: props.templateId, contactIds: props.contactIds, subject, body, locale: props.locale });

  return (
    <form
      className="stack write-form"
      aria-labelledby="write-edit-title"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => setResult(await sendFromSymbolaAction(draft())));
      }}
    >
      <h2 id="write-edit-title">{t("editTitle")}</h2>
      <p className="meta">{t("editHint")}</p>
      <label htmlFor="write-subject">{t("subjectLabel")}</label>
      <input id="write-subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} required />
      <label htmlFor="write-body">{t("bodyLabel")}</label>
      <textarea id="write-body" name="body" value={body} onChange={(event) => setBody(event.target.value)} rows={14} maxLength={5000} required />
      <FreeTextNotice />
      <div className="row-wrap">
        <button type="submit" className="primary" disabled={pending}>
          {t("sendFromSymbola", { count: props.recipientCount })}
        </button>
        <button
          type="button"
          className="button-ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const outcome = await prepareForMailAction(draft());
              setResult(outcome);
              if (outcome.ok && outcome.mailto) window.location.href = outcome.mailto;
            })
          }
        >
          {t("openInMail")}
        </button>
        <CopyMessageButton text={`${subject}\n\n${body}`} />
      </div>
      <p className="meta">{t("sendHint")}</p>
      {result ? <p role={result.ok ? "status" : "alert"}>{result.ok ? result.message : result.error}</p> : null}
    </form>
  );
}
