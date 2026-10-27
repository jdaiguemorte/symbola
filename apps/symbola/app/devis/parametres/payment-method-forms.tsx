"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { addPaymentMethodAction, loadStarterPaymentMethodsAction, type QuoteSettingsFormState } from "./actions";

export function AddPaymentMethodForm() {
  const t = useTranslations("Quotes");
  const initialState: QuoteSettingsFormState = {};
  const [state, formAction, pending] = useActionState(addPaymentMethodAction, initialState);
  return (
    <form action={formAction}>
      <label htmlFor="payment-method-label">{t("newPaymentMethod")}</label>
      <input id="payment-method-label" type="text" name="label" required />
      <button type="submit" disabled={pending}>
        {t("addPaymentMethod")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("paymentMethodAdded")}</p> : null}
    </form>
  );
}

export function LoadStarterPaymentMethodsForm() {
  const t = useTranslations("Quotes");
  const initialState: QuoteSettingsFormState = {};
  const [state, formAction, pending] = useActionState(loadStarterPaymentMethodsAction, initialState);
  return (
    <form action={formAction}>
      <button type="submit" disabled={pending}>
        {t("loadStarterPaymentMethods")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("starterPaymentMethodsLoaded")}</p> : null}
    </form>
  );
}
