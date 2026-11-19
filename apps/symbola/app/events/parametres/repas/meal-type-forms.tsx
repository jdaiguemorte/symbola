"use client";

// Lot 50 (INV-06 ; D5) — ajouter un type de repas, renommer un type (ou reprendre le libellé de
// départ). Résultat annoncé (role="status"), erreur (role="alert").
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addMealTypeAction, renameMealTypeAction, type MealTypeState } from "./actions";

export function AddMealTypeForm() {
  const t = useTranslations("Guests.mealTypes");
  const [state, action, pending] = useActionState(addMealTypeAction, {} as MealTypeState);
  return (
    <form action={action} className="seating-form">
      <label>
        {t("label")}
        <input name="label" required maxLength={60} />
      </label>
      <button type="submit" disabled={pending}>
        {t("add")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{state.success}</p> : null}
    </form>
  );
}

export function RenameMealTypeForm({ id, label, starter }: { id: string; label: string; starter: boolean }) {
  const t = useTranslations("Guests.mealTypes");
  const [state, action, pending] = useActionState(renameMealTypeAction, {} as MealTypeState);
  return (
    <form action={action} className="seating-form">
      <input type="hidden" name="mealTypeId" value={id} />
      <label>
        {t("label")}
        <input name="label" defaultValue={label} maxLength={60} />
      </label>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {starter ? (
        <button type="submit" name="reset" value="1" className="button-ghost" disabled={pending}>
          {t("reset")}
        </button>
      ) : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{state.success}</p> : null}
    </form>
  );
}
