"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { confirmImportAction, type ConfirmFormState } from "./actions";

export function ConfirmForm({ importId, prospectSources }: { importId: string; prospectSources: { id: string; label: string }[] | null }) {
  const t = useTranslations("Import");
  const initialState: ConfirmFormState = {};
  const [state, formAction, pending] = useActionState(confirmImportAction, initialState);
  return (
    <form action={formAction}>
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
      <button type="submit" disabled={pending}>
        {pending ? t("confirming") : t("confirmImport")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
