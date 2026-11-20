"use client";

// Lot 53 (GC-02, CHR-05 ; D7) — une règle du radar (active, seuil) ; les seuils de la santé du planning.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveHealthThresholdsAction, saveRiskRuleAction, type RadarFormState } from "./actions";

export function RiskRuleForm({ rule, label, enabled, thresholdDays, disabled }: { rule: string; label: string; enabled: boolean; thresholdDays: number; disabled: boolean }) {
  const t = useTranslations("RiskRadar");
  const [state, formAction, pending] = useActionState<RadarFormState, FormData>(saveRiskRuleAction, {});
  return (
    <form action={formAction} className="form-inline" aria-label={label}>
      <input type="hidden" name="rule" value={rule} />
      <label className="checkbox-row">
        <input type="checkbox" name="enabled" defaultChecked={enabled} disabled={disabled} />
        {t("settings.enabled")}
      </label>
      <label>
        {t("settings.threshold")}
        <input type="number" name="thresholdDays" className="field-short" min={0} max={365} defaultValue={thresholdDays} required disabled={disabled} />
      </label>
      <button type="submit" disabled={pending || disabled} className="button-secondary">
        {t("settings.save")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("settings.saved")}</p> : null}
    </form>
  );
}

export function HealthThresholdsForm({ watchPoints, latePoints, milestoneWeight, disabled }: { watchPoints: number; latePoints: number; milestoneWeight: number; disabled: boolean }) {
  const t = useTranslations("RiskRadar");
  const [state, formAction, pending] = useActionState<RadarFormState, FormData>(saveHealthThresholdsAction, {});
  return (
    <form action={formAction}>
      <div className="form-row">
        <label>
          {t("health.watchPoints")}
          <input type="number" name="watchPoints" min={1} max={100} defaultValue={watchPoints} required disabled={disabled} />
        </label>
        <label>
          {t("health.latePoints")}
          <input type="number" name="latePoints" min={1} max={100} defaultValue={latePoints} required disabled={disabled} />
        </label>
        <label>
          {t("health.milestoneWeight")}
          <input type="number" name="milestoneWeight" min={1} max={10} defaultValue={milestoneWeight} required disabled={disabled} />
        </label>
      </div>
      <button type="submit" disabled={pending || disabled}>
        {t("settings.save")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("health.saved")}</p> : null}
    </form>
  );
}
