"use client";

// Lot 27b (POR-03, BUD-07, décision D10) — réponse à une décision depuis le
// portail : choisir une option, ou valider / ne pas valider, avec un
// commentaire facultatif. Dans l'aperçu « vu par » (POR-09), inactif.
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import type { DecisionSnapshot } from "@symbola/contracts";
import { answerDecisionAction, type DecisionAnswerState } from "./actions";

export function DecisionAnswerForm({ decisionId, snapshot, label, amounts, preview = false }: { decisionId: string; snapshot: DecisionSnapshot; label: string; amounts: Record<string, string>; preview?: boolean }) {
  const t = useTranslations("Decisions");
  const [state, formAction, pending] = useActionState(answerDecisionAction, {} as DecisionAnswerState);
  const commentId = useId();
  if (state.success) return <p role="status">{t("answerSaved")}</p>;
  const disabled = pending || preview;
  return (
    <form action={preview ? undefined : formAction} className="decision-form">
      <input type="hidden" name="decisionId" value={decisionId} />
      {snapshot.kind === "option" ? (
        <fieldset>
          <legend>{t("yourChoice", { label })}</legend>
          {snapshot.options.map((option) => (
            <label key={option.candidateId} className="checkbox">
              <input type="radio" name="choiceId" value={option.candidateId} required />
              {option.vendorName}
              {amounts[option.candidateId] ? ` — ${amounts[option.candidateId]}` : ""}
            </label>
          ))}
        </fieldset>
      ) : null}
      <label htmlFor={commentId}>
        {t("commentLabel")}
        <textarea id={commentId} name="comment" maxLength={500} rows={2} />
      </label>
      <div className="link-actions">
        <button type="submit" name="answer" value="approved" className="primary" disabled={disabled}>
          <span aria-hidden="true">{t(`approve.${snapshot.kind}`)}</span>
          <span className="sr-only">{t(`approveFull.${snapshot.kind}`, { label })}</span>
        </button>
        <button type="submit" name="answer" value="declined" formNoValidate disabled={disabled}>
          <span aria-hidden="true">{t(`decline.${snapshot.kind}`)}</span>
          <span className="sr-only">{t(`declineFull.${snapshot.kind}`, { label })}</span>
        </button>
      </div>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
