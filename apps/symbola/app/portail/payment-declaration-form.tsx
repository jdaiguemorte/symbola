"use client";

// Lot 27a (SC-06 étape 5, décision D6) — « Je l'ai réglée » : date (aujourd'hui
// par défaut, jamais dans le futur) et moyen de paiement ; la planner confirme
// ensuite. Dans l'aperçu « vu par » (POR-09), le formulaire est inactif.
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import { declarePaymentAction, type DeclarationState } from "./actions";

export function PaymentDeclarationForm({ paymentId, label, methods, today, preview = false }: { paymentId: string; label: string; methods: string[]; today: string; preview?: boolean }) {
  const t = useTranslations("LinkPortal");
  const [state, formAction, pending] = useActionState(declarePaymentAction, {} as DeclarationState);
  const ids = { date: useId(), method: useId() };
  if (state.success) return <p role="status">{t("declareSent")}</p>;
  return (
    <form action={preview ? undefined : formAction} className="link-form">
      <input type="hidden" name="paymentId" value={paymentId} />
      <label htmlFor={ids.date}>{t("declareDate")}</label>
      <input id={ids.date} type="date" name="paidOn" defaultValue={today} max={today} required />
      <label htmlFor={ids.method}>{t("declareMethod")}</label>
      <select id={ids.method} name="method" required defaultValue={methods[0] ?? ""}>
        {methods.map((method) => (
          <option key={method} value={method}>
            {method}
          </option>
        ))}
      </select>
      <button type="submit" className="primary" disabled={pending || preview}>
        <span aria-hidden="true">{t("declareSubmitShort")}</span>
        <span className="sr-only">{t("declareSubmit", { label })}</span>
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
