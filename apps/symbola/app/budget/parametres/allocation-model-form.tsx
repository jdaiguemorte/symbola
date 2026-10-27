"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createAllocationModelAction, type AllocationModelFormState } from "./actions";
import type { DefaultVendorSlot } from "@/modules/events/service";

export function AllocationModelForm({ vendorSlots }: { vendorSlots: DefaultVendorSlot[] }) {
  const t = useTranslations("Budget");
  const initialState: AllocationModelFormState = {};
  const [state, formAction, pending] = useActionState(createAllocationModelAction, initialState);

  return (
    <form action={formAction}>
      <h3>{t("newModelTitle")}</h3>
      <label>
        {t("modelName")}
        <input type="text" name="name" required />
      </label>
      <p>{t("percentagePerSlot")}</p>
      <ul>
        {vendorSlots.map((slot) => (
          <li key={slot.id}>
            <label>
              {slot.label}
              <input type="number" name={`percentage_${slot.id}`} min={0} max={100} step={0.01} /> %
            </label>
          </li>
        ))}
      </ul>
      <button type="submit" disabled={pending}>
        {t("createModel")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("modelCreated")}</p> : null}
    </form>
  );
}
