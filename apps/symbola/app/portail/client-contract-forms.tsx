"use client";

// Lot 31b (JUR-07 ; réponse 1 de l'avocat, D13) — sur le portail, avant de signer : la commande
// avec obligation de paiement (contrat à distance), puis le lien de signature ; la demande
// d'exécution avant la fin du délai de rétractation, case distincte de la signature, au texte
// de la clause du contrat. Dans l'aperçu « vu par » de la planner, rien ne s'enregistre.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { orderContractAction, requestEarlyExecutionAction, type ContractActState } from "./actions";

export function OrderContractForm({ contractId, preview = false }: { contractId: string; preview?: boolean }) {
  const t = useTranslations("ClientSpace");
  const [state, action, pending] = useActionState(orderContractAction, {} as ContractActState);
  return (
    <form action={preview ? undefined : action} aria-label={t("orderButton")}>
      <input type="hidden" name="contractId" value={contractId} />
      <p className="meta">{t("orderHint")}</p>
      <button type="submit" disabled={pending || preview}>
        {t("orderButton")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}

export function EarlyExecutionForm({ contractId, text, preview = false }: { contractId: string; text: string; preview?: boolean }) {
  const t = useTranslations("ClientSpace");
  const [state, action, pending] = useActionState(requestEarlyExecutionAction, {} as ContractActState);
  return (
    <form action={preview ? undefined : action} aria-label={t("earlyExecutionTitle")}>
      <input type="hidden" name="contractId" value={contractId} />
      <fieldset disabled={preview}>
        <legend>{t("earlyExecutionTitle")}</legend>
        <p className="meta">{t("earlyExecutionHint")}</p>
        <label>
          <input type="checkbox" name="confirm" required /> {text}
        </label>
      </fieldset>
      <button type="submit" disabled={pending || preview}>
        {t("earlyExecutionSubmit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("earlyExecutionSaved")}</p> : null}
    </form>
  );
}
