"use client";

// Lot 35a (HUB-13, D4) — bouton « Préparer l'export » et son retour (demandé, déjà en cours,
// refusé), annoncé aux lecteurs d'écran.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestOrganizationExportAction, type RequestExportState } from "./actions";

export function RequestExportForm() {
  const t = useTranslations("OrganizationExport");
  const [state, action, pending] = useActionState<RequestExportState, FormData>(requestOrganizationExportAction, {});
  return (
    <form action={action} aria-label={t("requestTitle")} className="stack">
      <button type="submit" disabled={pending}>
        {t("request")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <p role="status">{state.message ?? ""}</p>
    </form>
  );
}
