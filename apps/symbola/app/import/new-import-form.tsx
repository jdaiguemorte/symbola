"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { ImportEntityType } from "@/modules/hub/service";
import { startImportAction, type StartImportFormState } from "./actions";

export function NewImportForm({ entityTypes, maxSizeLabel, maxSheets }: { entityTypes: ImportEntityType[]; maxSizeLabel: string; maxSheets: number }) {
  const t = useTranslations("Import");
  const initialState: StartImportFormState = {};
  const [state, formAction, pending] = useActionState(startImportAction, initialState);
  // Lot 14c (IMP-08) : des fiches événement PDF, plusieurs à la fois.
  const [entityType, setEntityType] = useState<ImportEntityType | "">("");
  const sheets = entityType === "event_sheets";

  return (
    <form action={formAction}>
      <fieldset>
        <legend>{t("entityTypeLegend")}</legend>
        {entityTypes.map((type) => (
          <label key={type}>
            <input type="radio" name="entityType" value={type} required onChange={() => setEntityType(type)} />
            {t(`entityType.${type}`)}
          </label>
        ))}
      </fieldset>
      {sheets ? (
        <>
          <label>
            {t("sheetsLabel")}
            <input key="sheets" type="file" name="file" accept=".pdf,application/pdf" multiple required aria-describedby="import-file-hint" />
          </label>
          <p id="import-file-hint">{t("sheetsHint", { maxSize: maxSizeLabel, count: maxSheets })}</p>
        </>
      ) : (
        <>
          <label>
            {t("fileLabel")}
            <input
              key="table"
              type="file"
              name="file"
              accept=".csv,.txt,.tsv,.xlsx,.json,text/csv,text/plain,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              aria-describedby="import-file-hint"
            />
          </label>
          <p id="import-file-hint">{t("fileHint", { maxSize: maxSizeLabel })}</p>
        </>
      )}
      <button type="submit" disabled={pending}>
        {pending ? t("reading") : t("startImport")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
