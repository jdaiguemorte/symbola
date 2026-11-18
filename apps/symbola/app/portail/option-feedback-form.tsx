"use client";

// Lot 47 (PRE-09 ; D7) — l'avis du client sur une option, avant de choisir : « J'aime » ou « Pas pour
// nous », et un commentaire court. La planner le lit dans son comparatif. Inactif dans l'aperçu.
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import { optionFeedbackAction, type OptionFeedbackState } from "./actions";

export function OptionFeedbackForm({ decisionId, candidateId, vendorName, opinion, comment, preview }: { decisionId: string; candidateId: string; vendorName: string; opinion: "like" | "dislike" | null; comment: string; preview: boolean }) {
  const t = useTranslations("Decisions");
  const [state, action, pending] = useActionState<OptionFeedbackState, FormData>(optionFeedbackAction, {});
  const commentId = useId();
  return (
    <form action={preview ? undefined : action} className="stack">
      <input type="hidden" name="decisionId" value={decisionId} />
      <input type="hidden" name="candidateId" value={candidateId} />
      <fieldset>
        <legend>{t("feedbackOn", { vendor: vendorName })}</legend>
        <label className="checkbox">
          <input type="radio" name="opinion" value="like" defaultChecked={opinion === "like"} />
          {t("feedbackLike")}
        </label>
        <label className="checkbox">
          <input type="radio" name="opinion" value="dislike" defaultChecked={opinion === "dislike"} />
          {t("feedbackDislike")}
        </label>
      </fieldset>
      <label htmlFor={commentId}>{t("feedbackComment", { vendor: vendorName })}</label>
      <textarea id={commentId} name="comment" rows={2} maxLength={500} defaultValue={comment} />
      <button type="submit" disabled={preview || pending}>
        {t("feedbackSave", { vendor: vendorName })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("feedbackSaved")}</p> : null}
    </form>
  );
}
