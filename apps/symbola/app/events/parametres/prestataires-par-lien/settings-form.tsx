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
  // Lot 62b (UX-12) : délais en champs courts, cases regroupées, une ligne par tâche (intitulé, puis
  // échéance en champ court).
  return (
    <form action={action} className="settings-sheet" aria-label={t("settings.title")}>
      <fieldset disabled={!editable} className="sheet-fieldset">
        <section className="card" aria-labelledby="vendor-coordination-delays">
          <h2 id="vendor-coordination-delays">{t("settings.delaysTitle")}</h2>
          <div className="form-grid">
            <label>
              {t("settings.deadlineDays")}
              <input className="field-short" type="number" name="briefDeadlineDays" min={1} max={60} required defaultValue={settings.briefDeadlineDays} />
            </label>
            <label>
              {t("settings.alertDays")}
              <input className="field-short" type="number" name="roadmapAlertDays" min={1} max={6} required defaultValue={settings.roadmapAlertDays} />
            </label>
            <div className="choice-stack span-all">
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
            </div>
          </div>
        </section>
        <section className="card" aria-labelledby="vendor-coordination-tasks">
          <h2 id="vendor-coordination-tasks">{t("settings.tasksTitle")}</h2>
          <p className="field-hint">{t("settings.tasksHint")}</p>
          <div className="task-rows" role="group" aria-labelledby="vendor-coordination-tasks">
            <div className="task-row task-row-head" aria-hidden="true">
              <span>{t("settings.taskColumn")}</span>
              <span>{t("settings.taskDaysColumn")}</span>
            </div>
            {rows.map((task, index) => (
              <div key={index} className="task-row">
                <input type="text" name="taskLabel" maxLength={200} defaultValue={task.label} aria-label={t("settings.taskLabel", { index: index + 1 })} placeholder={index === rows.length - 1 ? t("settings.taskNew") : undefined} />
                <input className="field-short" type="number" name="taskDays" min={0} max={365} defaultValue={task.dueInDays} aria-label={t("settings.taskDays", { index: index + 1 })} />
              </div>
            ))}
          </div>
          {settings.followUpTasksCustomized ? (
            <label className="checkbox">
              <input type="checkbox" name="resetTasks" />
              {t("settings.resetTasks")}
            </label>
          ) : null}
        </section>
        <div className="form-foot">
          <button type="submit" disabled={pending}>
            {t("settings.save")}
          </button>
          {!editable ? <p className="muted">{t("settings.ownerOnly")}</p> : null}
          {state.error ? <p role="alert">{state.error}</p> : null}
          {state.success ? <p role="status">{t("settings.saved")}</p> : null}
        </div>
      </fieldset>
    </form>
  );
}
