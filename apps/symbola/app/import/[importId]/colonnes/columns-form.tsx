"use client";

// Lot 16 (IMP-11) — formulaire de l'étape « Colonnes » : tableau des colonnes à
// décider ; les colonnes reconnues se résument en une ligne (« Voir le
// détail » les déplie, modifiables). Envoyé par « Continuer » (barre du bas).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveColumnsAction, type ColumnsFormState } from "./actions";

export type ColumnRow = {
  columnIndex: number;
  name: string;
  samples: string[];
  value: string;
  confidence: number | null;
  // Proposition sous le seuil : montrée, jamais présélectionnée.
  proposal: string | null;
  byProfile: boolean;
  needsChoice: boolean;
};

function ColumnsTable({ rows, fields, caption }: { rows: ColumnRow[]; fields: { key: string; required: boolean }[]; caption: string }) {
  const t = useTranslations("Import");
  return (
    <div className="list-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="list-table">
        <thead>
          <tr>
            <th scope="col">{t("columnHeaderFile")}</th>
            <th scope="col">{t("columnHeaderSamples")}</th>
            <th scope="col">{t("columnHeaderBecomes")}</th>
            <th scope="col">{t("columnHeaderConfidence")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.columnIndex}>
              <th scope="row">{row.name}</th>
              <td className="meta">{row.samples.length > 0 ? row.samples.join(" · ") : t("columnEmpty")}</td>
              <td>
                {row.needsChoice ? <input type="hidden" name={`confirm-${row.columnIndex}`} value="on" /> : null}
                <label className="sr-only" htmlFor={`target-${row.columnIndex}`}>
                  {t("columnTargetLabel", { column: row.name })}
                </label>
                <select id={`target-${row.columnIndex}`} name={`target-${row.columnIndex}`} defaultValue={row.value} required>
                  <option value="" disabled>
                    {t("columnChoose")}
                  </option>
                  <optgroup label={t("columnTargetFields")}>
                    {fields.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.required ? t("requiredField", { field: t(`field.${field.key}`) }) : t(`field.${field.key}`)}
                      </option>
                    ))}
                  </optgroup>
                  <option value="free">{t("columnTargetFree")}</option>
                  <option value="ignore">{t("columnTargetIgnore")}</option>
                </select>
              </td>
              <td>
                {row.proposal ? t("confidenceProposal", { field: t(`field.${row.proposal}`), value: row.confidence ?? 0 }) : row.confidence !== null ? t("confidencePercent", { value: row.confidence }) : row.byProfile ? t("confidenceProfile") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ColumnsForm({ importId, rows, fields }: { importId: string; rows: ColumnRow[]; fields: { key: string; required: boolean }[] }) {
  const t = useTranslations("Import");
  const [state, formAction] = useActionState<ColumnsFormState, FormData>(saveColumnsAction, {});
  const toDecide = rows.filter((row) => row.needsChoice);
  const recognized = rows.filter((row) => !row.needsChoice);

  return (
    <form action={formAction} id="columns-form">
      <input type="hidden" name="importId" value={importId} />
      <input type="hidden" name="columnCount" value={rows.length} />
      {rows.map((row) => (
        <input key={row.columnIndex} type="hidden" name="header" value={row.name} />
      ))}
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
      {toDecide.length > 0 ? (
        <section aria-labelledby="columns-to-decide">
          <h2 id="columns-to-decide">{t("columnsToDecideTitle", { count: toDecide.length })}</h2>
          <p>{t("columnsToDecideIntro")}</p>
          <ColumnsTable rows={toDecide} fields={fields} caption={t("columnsToDecideTable")} />
        </section>
      ) : null}
      {recognized.length > 0 ? (
        <section aria-labelledby="columns-recognized">
          <h2 id="columns-recognized">{t("columnsRecognized", { count: recognized.length })}</h2>
          <details>
            <summary>{t("columnsShowDetail")}</summary>
            <ColumnsTable rows={recognized} fields={fields} caption={t("columnsRecognizedTable")} />
          </details>
        </section>
      ) : null}
    </form>
  );
}
