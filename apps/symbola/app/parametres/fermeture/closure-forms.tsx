"use client";

// Lot 35c (RGP-11, UX-07) — « Fermer l'espace » (nom de l'espace écrit pour confirmer) et « Rouvrir
// l'espace » ; le retour est annoncé aux lecteurs d'écran.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { closeOrganizationAction, reopenOrganizationAction, type ClosureState } from "./actions";

export function CloseOrganizationForm({ organizationName }: { organizationName: string }) {
  const t = useTranslations("OrganizationClosure");
  const [state, action, pending] = useActionState<ClosureState, FormData>(closeOrganizationAction, {});
  return (
    <form action={action} aria-label={t("confirmTitle")} className="stack">
      <label>
        {t("confirmLabel", { name: organizationName })}
        <input type="text" name="confirmation" required autoComplete="off" aria-describedby="closure-hint" />
      </label>
      <p id="closure-hint" className="meta">
        {t("confirmHint")}
      </p>
      <button type="submit" className="button-danger" disabled={pending}>
        {t("submit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <p role="status">{state.message ?? ""}</p>
    </form>
  );
}

export function ReopenOrganizationForm() {
  const t = useTranslations("OrganizationClosure");
  const [state, action, pending] = useActionState<ClosureState, FormData>(reopenOrganizationAction, {});
  return (
    <form action={action} aria-label={t("reopenTitle")} className="stack">
      <button type="submit" disabled={pending}>
        {t("reopen")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <p role="status">{state.message ?? ""}</p>
    </form>
  );
}
