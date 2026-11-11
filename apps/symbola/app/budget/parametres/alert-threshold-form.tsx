"use client";

// Lot 28a (BUD-02, décision D4) — seuil d'alerte de l'organisation, repris par
// chaque événement qui n'a pas le sien.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setOrganizationAlertThresholdAction, type AllocationModelFormState } from "./actions";

export function AlertThresholdForm({ percent }: { percent: number }) {
  const t = useTranslations("Budget");
  const initialState: AllocationModelFormState = {};
  const [state, formAction, pending] = useActionState(setOrganizationAlertThresholdAction, initialState);
  return (
    <form action={formAction}>
      <label>
        {t("organizationThreshold")}
        <input type="number" min="1" max="500" step="1" name="percent" defaultValue={percent} required />
      </label>
      <button type="submit" disabled={pending}>
        {t("saveThreshold")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("thresholdSaved")}</p> : null}
    </form>
  );
}
