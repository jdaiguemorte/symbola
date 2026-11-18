"use client";

// Lot 41 (JUR-02, D10) — option pour le paiement de la TVA d'après les débits : oui (à partir d'une
// date) ou non. Réservée au régime assujetti ; la facture imprime la mention quand elle est active
// à sa date d'émission.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveVatOnDebitsAction, type VatOnDebitsFormState } from "./actions";

export function VatOnDebitsForm({ value, from }: { value: boolean | null; from: string | null }) {
  const t = useTranslations("Settings");
  const [state, formAction, pending] = useActionState(saveVatOnDebitsAction, {} as VatOnDebitsFormState);
  return (
    <form action={formAction} aria-label={t("vatOnDebitsTitle")}>
      <fieldset>
        <legend>{t("vatOnDebitsQuestion")}</legend>
        <label className="checkbox-label">
          <input type="radio" name="vatOnDebits" value="no" defaultChecked={value === false} /> {t("vatOnDebitsNo")}
        </label>
        <label className="checkbox-label">
          <input type="radio" name="vatOnDebits" value="yes" defaultChecked={value === true} /> {t("vatOnDebitsYes")}
        </label>
      </fieldset>
      <label>
        {t("vatOnDebitsFrom")}
        <input type="date" name="vatOnDebitsFrom" defaultValue={from ?? ""} />
      </label>
      <button type="submit" disabled={pending}>
        {t("vatOnDebitsSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("vatOnDebitsSaved")}</p> : null}
    </form>
  );
}
