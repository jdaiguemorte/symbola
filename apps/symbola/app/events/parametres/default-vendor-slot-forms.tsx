"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  addDefaultVendorSlotAction,
  loadStarterVendorSlotsAction,
  type DefaultVendorSlotFormState,
} from "./vendor-slot-actions";

export function DefaultVendorSlotForm() {
  const t = useTranslations("Events");
  const initialState: DefaultVendorSlotFormState = {};
  const [state, formAction, pending] = useActionState(addDefaultVendorSlotAction, initialState);

  return (
    <form action={formAction}>
      <label>
        {t("newDefaultVendorSlotLabel")}
        <input type="text" name="label" required />
      </label>
      <button type="submit" disabled={pending}>
        {t("addDefaultVendorSlot")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("defaultVendorSlotAdded")}</p> : null}
    </form>
  );
}

export function LoadStarterVendorSlotsForm() {
  const t = useTranslations("Events");
  const initialState: DefaultVendorSlotFormState = {};
  const [state, formAction, pending] = useActionState(loadStarterVendorSlotsAction, initialState);

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending}>
        {t("loadStarterVendorSlots")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("starterVendorSlotsLoaded", { count: state.added ?? 0 })}</p> : null}
    </form>
  );
}
