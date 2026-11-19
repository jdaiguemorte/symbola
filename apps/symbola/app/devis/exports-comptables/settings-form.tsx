"use client";

// Lot 58 (FAC-11 ; D2) — exercice et plan de comptes (valeurs de départ à relire avec le comptable, EC-9).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveAccountingSettingsAction, type AccountingSettingsState } from "./actions";

type Plan = { accounts: Record<string, { number: string; label: string }>; journals: Record<string, { code: string; label: string }> };

export function AccountingSettingsForm({ fiscalYearStartMonth, plan, months }: { fiscalYearStartMonth: number; plan: Plan; months: string[] }) {
  const t = useTranslations("AccountingExports");
  const [state, action, pending] = useActionState<AccountingSettingsState, FormData>(saveAccountingSettingsAction, {});
  return (
    <form action={action} className="stack">
      <label>
        {t("fiscalYearStart")}
        <select name="fiscalYearStartMonth" defaultValue={String(fiscalYearStartMonth)}>
          {months.map((month, index) => (
            <option key={index} value={index + 1}>
              {month}
            </option>
          ))}
        </select>
      </label>
      {Object.entries(plan.accounts).map(([key, account]) => (
        <div key={key} className="row-wrap">
          <label>
            {t("accountNumber", { name: t(`accounts.${key}`) })}
            <input name={`account.${key}`} defaultValue={account.number} maxLength={20} required />
          </label>
          <label>
            {t("accountLabel", { name: t(`accounts.${key}`) })}
            <input name={`accountLabel.${key}`} defaultValue={account.label} maxLength={100} required />
          </label>
        </div>
      ))}
      {Object.entries(plan.journals).map(([key, journal]) => (
        <div key={key} className="row-wrap">
          <label>
            {t("journalCode", { name: t(`journals.${key}`) })}
            <input name={`journal.${key}`} defaultValue={journal.code} maxLength={10} required />
          </label>
          <label>
            {t("journalLabel", { name: t(`journals.${key}`) })}
            <input name={`journalLabel.${key}`} defaultValue={journal.label} maxLength={100} required />
          </label>
        </div>
      ))}
      <button type="submit" disabled={pending}>
        {t("saveSettings")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("settingsSaved")}</p> : null}
    </form>
  );
}
