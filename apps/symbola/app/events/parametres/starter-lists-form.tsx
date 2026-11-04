"use client";

// EVT-07 — bouton « Charger les listes de départ » (sources de prospect et
// motifs de perte), dans les paramètres et sur « Nouveau prospect ».
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loadStarterListsAction, type EventsSettingsFormState } from "./actions";

export function LoadStarterListsForm() {
  const t = useTranslations("Events");
  const initialState: EventsSettingsFormState = {};
  const [state, formAction, pending] = useActionState(loadStarterListsAction, initialState);

  return (
    <form action={formAction} className="primary-action">
      <button type="submit" disabled={pending}>
        {t("loadStarterLists")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("starterListsLoaded", { sources: state.sources ?? 0, reasons: state.reasons ?? 0 })}</p> : null}
    </form>
  );
}
