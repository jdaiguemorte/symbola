"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { confirmImportAction, type ConfirmFormState } from "./actions";

// Lot 16 (IMP-11) : le bouton « Importer 25 prestataires » est dans la barre du
// bas, lié à ce formulaire par son attribut `form` (id « confirm-form »).
export function ConfirmForm({ importId, prospectSources }: { importId: string; prospectSources: { id: string; label: string }[] | null }) {
  const t = useTranslations("Import");
  const initialState: ConfirmFormState = {};
  const [state, formAction, pending] = useActionState(confirmImportAction, initialState);
  return (
    <form action={formAction} id="confirm-form" aria-busy={pending}>
      <input type="hidden" name="importId" value={importId} />
      {prospectSources ? (
        <label>
          {t("defaultSourceLabel")}
          <select name="defaultProspectSourceId" required defaultValue="">
            <option value="" disabled>
              {t("defaultSourcePlaceholder")}
            </option>
            {prospectSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {pending ? <p role="status">{t("confirming")}</p> : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
