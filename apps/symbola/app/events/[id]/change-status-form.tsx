"use client";

// EVT-02, lot 12 (EVT-12), refait au lot 13 (EVT-19) — frise du statut :
// Prospect → Devis envoyé → Confirmé → Réalisé, chaque étape franchie avec
// sa date ; l'étape en cours est mise en avant. Un clic sur une autre étape
// demande confirmation ; « Marquer perdu… » demande d'abord le motif.
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { changeEventStatusAction, type ChangeStatusFormState } from "./actions";
import type { EventStatus, EventStatusDates, LossReason } from "@/modules/events/service";

const STEPS: EventStatus[] = ["prospect", "quote_sent", "confirmed", "done"];
const STATUS_LABEL_KEYS: Record<EventStatus, string> = {
  prospect: "statusProspect",
  quote_sent: "statusQuoteSent",
  confirmed: "statusConfirmed",
  done: "statusDone",
  lost: "statusLost",
};

export function ChangeStatusForm({
  eventId,
  currentStatus,
  reasons,
  dates,
  eventDate,
  locale,
}: {
  eventId: string;
  currentStatus: EventStatus;
  reasons: LossReason[];
  dates: EventStatusDates;
  eventDate: string | null;
  locale: Locale;
}) {
  const t = useTranslations("Events");
  const initialState: ChangeStatusFormState = {};
  const [state, formAction, pending] = useActionState(changeEventStatusAction, initialState);
  const [asked, setAsked] = useState<EventStatus | null>(null);
  const [askingLoss, setAskingLoss] = useState(false);
  const [lossReasonId, setLossReasonId] = useState("");
  const [lossReasonNote, setLossReasonNote] = useState("");
  const currentIndex = STEPS.indexOf(currentStatus);
  const reason = reasons.find((candidate) => candidate.id === lossReasonId);

  // Le statut a changé : la question posée n'a plus lieu d'être.
  useEffect(() => {
    setAsked(null);
    setAskingLoss(false);
  }, [currentStatus]);

  function when(status: EventStatus, index: number): string | null {
    const date = dates[status];
    if (date && (index <= currentIndex || currentIndex < 0)) return formatCalendarDate(date, locale);
    if (status === "done" && eventDate) return t("timelineAfter", { date: formatCalendarDate(eventDate, locale) });
    return null;
  }

  return (
    <div className="status-timeline-wrap">
      <ol className="status-timeline" aria-label={t("statusStepsLabel")}>
        {STEPS.map((status, index) => {
          const current = status === currentStatus;
          const passed = currentIndex >= 0 && index < currentIndex;
          const date = when(status, index);
          return (
            <li key={status} className={current ? "timeline-step current" : passed ? "timeline-step passed" : "timeline-step"} aria-current={current ? "step" : undefined}>
              {/* Le nom lu reprend le libellé visible (WCAG 2.5.3) ; la pastille est dessinée en CSS. */}
              <button type="button" className="timeline-button" disabled={pending || current} onClick={() => setAsked(status)}>
                <span className="timeline-dot" data-mark={passed ? "✓" : String(index + 1)} aria-hidden="true" />
                <span className="sr-only">{t("timelineGoToPrefix")} </span>
                <span className="timeline-label">{t(STATUS_LABEL_KEYS[status])}</span>
              </button>
              {date ? <span className="timeline-date">{date}</span> : null}
            </li>
          );
        })}
      </ol>
      {currentStatus === "lost" ? (
        <p className="badge badge-terracotta">{t("statusLost")}{dates.lost ? ` · ${formatCalendarDate(dates.lost, locale)}` : ""}</p>
      ) : (
        <button type="button" className="timeline-lost" aria-expanded={askingLoss} disabled={pending} onClick={() => setAskingLoss((value) => !value)}>
          {t("markLost")}
        </button>
      )}

      {asked ? (
        <form action={formAction} className="timeline-confirm" aria-label={t("timelineConfirmLabel")}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="toStatus" value={asked} />
          <p>{t("timelineConfirm", { status: t(STATUS_LABEL_KEYS[asked]) })}</p>
          <button type="submit" disabled={pending}>
            {t("timelineConfirmButton")}
          </button>
          <button type="button" className="button-ghost" onClick={() => setAsked(null)}>
            {t("timelineCancel")}
          </button>
        </form>
      ) : null}

      {askingLoss && currentStatus !== "lost" ? (
        <form action={formAction} className="stack loss-form">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="toStatus" value="lost" />
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
            <label>
              {t("lossReasonNote")}
              <textarea name="lossReasonNote" value={lossReasonNote} onChange={(event) => setLossReasonNote(event.target.value)} required />
            </label>
          ) : null}
          <button type="submit" disabled={pending}>
            {t("confirmLost")}
          </button>
        </form>
      ) : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("statusChanged")}</p> : null}
    </div>
  );
}
