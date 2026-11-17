"use client";

// PRD-EVT-02, lot 12 (L12-EVT-12), refait au lot 13 (L13-EVT-19), puis au lot 34a (EVT-05,
// ADR 0055 ; D2 à D6) — frise du statut : Option → Confirmé → En préparation → Jour J → Clôturé,
// chaque étape franchie avec sa date. « Jour J » s'applique de lui-même (D3). Un clic sur une autre
// étape demande confirmation. « Reporter l'évènement… » demande la nouvelle date ; « Annuler
// l'évènement… » demande le motif et nomme l'évènement (UX-07) ; un annulé se réactive en Option.
import { useActionState, useEffect, useState } from "react";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { useTranslations } from "next-intl";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { cancelEventAction, changeEventStatusAction, postponeEventAction, reactivateEventAction, type ChangeStatusFormState } from "./actions";
import type { EventPhase, EventStatus, EventStatusDates, LossReason } from "@/modules/events/service";
import { STATUS_LABEL_KEYS } from "../event-status";

const STEPS: EventPhase[] = ["option", "confirmed", "in_preparation", "day_of", "closed"];
const CLICKABLE: EventPhase[] = ["option", "confirmed", "in_preparation", "closed"];

export function ChangeStatusForm({
  eventId,
  eventNames,
  currentStatus,
  phase,
  reasons,
  dates,
  eventDate,
  postponedFromDate,
  locale,
}: {
  eventId: string;
  eventNames: string;
  currentStatus: EventStatus;
  phase: EventPhase;
  reasons: LossReason[];
  dates: EventStatusDates;
  eventDate: string | null;
  postponedFromDate: string | null;
  locale: Locale;
}) {
  const t = useTranslations("Events");
  const initialState: ChangeStatusFormState = {};
  const [state, formAction, pending] = useActionState(changeEventStatusAction, initialState);
  const [cancelState, cancelAction, cancelling] = useActionState(cancelEventAction, initialState);
  const [postponeState, postponeAction, postponing] = useActionState(postponeEventAction, initialState);
  const [reactivateState, reactivateAction, reactivating] = useActionState(reactivateEventAction, initialState);
  const [asked, setAsked] = useState<EventPhase | null>(null);
  const [asking, setAsking] = useState<"cancel" | "postpone" | null>(null);
  const [lossReasonId, setLossReasonId] = useState("");
  const [lossReasonNote, setLossReasonNote] = useState("");
  const [undecided, setUndecided] = useState(false);
  const busy = pending || cancelling || postponing || reactivating;
  const offTrack = currentStatus === "postponed" || currentStatus === "cancelled";
  const currentIndex = offTrack ? -1 : STEPS.indexOf(phase);
  const reason = reasons.find((candidate) => candidate.id === lossReasonId);
  const error = state.error ?? cancelState.error ?? postponeState.error ?? reactivateState.error;
  const done = state.success || cancelState.success || postponeState.success || reactivateState.success;

  // Le statut a changé : la question posée n'a plus lieu d'être.
  useEffect(() => {
    setAsked(null);
    setAsking(null);
  }, [currentStatus]);

  function when(step: EventPhase, index: number): string | null {
    if (step === "day_of") return eventDate ? formatCalendarDate(eventDate, locale) : null;
    const date = dates[step as EventStatus];
    if (date && (index <= currentIndex || currentIndex < 0)) return formatCalendarDate(date, locale);
    if (step === "closed" && eventDate) return t("timelineAfter", { date: formatCalendarDate(eventDate, locale) });
    return null;
  }

  return (
    <div className="status-timeline-wrap">
      <ol className="status-timeline" aria-label={t("statusStepsLabel")}>
        {STEPS.map((step, index) => {
          const current = step === phase && !offTrack;
          const passed = currentIndex >= 0 && index < currentIndex;
          const date = when(step, index);
          const clickable = CLICKABLE.includes(step) && !offTrack;
          return (
            <li key={step} className={current ? "timeline-step current" : passed ? "timeline-step passed" : "timeline-step"} aria-current={current ? "step" : undefined}>
              {/* Le nom lu reprend le libellé visible (WCAG 2.5.3) ; la pastille est dessinée en CSS. */}
              {clickable ? (
                <button type="button" className="timeline-button" disabled={busy || current} onClick={() => setAsked(step)}>
                  <span className="timeline-dot" data-mark={passed ? "✓" : String(index + 1)} aria-hidden="true" />
                  <span className="sr-only">{t("timelineGoToPrefix")} </span>
                  <span className="timeline-label">{t(STATUS_LABEL_KEYS[step])}</span>
                </button>
              ) : (
                <span className="timeline-button timeline-auto">
                  <span className="timeline-dot" data-mark={passed ? "✓" : String(index + 1)} aria-hidden="true" />
                  <span className="timeline-label">{t(STATUS_LABEL_KEYS[step])}</span>
                </span>
              )}
              {date ? <span className="timeline-date">{date}</span> : null}
            </li>
          );
        })}
      </ol>

      {currentStatus === "postponed" ? (
        <p className="badge badge-ambre">{postponedFromDate ? t("postponedBadge", { date: formatCalendarDate(postponedFromDate, locale) }) : t("statusPostponed")}</p>
      ) : null}
      {currentStatus === "cancelled" ? (
        <div className="row-wrap">
          <p className="badge badge-terracotta">
            {t("statusCancelled")}
            {dates.cancelled ? ` · ${formatCalendarDate(dates.cancelled, locale)}` : ""}
          </p>
          <form action={reactivateAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <button type="submit" className="button-ghost" disabled={busy}>
              {t("reactivate")}
            </button>
          </form>
        </div>
      ) : (
        <div className="timeline-actions">
          {currentStatus === "confirmed" || currentStatus === "in_preparation" ? (
            <button type="button" className="timeline-lost timeline-postpone" aria-expanded={asking === "postpone"} disabled={busy} onClick={() => setAsking(asking === "postpone" ? null : "postpone")}>
              {t("postponeAsk")}
            </button>
          ) : null}
          <button type="button" className="timeline-lost" aria-expanded={asking === "cancel"} disabled={busy} onClick={() => setAsking(asking === "cancel" ? null : "cancel")}>
            {t("cancelAsk")}
          </button>
        </div>
      )}

      {asked ? (
        <form action={formAction} className="timeline-confirm" aria-label={t("timelineConfirmLabel")}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="toStatus" value={asked} />
          <p>{t("timelineConfirm", { status: t(STATUS_LABEL_KEYS[asked]) })}</p>
          <button type="submit" disabled={busy}>
            {t("timelineConfirmButton")}
          </button>
          <button type="button" className="button-ghost" onClick={() => setAsked(null)}>
            {t("timelineCancel")}
          </button>
        </form>
      ) : null}

      {asking === "postpone" ? (
        <form action={postponeAction} className="stack loss-form" aria-label={t("postponeAsk")}>
          <input type="hidden" name="eventId" value={eventId} />
          <label>
            {t("postponeNewDate")}
            <input type="date" name="newDate" disabled={undecided} required={!undecided} />
          </label>
          <label className="choice-item">
            <input type="checkbox" name="undecided" value="1" checked={undecided} onChange={(event) => setUndecided(event.target.checked)} />
            <span>{t("postponeUndecided")}</span>
          </label>
          <p className="muted">{t("postponeHint")}</p>
          <button type="submit" disabled={busy}>
            {t("confirmPostpone")}
          </button>
        </form>
      ) : null}

      {asking === "cancel" && currentStatus !== "cancelled" ? (
        <form action={cancelAction} className="stack loss-form" aria-label={t("cancelTitle", { names: eventNames })}>
          <input type="hidden" name="eventId" value={eventId} />
          <p>
            <strong>{t("cancelTitle", { names: eventNames })}</strong>
          </p>
          <p className="muted">{t("cancelBody")}</p>
          <label>
            {t("lossReason")}
            <select name="lossReasonId" value={lossReasonId} onChange={(event) => setLossReasonId(event.target.value)} required>
              <option value="">{t("sourceChoose")}</option>
              {reasons.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {reason?.isFreeText ? (
            <>
              <label>
                {t("lossReasonNote")}
                <textarea name="lossReasonNote" value={lossReasonNote} onChange={(event) => setLossReasonNote(event.target.value)} required />
              </label>
              <FreeTextNotice />
            </>
          ) : null}
          <button type="submit" disabled={busy}>
            {t("confirmCancel")}
          </button>
        </form>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {done && !error ? <p role="status">{t("statusChanged")}</p> : null}
    </div>
  );
}
