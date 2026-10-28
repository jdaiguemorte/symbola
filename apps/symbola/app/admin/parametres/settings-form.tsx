"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { savePlatformSettingsAction, type PlatformSettingsFormState } from "./actions";

export function PlatformSettingsForm({
  franchiseThresholdServicesCents,
  franchiseThresholdGoodsCents,
  importMaxMegabytes,
  importMaxRows,
  importDraftRetentionDays,
}: {
  franchiseThresholdServicesCents: number | null;
  franchiseThresholdGoodsCents: number | null;
  importMaxMegabytes: number;
  importMaxRows: number;
  importDraftRetentionDays: number;
}) {
  const t = useTranslations("AdminSettings");
  const initialState: PlatformSettingsFormState = {};
  const [state, formAction, pending] = useActionState(savePlatformSettingsAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("thresholdServices")}
        <input
          type="number"
          step="0.01"
          name="franchiseThresholdServices"
          defaultValue={franchiseThresholdServicesCents !== null ? franchiseThresholdServicesCents / 100 : ""}
        />
      </label>
      <label>
        {t("thresholdGoods")}
        <input
          type="number"
          step="0.01"
          name="franchiseThresholdGoods"
          defaultValue={franchiseThresholdGoodsCents !== null ? franchiseThresholdGoodsCents / 100 : ""}
        />
      </label>
      <fieldset>
        <legend>{t("importLegend")}</legend>
        <label>
          {t("importMaxMegabytes")}
          <input type="number" min="1" max="20" step="1" name="importMaxMegabytes" defaultValue={importMaxMegabytes} required />
        </label>
        <label>
          {t("importMaxRows")}
          <input type="number" min="1" step="1" name="importMaxRows" defaultValue={importMaxRows} required />
        </label>
        <label>
          {t("importDraftRetentionDays")}
          <input type="number" min="1" step="1" name="importDraftRetentionDays" defaultValue={importDraftRetentionDays} required />
        </label>
      </fieldset>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.success ? <p role="status">{t("saved")}</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
