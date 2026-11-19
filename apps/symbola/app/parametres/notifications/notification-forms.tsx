"use client";

// Lot 53 (HUB-15, UX-16 ; D1, D2) — formulaires des réglages de notifications : le tableau des sortes
// par canal, puis le récapitulatif et les plages de silence.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { NotificationChannel, NotificationSettingsView, NotificationType } from "@symbola/contracts";
import { savePreferencesAction, saveScheduleAction, type NotificationFormState } from "./actions";

const CHANNELS: NotificationChannel[] = ["app", "email", "push"];

export function PreferencesForm({ rows }: { rows: { type: NotificationType; label: string; immediate: boolean; channels: Record<NotificationChannel, boolean> }[] }) {
  const t = useTranslations("Notifications");
  const [state, formAction, pending] = useActionState<NotificationFormState, FormData>(savePreferencesAction, {});
  return (
    <form action={formAction}>
      <div className="table-scroll">
        <table className="notification-matrix">
          <caption>{t("settings.typesHint")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("settings.columnType")}</th>
              {CHANNELS.map((channel) => (
                <th key={channel} scope="col">
                  {t(`settings.channel.${channel}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.type}>
                <th scope="row">
                  {row.label}
                  {row.immediate ? <span className="badge">{t("settings.immediate")}</span> : null}
                </th>
                {CHANNELS.map((channel) => (
                  <td key={channel}>
                    <input type="checkbox" name={`pref:${row.type}:${channel}`} defaultChecked={row.channels[channel]} aria-label={`${row.label} — ${t(`settings.channel.${channel}`)}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="submit" disabled={pending}>
        {t("settings.save")}
      </button>
      {state.success ? <p role="status">{t("settings.saved")}</p> : null}
    </form>
  );
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function ScheduleForm({ settings }: { settings: NotificationSettingsView }) {
  const t = useTranslations("Notifications");
  const [state, formAction, pending] = useActionState<NotificationFormState, FormData>(saveScheduleAction, {});
  return (
    <form action={formAction}>
      <fieldset>
        <legend>{t("settings.digestTitle")}</legend>
        <label className="checkbox-row">
          <input type="checkbox" name="digestEnabled" defaultChecked={settings.digestEnabled} />
          {t("settings.digestEnabled")}
        </label>
        <label>
          {t("settings.digestHour")}
          <select name="digestHour" defaultValue={String(settings.digestHour)}>
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {hhmm(hour * 60)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>{t("settings.quietTitle")}</legend>
        <p className="field-hint">{t("settings.quietHint")}</p>
        <label className="checkbox-row">
          <input type="checkbox" name="quietEnabled" defaultChecked={settings.quietEnabled} />
          {t("settings.quietEnabled")}
        </label>
        <div className="form-row">
          <label>
            {t("settings.quietStart")}
            <input type="time" name="quietStart" defaultValue={hhmm(settings.quietStartMinute)} required />
          </label>
          <label>
            {t("settings.quietEnd")}
            <input type="time" name="quietEnd" defaultValue={hhmm(settings.quietEndMinute)} required />
          </label>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" name="quietSundays" defaultChecked={settings.quietSundays} />
          {t("settings.quietSundays")}
        </label>
        <label className="checkbox-row">
          <input type="checkbox" name="dayOfOverride" defaultChecked={settings.dayOfOverride} />
          {t("settings.dayOfOverride")}
        </label>
        <p className="field-hint">{t("settings.timeZone", { zone: settings.timeZone })}</p>
      </fieldset>
      <button type="submit" disabled={pending}>
        {t("settings.save")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("settings.saved")}</p> : null}
    </form>
  );
}
