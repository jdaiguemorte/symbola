"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { PrivacySettings } from "@/modules/hub/service";
import { savePrivacySettingsAction, type SettingsFormState } from "./actions";

const FIELDS: (keyof PrivacySettings)[] = ["requestAlertDays", "prospectRetentionMonths", "clientRetentionMonths", "accountingRetentionMonths", "inactiveAccountMonths", "signedQuoteRetentionMonths"];

export function PrivacySettingsForm({ settings }: { settings: PrivacySettings }) {
  const t = useTranslations("Privacy");
  const initialState: SettingsFormState = {};
  const [state, formAction, pending] = useActionState(savePrivacySettingsAction, initialState);
  return (
    <form action={formAction}>
      {FIELDS.map((field) => (
        <label key={field}>
          {t(`setting.${field}`)}
          <input type="number" name={field} min={1} max={1200} step={1} required defaultValue={settings[field]} />
        </label>
      ))}
      <button type="submit" disabled={pending}>
        {t("saveSettings")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("settingsSaved")}</p> : null}
    </form>
  );
}
