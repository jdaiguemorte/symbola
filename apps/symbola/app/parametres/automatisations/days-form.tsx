"use client";

// Lot 53 (HUB-28 ; D5) — le délai d'un automatisme (jours avant l'échéance du rappel au payeur).
// Lot 74h (D7, G8) : réglage isolé, enregistré à la sortie du champ, « ✓ Enregistré » à côté.
import { useTranslations } from "next-intl";
import { AutoSettingForm, SettingStatus } from "@/app/ui/auto-setting-form";
import type { SavedLabels } from "@/app/ui/saved-indicator";
import { saveAutomationDaysAction } from "./actions";

export function AutomationDaysForm({ automationKey, title, days, disabled, saved }: { automationKey: string; title: string; days: number; disabled: boolean; saved: SavedLabels }) {
  const t = useTranslations("Automations");
  return (
    <AutoSettingForm action={saveAutomationDaysAction} labels={saved} className="setting-line-control">
      <input type="hidden" name="key" value={automationKey} />
      <label>
        {t("days")}
        <input type="number" name="days" className="field-short setting-days" min={1} max={60} defaultValue={days} required disabled={disabled} aria-label={`${t("days")} — ${title}`} />
      </label>
      <SettingStatus name="days" />
    </AutoSettingForm>
  );
}
