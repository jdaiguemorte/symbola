"use client";

// Lot 62b (UX-12) : formulaire en ligne, dans la carte « TVA » ; la date en champ court, le bouton
// en secondaire (le bouton principal de l'écran est « Enregistrer la fiche »).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { changeVatRegimeAction, type VatRegimeFormState } from "./actions";
import type { VatRegime } from "@/modules/hub/service";

export function VatRegimeForm({ currentRegime }: { currentRegime: VatRegime | null }) {
  const t = useTranslations("Settings");
  const initialState: VatRegimeFormState = {};
  const [state, formAction, pending] = useActionState(changeVatRegimeAction, initialState);

  return (
    <form action={formAction} className="form-inline" aria-label={t("vatRegimeTitle")}>
      <label>
        {t("newRegime")}
        <select name="newRegime" defaultValue={currentRegime ?? "franchise"}>
          <option value="franchise">{t("vatRegimeFranchise")}</option>
          <option value="assujetti">{t("vatRegimeAssujetti")}</option>
        </select>
      </label>
      <label>
        {t("effectiveDate")}
        <input className="field-date" type="date" name="effectiveDate" required />
      </label>
      <button type="submit" className="button-secondary" disabled={pending}>
        {t("changeRegime")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("regimeChanged")}</p> : null}
    </form>
  );
}
