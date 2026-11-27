"use client";

// PRD-EVT-02, lot 12 (L12-EVT-12), refait au lot 13 (L13-EVT-19), puis au lot 34a (EVT-05,
// ADR 0055 ; D2 à D6) — frise du statut : Option → Confirmé → Jour J → Clôturé,
// chaque étape franchie avec sa date. « Jour J » s'applique de lui-même (D3). Un clic sur une autre
// étape demande confirmation. « Reporter l'évènement… » demande la nouvelle date ; « Annuler
// l'évènement… » demande le motif et nomme l'évènement (UX-07) ; un annulé se réactive en Option.
// Lot 70b (UX-07, EVT-05 ; M6, C-08, C-87, C-80) : « Annuler l'évènement… » et « Reporter
// l'évènement… » sont au niveau 2 du danger (ils touchent les clients et les prestataires) : une
// fenêtre qui nomme l'évènement, dit ce que fait vraiment l'app et propose de renoncer par un bouton
// nommé (« Garder l'évènement », « Garder la date »). Un annulé se rétablit par « Rétablir
// l'évènement » (il revient en Option). Chaque changement est dit dans le message de retour.
import { useActionState, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { useFeedback } from "@/app/ui/feedback";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { useTranslations } from "next-intl";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { cancelEventAction, changeEventStatusAction, postponeEventAction, reactivateEventAction, type ChangeStatusFormState } from "./actions";
import type { EventPhase, EventStatus, EventStatusDates, LossReason } from "@/modules/events/service";
import { STATUS_LABEL_KEYS } from "../event-status";

// Lot 72a (J1) : « En préparation » retiré ; la frise en lecture seule vient au paquet 72d.
const STEPS: EventPhase[] = ["option", "confirmed", "day_of", "closed"];
const CLICKABLE: EventPhase[] = ["option", "confirmed", "closed"];

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

  const [lossReasonId, setLossReasonId] = useState("");
  const [lossReasonNote, setLossReasonNote] = useState("");
  const [undecided, setUndecided] = useState(false);
  const busy = pending || cancelling || postponing || reactivating;
  const offTrack = currentStatus === "postponed" || currentStatus === "cancelled";
  const currentIndex = offTrack ? -1 : STEPS.indexOf(phase);
  const reason = reasons.find((candidate) => candidate.id === lossReasonId);
  const error = state.error ?? reactivateState.error;
  const feedback = useFeedback();

  // Le statut a changé : la question posée n'a plus lieu d'être.
  useEffect(() => {
    setAsked(null);
  }, [currentStatus]);

  // Lot 70b (UX-07, C-09) : chaque changement est dit dans le message de retour, au même endroit.
  const announced = useRef<object | null>(null);
  useEffect(() => {
    const changes: [ChangeStatusFormState, () => { title: string; detail?: string }][] = [
      [state, () => ({ title: t("statusChanged") })],
      [cancelState, () => ({ title: t("statusCancelledMessage", { names: eventNames }) })],
      [postponeState, () => ({ title: t("statusPostponedMessage", { names: eventNames }) })],
      [reactivateState, () => ({ title: t("statusRestoredMessage", { names: eventNames }), detail: t("statusRestoredDetail") })],
    ];
    for (const [changed, message] of changes) {
      if (changed.success && announced.current !== changed) {
        announced.current = changed;
        feedback?.show(message());
      }
    }
  }, [state, cancelState, postponeState, reactivateState, feedback, eventNames, t]);

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
            <button type="submit" className="button-secondary" disabled={busy}>
              {t("restoreEvent")}
            </button>
          </form>
        </div>
      ) : (
        <div className="timeline-actions">
          {currentStatus === "confirmed" ? (
            <ConfirmDialog
              level={2}
              trigger={t("postponeAsk")}
              triggerLabel={t("postponeAsk")}
              triggerClassName="timeline-lost timeline-postpone"
              triggerDisabled={busy}
              title={t("postponeTitle", { names: eventNames })}
              body={t("postponeBody")}
              confirmLabel={t("confirmPostpone")}
              keepLabel={t("keepDate")}
              action={postponeAction}
              pending={postponing}
              fields={{ eventId }}
            >
              <label>
                {t("postponeNewDate")}
                <input type="date" name="newDate" disabled={undecided} />
              </label>
              <label className="choice-item">
                <input type="checkbox" name="undecided" value="1" checked={undecided} onChange={(event) => setUndecided(event.target.checked)} />
                <span>{t("postponeUndecided")}</span>
              </label>
              <p className="muted">{t("postponeHint")}</p>
              {postponeState.error ? <p role="alert">{postponeState.error}</p> : null}
            </ConfirmDialog>
          ) : null}
          <ConfirmDialog
            level={2}
            trigger={t("cancelAsk")}
            triggerLabel={t("cancelAsk")}
            triggerClassName="timeline-lost"
            triggerDisabled={busy}
            title={t("cancelTitle", { names: eventNames })}
            body={t("cancelBody")}
            confirmLabel={t("confirmCancel")}
            keepLabel={t("keepEvent")}
            action={cancelAction}
            pending={cancelling}
            fields={{ eventId }}
          >
            <ul className="confirm-dialog-consequences">
              <li>{t("cancelRestore")}</li>
              <li>{t("cancelLinks")}</li>
              <li>{t("cancelReminders")}</li>
              <li>{t("cancelInvoices")}</li>
              <li>{t("cancelNobody")}</li>
            </ul>
            <label>
              {t("cancelReason")}
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
            {cancelState.error ? <p role="alert">{cancelState.error}</p> : null}
          </ConfirmDialog>
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

      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
