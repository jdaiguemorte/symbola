"use client";

// Lot 74h (D7, G10 ; page 30) — l'interrupteur « en marche » d'un automatisme : réglage isolé, enregistré au
// changement, « ✓ Enregistré » à côté. Son nom accessible est le titre de l'automatisme ; l'état est aussi
// écrit en mots à côté du titre (la page). La titulaire seule le voit (la page ne le rend pas à l'équipe).
import { AutoSettingForm, SettingStatus } from "@/app/ui/auto-setting-form";
import type { SavedLabels } from "@/app/ui/saved-indicator";
import { setAutomationRunningAction } from "./actions";

export function AutomationRunningSwitch({ automationKey, label, enabled, saved }: { automationKey: string; label: string; enabled: boolean; saved: SavedLabels }) {
  return (
    <AutoSettingForm action={setAutomationRunningAction} labels={saved} className="setting-line-control">
      <input type="hidden" name="key" value={automationKey} />
      <label className="switch">
        <input type="checkbox" role="switch" name="enabled" value="1" defaultChecked={enabled} />
        <span className="sr-only">{label}</span>
      </label>
      <SettingStatus name="enabled" />
    </AutoSettingForm>
  );
}
