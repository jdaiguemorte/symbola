"use client";

// Lot 66a (HUB-28 ; D1 ; M17) — l'heure d'envoi : celle de l'organisation (« Heure d'envoi par
// défaut ») ou celle d'un automatisme (« Envoi à », « l'heure par défaut » s'il n'en a pas), au quart
// d'heure, dans le fuseau de l'évènement.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveAutomationSendTimeAction, saveDefaultSendTimeAction, type AutomationFormState } from "./actions";

const QUARTERS = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`);

export function DefaultSendTimeForm({ time, disabled }: { time: string; disabled: boolean }) {
  const t = useTranslations("Automations");
  const [state, formAction, pending] = useActionState<AutomationFormState, FormData>(saveDefaultSendTimeAction, {});
  return (
    <form action={formAction} className="form-inline">
      <label>
        {t("defaultTimeLabel")}
        <select name="time" defaultValue={time} disabled={disabled}>
          {QUARTERS.map((quarter) => (
            <option key={quarter} value={quarter}>
              {quarter}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending || disabled} className="button-secondary">
        {t("saveTime")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("timeSaved")}</p> : null}
    </form>
  );
}

export function AutomationSendTimeForm({ automationKey, title, time, defaultTime, disabled }: { automationKey: string; title: string; time: string | null; defaultTime: string; disabled: boolean }) {
  const t = useTranslations("Automations");
  const [state, formAction, pending] = useActionState<AutomationFormState, FormData>(saveAutomationSendTimeAction, {});
  return (
    <form action={formAction} className="form-inline">
      <input type="hidden" name="key" value={automationKey} />
      <label>
        {t("sendAt")}
        <select name="time" defaultValue={time ?? ""} disabled={disabled} aria-label={t("sendAtLabel", { title })}>
          <option value="">{t("defaultOption", { time: defaultTime })}</option>
          {QUARTERS.map((quarter) => (
            <option key={quarter} value={quarter}>
              {quarter}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending || disabled} className="button-secondary" aria-label={t("saveTimeLabel", { title })}>
        {t("saveTime")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("timeSaved")}</p> : null}
    </form>
  );
}
