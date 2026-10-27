"use client";

import { useActionState } from "react";
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

  return (
    <form action={formAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("status")}
        <select name="toStatus" defaultValue={currentStatus}>
          {(Object.keys(STATUS_LABEL_KEYS) as EventStatus[]).map((status) => (
            <option key={status} value={status}>
              {t(STATUS_LABEL_KEYS[status])}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("lossReason")} ({t("onlyIfLost")})
        <select name="lossReasonId" defaultValue="">
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
        <textarea name="lossReasonNote" />
      </label>
      <button type="submit" disabled={pending}>
        {t("changeStatus")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
