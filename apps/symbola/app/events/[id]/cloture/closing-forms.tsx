"use client";

// Lot 58 (PAR-09, PRE-08, EVT-08 ; D4, D5 ; ADR 0097) — formulaires de la clôture : étape cochée à la
// main, évaluation d'un prestataire, temps passé et leçons, frais propres, clôture, archivage, modèle,
// duplication, lien d'avis et remerciement relu avant l'envoi.
import { useActionState, useState } from "react";
import type { PreparedEmailDraft } from "@symbola/contracts";
import { PrepareEmailDialog } from "@/app/ui/prepare-email-dialog";
import { useTranslations } from "next-intl";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import {
  addOwnExpenseAction,
  archiveEventAction,
  closeEventAction,
  duplicateEventAction,
  evaluateVendorAction,
  saveClosingNotesAction,
  saveReviewLinkAction,
  saveTemplateAction,
  sendReviewRequestAction,
  toggleClosingStepAction,
  type ClosingFormState,
} from "./actions";

function Feedback({ state, success }: { state: ClosingFormState; success?: string }) {
  const t = useTranslations("Closing");
  return (
    <>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.findings && state.findings.length > 0 ? (
        <div role="alert">
          <p>{t("personalDataFound")}</p>
          <ul>
            {state.findings.map((finding, index) => (
              <li key={index}>{t("finding", { place: t(`findingPlace.${finding.place}`), label: finding.label, kind: t(`findingKind.${finding.kind}`) })}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.success && success ? <p role="status">{success}</p> : null}
    </>
  );
}

export function StepToggleForm({ eventId, step, checked }: { eventId: string; step: string; checked: boolean }) {
  const t = useTranslations("Closing");
  const [state, action, pending] = useActionState<ClosingFormState, FormData>(toggleClosingStepAction, {});
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="step" value={step} />
      <input type="hidden" name="done" value={checked ? "0" : "1"} />
      <button type="submit" className="button-link" disabled={pending}>
        {checked ? t("markTodo") : t("markDone")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

type Evaluation = { rating: number; punctuality: number | null; quality: number | null; value: number | null; comment: string | null } | null;

function ScoreSelect({ name, label, value, required }: { name: string; label: string; value: number | null; required?: boolean }) {
  const t = useTranslations("Closing");
  return (
    <label>
      {label}
      <select name={name} defaultValue={value === null ? "" : String(value)} required={required}>
        <option value="">{t("criteriaNone")}</option>
        {[1, 2, 3, 4, 5].map((score) => (
          <option key={score} value={score}>
            {t("ratingOption", { value: score })}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EvaluationForm({ eventId, vendorId, name, evaluation }: { eventId: string; vendorId: string; name: string; evaluation: Evaluation }) {
  const t = useTranslations("Closing");
  const [state, action, pending] = useActionState<ClosingFormState, FormData>(evaluateVendorAction, {});
  return (
    <form action={action} className="stack" aria-label={name}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="vendorId" value={vendorId} />
      <div className="row-wrap">
        <ScoreSelect name="rating" label={t("rating")} value={evaluation?.rating ?? null} required />
        <ScoreSelect name="punctuality" label={t("criteria.punctuality")} value={evaluation?.punctuality ?? null} />
        <ScoreSelect name="quality" label={t("criteria.quality")} value={evaluation?.quality ?? null} />
        <ScoreSelect name="value" label={t("criteria.value")} value={evaluation?.value ?? null} />
      </div>
      <label>
        {t("comment")}
        <textarea name="comment" rows={2} maxLength={2000} defaultValue={evaluation?.comment ?? ""} />
      </label>
      <FreeTextNotice />
      <button type="submit" disabled={pending}>
        {t("evaluate")}
      </button>
      <Feedback state={state} success={t("evaluated")} />
    </form>
  );
}

export function ClosingNotesForm({ eventId, timeSpent, lessons, lessonCount }: { eventId: string; timeSpent: string; lessons: string[]; lessonCount: number }) {
  const t = useTranslations("Closing");
  const [state, action, pending] = useActionState<ClosingFormState, FormData>(saveClosingNotesAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("timeSpent")}
        <input name="timeSpent" inputMode="decimal" defaultValue={timeSpent} aria-describedby="time-spent-help" />
      </label>
      <p id="time-spent-help" className="muted">
        {t("timeSpentHelp")}
      </p>
      {Array.from({ length: lessonCount }, (_, index) => (
        <label key={index}>
          {t("lesson", { index: index + 1 })}
          <textarea name="lessons" rows={2} maxLength={500} defaultValue={lessons[index] ?? ""} />
        </label>
      ))}
      <FreeTextNotice />
      <button type="submit" disabled={pending}>
        {t("saveNotes")}
      </button>
      <Feedback state={state} success={t("notesSaved")} />
    </form>
  );
}

export function OwnExpenseForm({ eventId }: { eventId: string }) {
  const t = useTranslations("Closing");
  const [state, action, pending] = useActionState<ClosingFormState, FormData>(addOwnExpenseAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="row-wrap">
        <label>
          {t("expenseLabel")}
          <input name="expenseLabel" maxLength={120} required />
        </label>
        <label>
          {t("expenseAmount")}
          <input name="expenseAmount" inputMode="decimal" required />
        </label>
      </div>
      <FreeTextNotice />
      <button type="submit" disabled={pending}>
        {t("addExpense")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CloseEventButton({ eventId }: { eventId: string }) {
  const t = useTranslations("Closing");
  const [state, action, pending] = useActionState<ClosingFormState, FormData>(closeEventAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <button type="submit" disabled={pending}>
        {t("closeButton")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ArchiveButton({ eventId, unarchive }: { eventId: string; unarchive: boolean }) {
  const t = useTranslations("Closing");
  const [state, action, pending] = useActionState<ClosingFormState, FormData>(archiveEventAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      {unarchive ? <input type="hidden" name="unarchive" value="1" /> : null}
      <button type="submit" disabled={pending}>
        {unarchive ? t("unarchiveButton") : t("archiveButton")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function TemplateForm({ eventId, defaultName }: { eventId: string; defaultName: string }) {
  const t = useTranslations("Closing");
  const [state, action, pending] = useActionState<ClosingFormState, FormData>(saveTemplateAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("templateName")}
        <input name="name" maxLength={120} required defaultValue={defaultName} />
      </label>
      <label className="choice-item">
        <input type="checkbox" name="includeVendors" value="1" />
        <span>{t("includeVendors")}</span>
      </label>
      <button type="submit" disabled={pending}>
        {t("saveTemplate")}
      </button>
      <Feedback state={state} success={t("templateSaved")} />
    </form>
  );
}

export function DuplicateForm({ eventId }: { eventId: string }) {
  const t = useTranslations("Closing");
  const [state, action, pending] = useActionState<ClosingFormState, FormData>(duplicateEventAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("duplicateDate")}
        <input type="date" name="eventDate" required />
      </label>
      <label className="choice-item">
        <input type="checkbox" name="includeVendors" value="1" />
        <span>{t("includeVendors")}</span>
      </label>
      <button type="submit" disabled={pending}>
        {t("duplicateButton")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ReviewLinkForm({ eventId, reviewUrl, reviewLabel }: { eventId: string; reviewUrl: string | null; reviewLabel: string | null }) {
  const t = useTranslations("Closing");
  const [state, action, pending] = useActionState<ClosingFormState, FormData>(saveReviewLinkAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("reviewUrl")}
        <input type="url" name="reviewUrl" maxLength={500} defaultValue={reviewUrl ?? ""} placeholder="https://" />
      </label>
      <label>
        {t("reviewLabel")}
        <input name="reviewLabel" maxLength={60} defaultValue={reviewLabel ?? ""} />
      </label>
      <button type="submit" disabled={pending}>
        {t("saveReviewLink")}
      </button>
      <Feedback state={state} success={t("reviewLinkSaved")} />
    </form>
  );
}

export function ReviewSendForm({ eventId, subject, body, withReview }: { eventId: string; subject: string; body: string; withReview: boolean }) {
  const t = useTranslations("Closing");
  const [state, action, pending] = useActionState<ClosingFormState, FormData>(sendReviewRequestAction, {});
  // Lot 65d (ADR 0110) : les remerciements préparés pour la messagerie de la planner s'ouvrent dans la
  // fenêtre « Préparer l'e-mail ».
  const [closedDrafts, setClosedDrafts] = useState<PreparedEmailDraft[] | null>(null);
  return (
    <>
    {state.prepared && state.prepared !== closedDrafts ? <PrepareEmailDialog drafts={state.prepared} onClose={() => setClosedDrafts(state.prepared ?? null)} /> : null}
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      {withReview ? <input type="hidden" name="withReview" value="1" /> : null}
      <label>
        {t("subject")}
        <input name="subject" maxLength={200} required defaultValue={subject} />
      </label>
      <label>
        {t("body")}
        <textarea name="body" rows={10} maxLength={5000} required defaultValue={body} />
      </label>
      <button type="submit" disabled={pending}>
        {t("send")}
      </button>
      <Feedback state={state} success={state.prepared ? t("prepared") : t("sent")} />
    </form>
    </>
  );
}
