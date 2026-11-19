"use client";

// Lot 43 (FAC-08, ADR 0087) — « J'ai fait le virement » : la déclaration du payeur, datée ; la planner
// confirme ensuite l'encaissement. Aucun paiement ne transite par Symbola.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { declareTransferAction, type TransferState } from "./actions";

export function TransferDeclarationForm({ scheduleItemId, today, preview = false }: { scheduleItemId: string; today: string; preview?: boolean }) {
  const t = useTranslations("Settlement");
  const [state, action, pending] = useActionState(declareTransferAction, {} as TransferState);
  const inputId = `transfer-date-${scheduleItemId}`;
  if (state.success) return <p role="status">{t("declaredNow")}</p>;
  return (
    <form action={preview ? undefined : action} aria-label={t("declareTitle")} className="transfer-declaration">
      <input type="hidden" name="scheduleItemId" value={scheduleItemId} />
      <label htmlFor={inputId}>{t("declareDate")}</label>
      <input id={inputId} type="date" name="paidOn" defaultValue={today} max={today} required disabled={preview} />
      <button type="submit" disabled={pending || preview}>
        {t("declareButton")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
