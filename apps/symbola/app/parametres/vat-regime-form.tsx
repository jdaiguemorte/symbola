"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changeVatRegimeAction, type VatRegimeFormState } from "./actions";
import type { VatRegime } from "@/modules/hub/service";

export function VatRegimeForm({ currentRegime }: { currentRegime: VatRegime | null }) {
  const t = useTranslations("Settings");
  const initialState: VatRegimeFormState = {};
  const [state, formAction, pending] = useActionState(changeVatRegimeAction, initialState);

  return (
    <form action={formAction}>
      <p>
        {t("currentRegime")} :{" "}
        {currentRegime === "franchise"
          ? t("vatRegimeFranchise")
          : currentRegime === "assujetti"
            ? t("vatRegimeAssujetti")
            : t("vatRegimeUnset")}
      </p>
      <label>
        {t("newRegime")}
        <select name="newRegime" defaultValue={currentRegime ?? "franchise"}>
          <option value="franchise">{t("vatRegimeFranchise")}</option>
          <option value="assujetti">{t("vatRegimeAssujetti")}</option>
        </select>
      </label>
      <label>
        {t("effectiveDate")}
        <input type="date" name="effectiveDate" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("changeRegime")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("regimeChanged")}</p> : null}
    </form>
  );
}
