"use client";

// Lot 47 (BUD-05 ; D5) — nouveau scénario d'options.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createScenarioAction, type ScenarioState } from "./actions";

export function CreateScenarioForm({ eventId }: { eventId: string }) {
  const t = useTranslations("VendorCoordination");
  const [state, action, pending] = useActionState<ScenarioState, FormData>(createScenarioAction, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="eventId" value={eventId} />
      <label>
        {t("scenarios.name")}
        <input type="text" name="name" required maxLength={120} autoComplete="off" />
      </label>
      <button type="submit" disabled={pending}>
        {t("scenarios.create")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("scenarios.created")}</p> : null}
    </form>
  );
}
