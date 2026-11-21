"use client";

// Lot 58 (FAC-11 ; D2) — exercice et plan de comptes (valeurs de départ à relire avec le comptable, EC-9).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveAccountingSettingsAction, type AccountingSettingsState } from "./actions";

type Plan = { accounts: Record<string, { number: string; label: string }>; journals: Record<string, { code: string; label: string }> };

export function AccountingSettingsForm({ fiscalYearStartMonth, plan, months }: { fiscalYearStartMonth: number; plan: Plan; months: string[] }) {
  const t = useTranslations("AccountingExports");
  const [state, action, pending] = useActionState<AccountingSettingsState, FormData>(saveAccountingSettingsAction, {});
  // Lot 62b (UX-12) : le plan de comptes est un tableau (compte, libellé), une ligne par compte ; les
  // journaux de même. Les noms des champs ne changent pas.
  return (
    <form action={action} className="plan-form" aria-label={t("settingsTitle")}>
      <label className="field-fit">
        {t("fiscalYearStart")}
        <select name="fiscalYearStartMonth" className="field-choice" defaultValue={String(fiscalYearStartMonth)}>
          {months.map((month, index) => (
            <option key={index} value={index + 1}>
              {month}
            </option>
          ))}
        </select>
      </label>
      <div className="list-table-wrap" role="region" aria-label={t("accountsTableLabel")} tabIndex={0}>
        <table className="list-table plan-table">
          <thead>
            <tr>
              <th scope="col">{t("accountsColumnUse")}</th>
              <th scope="col">{t("accountsColumnNumber")}</th>
              <th scope="col">{t("accountsColumnLabel")}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(plan.accounts).map(([key, account]) => (
              <tr key={key}>
                <th scope="row">{t(`accounts.${key}`)}</th>
                <td>
                  <input className="field-code" name={`account.${key}`} defaultValue={account.number} maxLength={20} required aria-label={t("accountNumber", { name: t(`accounts.${key}`) })} />
                </td>
                <td>
                  <input name={`accountLabel.${key}`} defaultValue={account.label} maxLength={100} required aria-label={t("accountLabel", { name: t(`accounts.${key}`) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="list-table-wrap" role="region" aria-label={t("journalsTableLabel")} tabIndex={0}>
        <table className="list-table plan-table">
          <thead>
            <tr>
              <th scope="col">{t("journalsColumnUse")}</th>
              <th scope="col">{t("journalsColumnCode")}</th>
              <th scope="col">{t("accountsColumnLabel")}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(plan.journals).map(([key, journal]) => (
              <tr key={key}>
                <th scope="row">{t(`journals.${key}`)}</th>
                <td>
                  <input className="field-code" name={`journal.${key}`} defaultValue={journal.code} maxLength={10} required aria-label={t("journalCode", { name: t(`journals.${key}`) })} />
                </td>
                <td>
                  <input name={`journalLabel.${key}`} defaultValue={journal.label} maxLength={100} required aria-label={t("journalLabel", { name: t(`journals.${key}`) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="submit" disabled={pending}>
        {t("saveSettings")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("settingsSaved")}</p> : null}
    </form>
  );
}
