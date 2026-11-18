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
    <form action={action} aria-label={t("formLabel")}>
      <label htmlFor="expiry-reminder-days">{t("expiryDays")}</label>
      <input id="expiry-reminder-days" type="number" name="expiryReminderDays" min={1} max={30} required defaultValue={settings.expiryReminderDays} aria-describedby="expiry-reminder-hint" />
      <p id="expiry-reminder-hint" className="meta">
        {t("expiryHint")}
      </p>
      <label htmlFor="payment-reminder-days">{t("paymentDays")}</label>
      <input id="payment-reminder-days" type="text" name="paymentReminderDays" required defaultValue={settings.paymentReminderDays.join(", ")} aria-describedby="payment-reminder-hint" />
      <p id="payment-reminder-hint" className="meta">
        {t("paymentHint")}
      </p>
      <label htmlFor="consumer-rate">{t("consumerRate")}</label>
      <input
        id="consumer-rate"
        type="text"
        inputMode="decimal"
        name="consumerRate"
        defaultValue={settings.consumerLatePenaltyBasisPoints === null ? "" : formatDecimal(settings.consumerLatePenaltyBasisPoints, 2, locale)}
        aria-describedby="consumer-rate-hint"
      />
      <p id="consumer-rate-hint" className="meta">
        {t("consumerRateHint")}
      </p>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}
