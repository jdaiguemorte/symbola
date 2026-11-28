"use client";

// Lot 53 (HUB-15, UX-16 ; D1, D2) — formulaires des réglages de notifications : le tableau des sortes
// par canal, puis le récapitulatif et les plages de silence.
// Lot 74h (D7, G8 ; page 30) : liste de réglages ; chaque case, chaque liste et chaque heure s'enregistre
// seule, « ✓ Enregistré » à côté (une fois par ligne du tableau) ; plus de bouton « Enregistrer ». Les
// actions serveur reçoivent tout le formulaire, comme avant.
import { useTranslations } from "next-intl";
import type { NotificationChannel, NotificationSettingsView, NotificationType } from "@symbola/contracts";
import { AutoSettingForm, SettingStatus } from "@/app/ui/auto-setting-form";
import type { SavedLabels } from "@/app/ui/saved-indicator";
import { savePreferencesAction, saveScheduleAction } from "./actions";

const CHANNELS: NotificationChannel[] = ["app", "email", "push"];

export function PreferencesForm({ rows, saved }: { rows: { type: NotificationType; label: string; immediate: boolean; channels: Record<NotificationChannel, boolean> }[]; saved: SavedLabels }) {
  const t = useTranslations("Notifications");
  const channelLabel = (channel: NotificationChannel) => t(`settings.channel.${channel}`);
  return (
    <AutoSettingForm action={savePreferencesAction} labels={saved} ariaLabel={t("settings.typesTitle")}>
      <div className="table-scroll">
        <table className="notification-matrix">
          <caption>{t("settings.typesHint")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("settings.columnType")}</th>
              {CHANNELS.map((channel) => (
                <th key={channel} scope="col">
                  {channelLabel(channel)}
                </th>
              ))}
              <td />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.type}>
                <th scope="row">
                  {row.label}
                  {row.immediate ? (
                    <>
                      {" "}
                      <span className="badge">{t("settings.immediate")}</span>
                    </>
                  ) : null}
                </th>
                {CHANNELS.map((channel) => (
                  <td key={channel}>
                    <input type="checkbox" name={`pref:${row.type}:${channel}`} data-setting={`row:${row.type}`} defaultChecked={row.channels[channel]} aria-label={`${row.label} — ${channelLabel(channel)}`} />
                  </td>
                ))}
                <td>
                  <SettingStatus name={`row:${row.type}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AutoSettingForm>
  );
}

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function ScheduleForm({ settings, saved }: { settings: NotificationSettingsView; saved: SavedLabels }) {
  const t = useTranslations("Notifications");
  return (
    <AutoSettingForm action={saveScheduleAction} labels={saved} ariaLabel={t("settings.digestTitle")}>
      <fieldset>
        <legend>{t("settings.digestTitle")}</legend>
        <div className="setting-line-control">
          <label className="checkbox-row">
            <input type="checkbox" name="digestEnabled" defaultChecked={settings.digestEnabled} />
            {t("settings.digestEnabled")}
          </label>
          <SettingStatus name="digestEnabled" />
        </div>
        <div className="setting-line-control">
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
          <SettingStatus name="digestHour" />
        </div>
      </fieldset>
      <fieldset>
        <legend>{t("settings.quietTitle")}</legend>
        <p className="field-hint">{t("settings.quietHint")}</p>
        <div className="setting-line-control">
          <label className="checkbox-row">
            <input type="checkbox" name="quietEnabled" defaultChecked={settings.quietEnabled} />
            {t("settings.quietEnabled")}
          </label>
          <SettingStatus name="quietEnabled" />
        </div>
        <div className="setting-line-control">
          <label>
            {t("settings.quietStart")}
            <input type="time" name="quietStart" defaultValue={hhmm(settings.quietStartMinute)} required />
          </label>
          <SettingStatus name="quietStart" />
          <label>
            {t("settings.quietEnd")}
            <input type="time" name="quietEnd" defaultValue={hhmm(settings.quietEndMinute)} required />
          </label>
          <SettingStatus name="quietEnd" />
        </div>
        <div className="setting-line-control">
          <label className="checkbox-row">
            <input type="checkbox" name="quietSundays" defaultChecked={settings.quietSundays} />
            {t("settings.quietSundays")}
          </label>
          <SettingStatus name="quietSundays" />
        </div>
        <div className="setting-line-control">
          <label className="checkbox-row">
            <input type="checkbox" name="dayOfOverride" defaultChecked={settings.dayOfOverride} />
            {t("settings.dayOfOverride")}
          </label>
          <SettingStatus name="dayOfOverride" />
        </div>
        <p className="field-hint">{t("settings.timeZone", { zone: settings.timeZone })}</p>
      </fieldset>
    </AutoSettingForm>
  );
}
