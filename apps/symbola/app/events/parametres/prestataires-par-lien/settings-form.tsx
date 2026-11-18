"use client";

// Lot 47 (partie F) — formulaire des réglages des prestataires par lien (titulaire).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { VendorCoordinationSettings } from "@symbola/contracts";
import { saveVendorCoordinationSettingsAction, type SettingsState } from "./actions";

export function VendorCoordinationSettingsForm({ settings, editable }: { settings: VendorCoordinationSettings; editable: boolean }) {
  const t = useTranslations("VendorCoordination");
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveVendorCoordinationSettingsAction, {});
  const rows = [...settings.followUpTasks, { label: "", dueInDays: 7 }];
  return (
    <form action={action} className="stack">
      <fieldset disabled={!editable} className="stack">
        <label>
          {t("settings.deadlineDays")}
          <input type="number" name="briefDeadlineDays" min={1} max={60} required defaultValue={settings.briefDeadlineDays} />
        </label>
        <label className="checkbox">
          <input type="checkbox" name="briefReminder" defaultChecked={settings.briefReminder} />
          {t("settings.reminder")}
        </label>
        <label className="checkbox">
          <input type="checkbox" name="roadmapMonth" defaultChecked={settings.roadmapMonth} />
          {t("settings.roadmapMonth")}
        </label>
        <label className="checkbox">
          <input type="checkbox" name="roadmapWeek" defaultChecked={settings.roadmapWeek} />
          {t("settings.roadmapWeek")}
        </label>
        <label>
          {t("settings.alertDays")}
          <input type="number" name="roadmapAlertDays" min={1} max={6} required defaultValue={settings.roadmapAlertDays} />
        </label>
        <fieldset className="stack">
          <legend>{t("settings.tasksTitle")}</legend>
          <p className="muted">{t("settings.tasksHint")}</p>
          {rows.map((task, index) => (
            <div key={index} className="row-wrap">
              <label>
                {t("settings.taskLabel", { index: index + 1 })}
                <input type="text" name="taskLabel" maxLength={200} defaultValue={task.label} />
              </label>
              <label>
                {t("settings.taskDays", { index: index + 1 })}
                <input type="number" name="taskDays" min={0} max={365} defaultValue={task.dueInDays} />
              </label>
            </div>
          ))}
          {settings.followUpTasksCustomized ? (
            <label className="checkbox">
              <input type="checkbox" name="resetTasks" />
              {t("settings.resetTasks")}
            </label>
          ) : null}
        </fieldset>
        <button type="submit" className="primary" disabled={pending}>
          {t("settings.save")}
        </button>
      </fieldset>
      {!editable ? <p className="muted">{t("settings.ownerOnly")}</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("settings.saved")}</p> : null}
    </form>
  );
}
