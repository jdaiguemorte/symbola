"use client";

// Lot 66a (HUB-28 ; D1 ; M17) — l'heure d'envoi : celle de l'organisation (« Heure d'envoi par
// défaut ») ou celle d'un automatisme (« Envoi à », « l'heure par défaut » s'il n'en a pas), au quart
// d'heure, dans le fuseau de l'évènement.
// Lot 74h (D7, G8) : réglages isolés, enregistrés au changement de la liste, « ✓ Enregistré » à côté ;
// plus de bouton « Enregistrer l'heure ».
import { useTranslations } from "next-intl";
import { AutoSettingForm, SettingStatus } from "@/app/ui/auto-setting-form";
import type { SavedLabels } from "@/app/ui/saved-indicator";
import { saveAutomationSendTimeAction, saveDefaultSendTimeAction } from "./actions";

const QUARTERS = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`);

export function DefaultSendTimeForm({ time, disabled, saved }: { time: string; disabled: boolean; saved: SavedLabels }) {
  const t = useTranslations("Automations");
  return (
    <AutoSettingForm action={saveDefaultSendTimeAction} labels={saved} ariaLabel={t("defaultTimeLabel")} className="setting-line-control">
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
      <SettingStatus name="time" />
    </AutoSettingForm>
  );
}

export function AutomationSendTimeForm({ automationKey, title, time, defaultTime, disabled, saved }: { automationKey: string; title: string; time: string | null; defaultTime: string; disabled: boolean; saved: SavedLabels }) {
  const t = useTranslations("Automations");
  return (
    <AutoSettingForm action={saveAutomationSendTimeAction} labels={saved} ariaLabel={t("sendAtLabel", { title })} className="setting-line-control">
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
      <SettingStatus name="time" />
    </AutoSettingForm>
  );
}
