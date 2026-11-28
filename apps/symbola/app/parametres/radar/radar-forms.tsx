"use client";

// Lot 53 (GC-02, CHR-05 ; D7) — une règle du radar (active, seuil) ; les seuils de la santé du planning.
// Lot 74h (D7, G8 ; page 30) : réglages isolés, enregistrés au changement de la case ou à la sortie du
// champ, « ✓ Enregistré » à côté ; plus de bouton « Enregistrer ». Une valeur hors bornes s'écrit sous
// le champ et n'est pas envoyée.
import { useTranslations } from "next-intl";
import { AutoSettingForm, SettingStatus } from "@/app/ui/auto-setting-form";
import type { SavedLabels } from "@/app/ui/saved-indicator";
import { saveHealthThresholdsAction, saveRiskRuleAction } from "./actions";

export function RiskRuleForm({ rule, label, enabled, thresholdDays, disabled, saved, invalid }: { rule: string; label: string; enabled: boolean; thresholdDays: number; disabled: boolean; saved: SavedLabels; invalid: string }) {
  const t = useTranslations("RiskRadar");
  return (
    <AutoSettingForm action={saveRiskRuleAction} labels={saved} ariaLabel={label} className="setting-line-control" invalid={{ thresholdDays: invalid }}>
      <input type="hidden" name="rule" value={rule} />
      <label className="checkbox-row">
        <input type="checkbox" name="enabled" defaultChecked={enabled} disabled={disabled} />
        {t("settings.enabled")}
      </label>
      <SettingStatus name="enabled" />
      <label>
        {t("settings.threshold")}
        <input type="number" name="thresholdDays" className="field-short setting-days" min={0} max={365} defaultValue={thresholdDays} required disabled={disabled} />
      </label>
      <SettingStatus name="thresholdDays" />
    </AutoSettingForm>
  );
}

export function HealthThresholdsForm({ watchPoints, latePoints, milestoneWeight, disabled, saved, invalid }: { watchPoints: number; latePoints: number; milestoneWeight: number; disabled: boolean; saved: SavedLabels; invalid: string }) {
  const t = useTranslations("RiskRadar");
  return (
    <AutoSettingForm action={saveHealthThresholdsAction} labels={saved} ariaLabel={t("health.title")} invalid={{ watchPoints: invalid, latePoints: invalid, milestoneWeight: invalid }}>
      {(
        [
          ["watchPoints", watchPoints, 100],
          ["latePoints", latePoints, 100],
          ["milestoneWeight", milestoneWeight, 10],
        ] as const
      ).map(([name, value, max]) => (
        <div key={name} className="setting-line-control">
          <label>
            {t(`health.${name}`)}
            <input type="number" name={name} className="field-short setting-days" min={1} max={max} defaultValue={value} required disabled={disabled} />
          </label>
          <SettingStatus name={name} />
        </div>
      ))}
    </AutoSettingForm>
  );
}
