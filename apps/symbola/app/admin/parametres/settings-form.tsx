"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { savePlatformSettingsAction, type PlatformSettingsFormState } from "./actions";

export function PlatformSettingsForm({
  franchiseThresholdServicesCents,
  franchiseThresholdGoodsCents,
}: {
  franchiseThresholdServicesCents: number | null;
  franchiseThresholdGoodsCents: number | null;
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
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.success ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}
