"use client";

// Lot 53 (HUB-28 ; D5) — le délai d'un automatisme (jours avant l'échéance du rappel au payeur).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveAutomationDaysAction, type AutomationFormState } from "./actions";

export function AutomationDaysForm({ automationKey, days, disabled }: { automationKey: string; days: number; disabled: boolean }) {
  const t = useTranslations("Automations");
  const [state, formAction, pending] = useActionState<AutomationFormState, FormData>(saveAutomationDaysAction, {});
  return (
    <form action={formAction} className="form-inline">
      <input type="hidden" name="key" value={automationKey} />
      <label>
        {t("days")}
        <input type="number" name="days" className="field-short" min={1} max={60} defaultValue={days} required disabled={disabled} />
      </label>
      <button type="submit" disabled={pending || disabled} className="button-secondary">
        {t("saveDays")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}
