"use client";

// Lot 45 (CRM-06 ; D2) — la relance préparée se relit, se modifie, puis part d'un geste ; ou se retire.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { sendFollowUpAction, withdrawFollowUpAction, type FollowUpResult } from "./actions";

export function FollowUpForm({ eventId, followUpId, subject: initialSubject, body: initialBody }: { eventId: string; followUpId: string; subject: string; body: string }) {
  const t = useTranslations("FollowUpReview");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [result, setResult] = useState<FollowUpResult | null>(null);
  const [pending, startTransition] = useTransition();
  const done = result?.ok === true;
  return (
    <form
      className="stack"
      aria-labelledby="follow-up-edit-title"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => setResult(await sendFollowUpAction({ eventId, followUpId, subject, body })));
      }}
    >
      <h2 id="follow-up-edit-title">{t("editTitle")}</h2>
      <label htmlFor="follow-up-subject">{t("subjectLabel")}</label>
      <input id="follow-up-subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} required disabled={done} />
      <label htmlFor="follow-up-body">{t("bodyLabel")}</label>
      <textarea id="follow-up-body" name="body" value={body} onChange={(event) => setBody(event.target.value)} rows={12} maxLength={5000} required disabled={done} />
      <FreeTextNotice />
      <p className="meta">{t("optOutHint")}</p>
      <div className="row-wrap">
        <button type="submit" className="primary" disabled={pending || done}>
          {t("send")}
        </button>
        <button type="button" className="button-ghost" disabled={pending || done} onClick={() => startTransition(async () => setResult(await withdrawFollowUpAction(eventId, followUpId)))}>
          {t("withdraw")}
        </button>
      </div>
      {result ? <p role={result.ok ? "status" : "alert"}>{result.ok ? result.message : result.error}</p> : null}
    </form>
  );
}
