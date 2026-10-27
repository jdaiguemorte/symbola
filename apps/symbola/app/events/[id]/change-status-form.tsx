"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { changeEventStatusAction, type ChangeStatusFormState } from "./actions";
import type { EventStatus, LossReason } from "@/modules/events/service";

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
}: {
  eventId: string;
  currentStatus: EventStatus;
  reasons: LossReason[];
}) {
  const t = useTranslations("Events");
  const initialState: ChangeStatusFormState = {};
  const [state, formAction, pending] = useActionState(changeEventStatusAction, initialState);
  // Champs contrôlés : React 19 réinitialise un formulaire après chaque
  // action. Sans cela, une erreur (motif manquant) ramènerait le statut à
  // l'ancien et le choix « Perdu » serait perdu au renvoi suivant.
  const [toStatus, setToStatus] = useState<EventStatus>(currentStatus);
  const [lossReasonId, setLossReasonId] = useState("");
  const [lossReasonNote, setLossReasonNote] = useState("");

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("status")}
        <select name="toStatus" value={toStatus} onChange={(event) => setToStatus(event.target.value as EventStatus)}>
          {(Object.keys(STATUS_LABEL_KEYS) as EventStatus[]).map((status) => (
            <option key={status} value={status}>
              {t(STATUS_LABEL_KEYS[status])}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("lossReason")} ({t("onlyIfLost")})
        <select name="lossReasonId" value={lossReasonId} onChange={(event) => setLossReasonId(event.target.value)}>
          <option value="">{t("sourceChoose")}</option>
          {reasons.map((reason) => (
            <option key={reason.id} value={reason.id}>
              {reason.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("lossReasonNote")} ({t("onlyIfLost")})
        <textarea name="lossReasonNote" value={lossReasonNote} onChange={(event) => setLossReasonNote(event.target.value)} />
      </label>
      <button type="submit" disabled={pending}>
        {t("changeStatus")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("statusChanged")}</p> : null}
    </form>
  );
}
