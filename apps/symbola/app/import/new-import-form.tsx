"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { ImportEntityType } from "@/modules/hub/service";
import { startImportAction, type StartImportFormState } from "./actions";

export function NewImportForm({ entityTypes, maxSizeLabel }: { entityTypes: ImportEntityType[]; maxSizeLabel: string }) {
  const t = useTranslations("Import");
  const initialState: StartImportFormState = {};
  const [state, formAction, pending] = useActionState(startImportAction, initialState);

  return (
    <form action={formAction}>
      <fieldset>
        <legend>{t("entityTypeLegend")}</legend>
        {entityTypes.map((type) => (
          <label key={type}>
            <input type="radio" name="entityType" value={type} required />
            {t(`entityType.${type}`)}
          </label>
        ))}
      </fieldset>
      <label>
        {t("fileLabel")}
        <input
          type="file"
          name="file"
          accept=".csv,.txt,.tsv,.xlsx,.json,text/csv,text/plain,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          aria-describedby="import-file-hint"
        />
      </label>
      <p id="import-file-hint">{t("fileHint", { maxSize: maxSizeLabel })}</p>
      <button type="submit" disabled={pending}>
        {pending ? t("reading") : t("startImport")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
