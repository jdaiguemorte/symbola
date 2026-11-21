"use client";

// Lot 16 (IMP-11) — formulaire de l'étape « Colonnes ». Envoyé par « Continuer » (barre du bas).
// Lot 63b (HUB-14, UX-10, maquette M5) : un seul tableau, les colonnes à décider d'abord ; pour
// chacune, deux valeurs d'exemple, le menu « Devient, sur la fiche » (les champs par leur nom, puis
// « Une note sur la fiche », puis « Ne pas importer ») et son état (« Reconnue », « Choisie »,
// « Ignorée », « À choisir »), dit par un texte. À droite, l'aperçu de la première ligne du fichier
// en fiche, qui suit les choix.
import { useActionState, useState } from "react";
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

type ColumnState = "recognized" | "chosen" | "ignored" | "todo";

const FREE = "free";
const IGNORE = "ignore";

function stateOf(row: ColumnRow, value: string): ColumnState {
  if (value === "") return "todo";
  if (value === IGNORE) return "ignored";
  return row.needsChoice || value !== row.value ? "chosen" : "recognized";
}

export function ColumnsForm({
  importId,
  rows,
  fields,
  firstRow,
}: {
  importId: string;
  rows: ColumnRow[];
  fields: { key: string; required: boolean }[];
  // Première ligne du fichier, pour l'aperçu (valeurs dans l'ordre des colonnes).
  firstRow: string[];
}) {
  const t = useTranslations("Import");
  const [state, formAction] = useActionState<ColumnsFormState, FormData>(saveColumnsAction, {});
  const [values, setValues] = useState<Record<number, string>>(() => Object.fromEntries(rows.map((row) => [row.columnIndex, row.value])));
  const ordered = [...rows.filter((row) => row.needsChoice), ...rows.filter((row) => !row.needsChoice)];
  const recognized = rows.filter((row) => !row.needsChoice).length;
  const fieldLabel = (key: string) => t(`field.${key}`);

  // Aperçu : les champs dans l'ordre de la fiche, puis les notes.
  const mapped = fields
    .map((field) => {
      const column = rows.find((row) => values[row.columnIndex] === field.key);
      const value = column ? (firstRow[column.columnIndex] ?? "").trim() : "";
      return column && value ? { key: field.key, value } : null;
    })
    .filter((entry): entry is { key: string; value: string } => entry !== null);
  const notes = rows
    .filter((row) => values[row.columnIndex] === FREE)
    .map((row) => ({ name: row.name, value: (firstRow[row.columnIndex] ?? "").trim() }))
    .filter((note) => note.value !== "");
  const [headline, ...details] = mapped;

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
      <h2>{t("columnsMapTitle")}</h2>
      <p className="meta">{t("columnsMapIntro", { recognized, total: rows.length, toChoose: rows.length - recognized })}</p>
      <div className="columns-map">
        <div className="list-table-wrap" role="region" aria-label={t("columnsMapTable")} tabIndex={0}>
          <table className="list-table">
            <caption className="sr-only">{t("columnsMapTable")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("columnHeaderFile")}</th>
                <th scope="col">{t("columnHeaderBecomes")}</th>
                <th scope="col">{t("columnHeaderState")}</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => {
                const value = values[row.columnIndex] ?? "";
                const columnState = stateOf(row, value);
                return (
                  <tr key={row.columnIndex}>
                    <th scope="row">
                      {row.name}
                      <span className="column-samples">{row.samples.length > 0 ? row.samples.slice(0, 2).join(" · ") : t("columnEmpty")}</span>
                    </th>
                    <td>
                      {row.needsChoice ? <input type="hidden" name={`confirm-${row.columnIndex}`} value="on" /> : null}
                      <label className="sr-only" htmlFor={`target-${row.columnIndex}`}>
                        {t("columnTargetLabel", { column: row.name })}
                      </label>
                      <select
                        id={`target-${row.columnIndex}`}
                        name={`target-${row.columnIndex}`}
                        value={value}
                        required
                        aria-describedby={value === FREE ? `target-hint-${row.columnIndex}` : undefined}
                        onChange={(change) => setValues((current) => ({ ...current, [row.columnIndex]: change.target.value }))}
                      >
                        <option value="" disabled>
                          {t("columnChoose")}
                        </option>
                        <optgroup label={t("columnTargetFields")}>
                          {fields.map((field) => (
                            <option key={field.key} value={field.key}>
                              {field.required ? t("requiredField", { field: fieldLabel(field.key) }) : fieldLabel(field.key)}
                            </option>
                          ))}
                        </optgroup>
                        <option value={FREE}>{t("columnTargetFree")}</option>
                        <option value={IGNORE}>{t("columnTargetIgnore")}</option>
                      </select>
                      {value === FREE ? (
                        <span id={`target-hint-${row.columnIndex}`} className="column-hint">
                          {t("columnTargetFreeHint")}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={columnState === "recognized" ? "badge badge-sauge" : columnState === "todo" ? "badge badge-ambre" : "badge"}>{t(`columnState.${columnState}`)}</span>
                      {row.proposal && columnState === "todo" ? (
                        <span className="column-hint">{t("confidenceProposal", { field: fieldLabel(row.proposal), value: row.confidence ?? 0 })}</span>
                      ) : row.byProfile && columnState === "recognized" ? (
                        <span className="column-hint">{t("confidenceProfile")}</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <aside className="column-preview" aria-labelledby="column-preview-title" aria-live="polite">
          <p id="column-preview-title" className="meta">
            {t("columnsPreviewTitle")}
          </p>
          {headline ? <h3>{headline.value}</h3> : <h3>{t("rowWithoutLabel")}</h3>}
          {details.length > 0 ? (
            <dl>
              {details.map((entry) => (
                <div key={entry.key}>
                  <dt>{fieldLabel(entry.key)}</dt>
                  <dd>{entry.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {notes.length > 0 ? (
            <div className="column-preview-notes">
              <p className="meta">{t("columnsPreviewNotes")}</p>
              <ul>
                {notes.map((note) => (
                  <li key={note.name}>{t("columnsPreviewNote", { column: note.name, value: note.value })}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </form>
  );
}
