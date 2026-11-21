"use client";

// Lot 43 (FAC-09, FAC-15 ; D1, D7) — réglages des relances de l'organisation.
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ReminderSettings } from "@symbola/contracts";
import { formatDecimal } from "../decimal-input";
import { saveReminderSettingsAction, type ReminderSettingsState } from "./actions";

export function ReminderSettingsForm({ settings }: { settings: ReminderSettings }) {
  const t = useTranslations("ReminderSettings");
  const locale = useLocale() as "fr" | "en";
  const [state, action, pending] = useActionState(saveReminderSettingsAction, {} as ReminderSettingsState);
  return (
    // Lot 62d (UX-12) : formulaire en grille, un réglage par case ; le nombre de jours, la suite de
    // jours et le taux sont des champs courts.
    <form action={action} aria-label={t("formLabel")}>
      <div className="form-grid">
        <div className="settings-field">
          <label htmlFor="expiry-reminder-days">{t("expiryDays")}</label>
          <input id="expiry-reminder-days" type="number" name="expiryReminderDays" min={1} max={30} required defaultValue={settings.expiryReminderDays} aria-describedby="expiry-reminder-hint" className="field-short" />
          <p id="expiry-reminder-hint" className="field-hint">
            {t("expiryHint")}
          </p>
        </div>
        <div className="settings-field">
          <label htmlFor="payment-reminder-days">{t("paymentDays")}</label>
          <input id="payment-reminder-days" type="text" name="paymentReminderDays" required defaultValue={settings.paymentReminderDays.join(", ")} aria-describedby="payment-reminder-hint" className="field-days" />
          <p id="payment-reminder-hint" className="field-hint">
            {t("paymentHint")}
          </p>
        </div>
        <div className="settings-field span-all">
          <label htmlFor="consumer-rate">{t("consumerRate")}</label>
          <input
            id="consumer-rate"
            type="text"
            inputMode="decimal"
            name="consumerRate"
            defaultValue={settings.consumerLatePenaltyBasisPoints === null ? "" : formatDecimal(settings.consumerLatePenaltyBasisPoints, 2, locale)}
            aria-describedby="consumer-rate-hint"
            className="field-short"
          />
          <p id="consumer-rate-hint" className="field-hint">
            {t("consumerRateHint")}
          </p>
        </div>
      </div>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}
