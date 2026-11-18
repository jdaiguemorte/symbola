"use client";

// Lot 49 (INV-07, RGP-06 ; D6) — ajouter une entrée à la liste des régimes, avec l'avertissement des
// régimes à caractère religieux (conviction religieuse, article 9 : sous la responsabilité de la
// planner, en attendant l'avis de la DPO).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addDietaryOptionAction, type DietaryOptionState } from "./actions";

export function AddDietaryOptionForm() {
  const t = useTranslations("Guests.options");
  const [state, action, pending] = useActionState(addDietaryOptionAction, {} as DietaryOptionState);
  return (
    <form action={action} className="stack">
      <p role="note" className="notice">
        {t("religiousWarning")}
      </p>
      <label>
        {t("label")}
        <input name="label" required maxLength={60} />
      </label>
      <label>
        {t("kind")}
        <select name="kind" defaultValue="diet">
          <option value="diet">{t("kindDiet")}</option>
          <option value="allergen">{t("kindAllergen")}</option>
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("add")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("added")}</p> : null}
    </form>
  );
}
