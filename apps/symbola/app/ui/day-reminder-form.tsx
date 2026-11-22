"use client";

// Lot 66b (JRJ-01, HUB-28 ; D2, D3 ; M18) — les quatre cibles du rappel du jour J : cochée ou non, la
// veille ou le matin même, à une heure (au quart d'heure). Sert au réglage de l'organisation et à celui
// d'un évènement (eventId) ; « Revenir au réglage de l'organisation » efface celui de l'évènement.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { DAY_REMINDER_TARGETS, type DayReminderSetting } from "@symbola/contracts";

export type DayReminderFormState = { error?: string; success?: string };

const QUARTERS = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`);

export function DayReminderForm(props: {
  settings: DayReminderSetting[];
  disabled: boolean;
  action: (state: DayReminderFormState, formData: FormData) => Promise<DayReminderFormState>;
  resetAction?: (state: DayReminderFormState, formData: FormData) => Promise<DayReminderFormState>;
  eventId?: string;
  submitLabel: string;
}) {
  const t = useTranslations("DayReminder");
  const [state, formAction, pending] = useActionState<DayReminderFormState, FormData>(props.action, {});
  const [resetState, resetFormAction, resetPending] = useActionState<DayReminderFormState, FormData>(props.resetAction ?? (async () => ({})), {});
  return (
    <div className="stack">
      <form action={formAction} className="stack">
        {props.eventId ? <input type="hidden" name="eventId" value={props.eventId} /> : null}
        <ul className="setting-list">
          {DAY_REMINDER_TARGETS.map((target) => {
            const setting = props.settings.find((candidate) => candidate.target === target)!;
            const label = t(`targets.${target}.label`);
            return (
              <li key={target} className="setting-row">
                <div className="setting-row-text">
                  <label className="checkbox-row">
                    <input type="checkbox" name={`${target}.enabled`} defaultChecked={setting.enabled} disabled={props.disabled} aria-label={t("enabledLabel", { target: label })} />
                    <span>{label}</span>
                  </label>
                  <p className="field-hint">
                    {t(`targets.${target}.hint`)} · {t(`targets.${target}.content`)}
                  </p>
                </div>
                <div className="setting-row-controls row-wrap">
                  <label>
                    {t("colWhen")}
                    <select name={`${target}.moment`} defaultValue={setting.moment} disabled={props.disabled} aria-label={t("whenLabel", { target: label })}>
                      <option value="eve">{t("moments.eve")}</option>
                      <option value="morning">{t("moments.morning")}</option>
                    </select>
                  </label>
                  <label>
                    {t("colTime")}
                    <select name={`${target}.time`} defaultValue={setting.sendTime} disabled={props.disabled} aria-label={t("timeLabel", { target: label })}>
                      {QUARTERS.map((quarter) => (
                        <option key={quarter} value={quarter}>
                          {quarter}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="row-wrap">
          <button type="submit" className="primary" disabled={pending || props.disabled}>
            {props.submitLabel}
          </button>
        </div>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{state.success}</p> : null}
      </form>
      {props.resetAction ? (
        <form action={resetFormAction}>
          <input type="hidden" name="eventId" value={props.eventId} />
          <button type="submit" className="button-ghost" disabled={resetPending || props.disabled}>
            {t("event.reset")}
          </button>
          {resetState.success ? <p role="status">{resetState.success}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

