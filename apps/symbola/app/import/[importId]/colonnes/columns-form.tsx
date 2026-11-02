"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { ImportColumnsView } from "@/modules/hub/service";
import { saveColumnsAction, type ColumnsFormState } from "./actions";

export function ColumnsForm({ view }: { view: ImportColumnsView }) {
  const t = useTranslations("Import");
  const initialState: ColumnsFormState = {};
  const [state, formAction, pending] = useActionState(saveColumnsAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="importId" value={view.importId} />
      <input type="hidden" name="columnCount" value={view.columns.length} />
      {state.errors?.length ? (
        <div role="alert">
          <p>{t("mappingErrorsTitle")}</p>
          <ul>
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {view.columns.map((column) => {
        const name = column.header || t("unnamedColumn", { number: column.columnIndex + 1 });
        const saved = column.saved;
        // Une colonne gardée en champ libre au rapport des écarts reste « sans
        // équivalent » ici (IMP-04).
        const initialTarget = saved
          ? saved.target === "field"
            ? (saved.fieldKey ?? "none")
            : saved.target === "free" || saved.decidedAtGaps
              ? "none"
              : saved.target
          : (column.proposedFieldKey ?? "none");
        const lowConfidence = column.proposedFieldKey !== null && column.confidence < view.lowConfidenceThreshold;
        const selectId = `target-${column.columnIndex}`;
        return (
          <fieldset key={column.columnIndex}>
            <legend>{name}</legend>
            <input type="hidden" name="header" value={column.header} />
            <p>
              {column.samples.length > 0 ? t("columnSamples", { samples: column.samples.join(" · ") }) : t("columnEmpty")}
            </p>
            {column.proposedFieldKey ? (
              <p>
                {t("columnProposal", { field: t(`field.${column.proposedFieldKey}`), confidence: column.confidence })}
                {lowConfidence ? ` — ${t("columnLowConfidence")}` : null}
              </p>
            ) : (
              <p>{t("columnNoProposal")}</p>
            )}
            <label htmlFor={selectId}>{t("columnTargetLabel", { column: name })}</label>
            <select id={selectId} name={selectId} defaultValue={initialTarget}>
              <optgroup label={t("columnTargetFields")}>
                {view.fields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.required ? t("requiredField", { field: t(`field.${field.key}`) }) : t(`field.${field.key}`)}
                  </option>
                ))}
              </optgroup>
              <option value="none">{t("columnTargetNone")}</option>
              <option value="ignore">{t("columnTargetIgnore")}</option>
            </select>
            {lowConfidence ? (
              <label>
                <input type="checkbox" name={`confirm-${column.columnIndex}`} defaultChecked={saved?.confirmed === true && saved.target === "field"} />
                {t("columnConfirm", { field: t(`field.${column.proposedFieldKey}`) })}
              </label>
            ) : null}
          </fieldset>
        );
      })}
      <button type="submit" disabled={pending}>
        {t("saveColumns")}
      </button>
    </form>
  );
}
