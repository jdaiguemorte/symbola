"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createAllocationModelAction, type AllocationModelFormState } from "./actions";
import type { DefaultVendorSlot } from "@/modules/events/service";

export function AllocationModelForm({ vendorSlots }: { vendorSlots: DefaultVendorSlot[] }) {
  const t = useTranslations("Budget");
  const initialState: AllocationModelFormState = {};
  const [state, formAction, pending] = useActionState(createAllocationModelAction, initialState);

  // Lot 62b (UX-12) : un pourcentage par ligne du budget, en champs courts sur une grille (plus de
  // liste à puces qui porte un formulaire).
  return (
    <form action={formAction} aria-labelledby="budget-new-model">
      <h2 id="budget-new-model" data-tour="budget-new-model">
        {t("newModelTitle")}
      </h2>
      <label>
        {t("modelName")}
        <input type="text" name="name" required />
      </label>
      <fieldset className="percent-fieldset">
        <legend>{t("percentagePerSlot")}</legend>
        <div className="percent-grid">
          {vendorSlots.map((slot) => (
            <label key={slot.id}>
              {slot.label}
              <span className="field-unit">
                <input className="field-short" type="number" name={`percentage_${slot.id}`} min={0} max={100} step={0.01} /> %
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" disabled={pending}>
        {t("createModel")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("modelCreated")}</p> : null}
    </form>
  );
}
