"use client";

// Lot 27a (SC-06 étape 5, décision D6) — refuser un règlement déclaré par un
// client : le motif est montré au client, l'échéance redevient à régler.
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import { refusePaymentDeclarationAction, type BudgetFormState } from "./actions";

export function DeclarationRefusalForm({ eventId, paymentId, label }: { eventId: string; paymentId: string; label: string }) {
  const t = useTranslations("Budget");
  const [state, formAction, pending] = useActionState(refusePaymentDeclarationAction, {} as BudgetFormState);
  const reasonId = useId();
  return (
    <form action={formAction} className="link-form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <label htmlFor={reasonId}>{t("declarationReason")}</label>
      <input id={reasonId} name="reason" required maxLength={300} />
      <button type="submit" disabled={pending}>
        {t("refuseDeclaration", { label })}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
