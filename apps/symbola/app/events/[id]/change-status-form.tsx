"use client";

// EVT-02, lot 12 (EVT-12) — statut de l'événement en étapes cliquables,
// façon Kanban : un clic change le statut ; « Perdu » demande d'abord le
// motif (et sa précision si le motif l'exige).
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { changeEventStatusAction, type ChangeStatusFormState } from "./actions";
import type { EventStatus, LossReason } from "@/modules/events/service";

const STEPS: EventStatus[] = ["prospect", "quote_sent", "confirmed", "done"];
const STATUS_LABEL_KEYS: Record<EventStatus, string> = {
  prospect: "statusProspect",
  quote_sent: "statusQuoteSent",
  confirmed: "statusConfirmed",
  done: "statusDone",
  lost: "statusLost",
};

export function ChangeStatusForm({ eventId, currentStatus, reasons }: { eventId: string; currentStatus: EventStatus; reasons: LossReason[] }) {
  const t = useTranslations("Events");
  const initialState: ChangeStatusFormState = {};
  const [state, formAction, pending] = useActionState(changeEventStatusAction, initialState);
  const [askingLoss, setAskingLoss] = useState(false);
  const [lossReasonId, setLossReasonId] = useState("");
  const [lossReasonNote, setLossReasonNote] = useState("");
  const currentIndex = STEPS.indexOf(currentStatus);
  const reason = reasons.find((candidate) => candidate.id === lossReasonId);

  return (
    <div className="status-steps-wrap">
      <form action={formAction} className="status-steps" aria-label={t("statusStepsLabel")}>
        <input type="hidden" name="eventId" value={eventId} />
        {STEPS.map((status, index) => {
          const current = status === currentStatus;
          const passed = currentIndex >= 0 && index < currentIndex;
          return (
            <button
              key={status}
              type="submit"
              name="toStatus"
              value={status}
              disabled={pending || current}
              aria-current={current ? "step" : undefined}
              className={current ? "status-step current" : passed ? "status-step passed" : "status-step"}
            >
              {t(STATUS_LABEL_KEYS[status])}
            </button>
          );
        })}
        <button
          type="button"
          className={currentStatus === "lost" ? "status-step lost current" : "status-step lost"}
          aria-current={currentStatus === "lost" ? "step" : undefined}
          aria-expanded={askingLoss}
          disabled={pending || currentStatus === "lost"}
          onClick={() => setAskingLoss((value) => !value)}
        >
          {t("statusLostAsk")}
        </button>
      </form>
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
