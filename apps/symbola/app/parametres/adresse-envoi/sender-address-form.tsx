"use client";

// Lot 55 (MSG-04 révisée ; ADR 0101) — la partie locale de l'adresse d'expédition, avant le domaine
// d'envoi de Symbola.
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import { saveSenderAddressAction, type SenderAddressFormState } from "./actions";

export function SenderAddressForm({ localPart, domain }: { localPart: string; domain: string }) {
  const t = useTranslations("SenderAddress");
  const [state, action, pending] = useActionState(saveSenderAddressAction, {} as SenderAddressFormState);
  const id = useId();
  return (
    <form action={action} className="stack">
      <label htmlFor={id}>{t("localPartLabel")}</label>
      <div className="form-inline">
        <input id={id} name="localPart" defaultValue={localPart} minLength={2} maxLength={40} pattern="[a-z0-9.\-]+" autoComplete="off" spellCheck={false} aria-describedby={`${id}-hint`} required />
        <span>@{domain}</span>
      </div>
      <p id={`${id}-hint`} className="field-hint">
        {t("localPartHint")}
      </p>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}
