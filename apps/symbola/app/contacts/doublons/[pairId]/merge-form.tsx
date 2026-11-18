"use client";

// Lot 45 (CRM-07 ; D4) — la fusion choisie par la planner : la fiche gardée, puis, champ par champ, la
// valeur à garder ; l'écran montre ce que chaque fiche réunit (évènements, notes, messages, rendez-vous,
// liens, signatures) et une case confirme : rien ne se fusionne seul, ni par erreur.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { mergePairAction, type MergeState } from "../actions";

export type MergeSide = { id: string; name: string; gathered: string[] };
export type MergeRow = { field: string; label: string; first: string | null; second: string | null };

export function MergeForm({ pairId, first, second, rows }: { pairId: string; first: MergeSide; second: MergeSide; rows: MergeRow[] }) {
  const t = useTranslations("ContactDuplicates");
  const [kept, setKept] = useState<string>(first.id);
  const [state, action, pending] = useActionState<MergeState, FormData>(mergePairAction.bind(null, pairId), {});
  const keptSide = kept === first.id ? "first" : "second";
  const absorbed = kept === first.id ? second : first;
  return (
    <form action={action} className="stack merge-form">
      <fieldset className="stack">
        <legend>{t("keptLegend")}</legend>
        {[first, second].map((side) => (
          <label key={side.id} className="checkbox">
            <input type="radio" name="kept" value={side.id} checked={kept === side.id} onChange={() => setKept(side.id)} />
            {side.name}
          </label>
        ))}
      </fieldset>

      <table className="merge-table">
        <caption>{t("fieldsCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("field")}</th>
            <th scope="col">{first.name}</th>
            <th scope="col">{second.name}</th>
          </tr>
        </thead>
        <tbody key={kept}>
          {rows.map((row) => {
            const differs = row.first !== null && row.second !== null && row.first !== row.second;
            const fallback = row.first !== null && row.second === null ? "first" : row.second !== null && row.first === null ? "second" : keptSide;
            return (
              <tr key={row.field}>
                <th scope="row">{row.label}</th>
                {(["first", "second"] as const).map((side) => {
                  const value = side === "first" ? row.first : row.second;
                  return (
                    <td key={side}>
                      {differs ? (
                        <label className="checkbox">
                          <input type="radio" name={`field-${row.field}`} value={side} defaultChecked={side === keptSide} aria-label={t("keepValue", { field: row.label, value: value ?? "" })} />
                          {value}
                        </label>
                      ) : (
                        <>
                          {value ?? "—"}
                          {side === fallback && value !== null ? <input type="hidden" name={`field-${row.field}`} value={side} /> : null}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="card notice stack" aria-labelledby="merge-confirm-title">
        <h2 id="merge-confirm-title">{t("confirmTitle")}</h2>
        <p>{t("confirmBody", { absorbed: absorbed.name, kept: kept === first.id ? first.name : second.name })}</p>
        <ul>
          {[...first.gathered, ...second.gathered].map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
        <label className="checkbox">
          <input type="checkbox" name="confirm" required />
          {t("confirmCheck")}
        </label>
      </section>
      <button type="submit" className="primary" disabled={pending}>
        {t("merge")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
