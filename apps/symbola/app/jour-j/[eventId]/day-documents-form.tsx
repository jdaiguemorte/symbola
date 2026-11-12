"use client";

// Lot 29b (JRJ-04, décision D8) — « Choisir les documents embarqués » : une case par
// pièce candidate de l'événement. Après l'enregistrement, l'écran se recharge : la
// copie de l'appareil, si elle existe, se met à jour avec les documents choisis.
import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { saveDayDocumentsAction, type DayDocumentsState } from "./day-document-actions";

export type DayDocumentChoiceView = { key: string; label: string; origin: string; size: string | null; embedded: boolean };

export function DayDocumentsForm({ eventId, choices, total }: { eventId: string; choices: DayDocumentChoiceView[]; total: string }) {
  const t = useTranslations("DayOf");
  const [state, action, pending] = useActionState(saveDayDocumentsAction, {} as DayDocumentsState);
  useEffect(() => {
    if (state.success) window.location.reload();
  }, [state.success]);

  return (
    <form action={action} className="day-documents-form">
      <input type="hidden" name="eventId" value={eventId} />
      <fieldset>
        <legend>{t("chooseLegend")}</legend>
        <ul className="day-list">
          {choices.map((choice) => (
            <li key={choice.key}>
              <label className="day-document-choice">
                <input type="checkbox" name="document" value={choice.key} defaultChecked={choice.embedded} />
                <span>
                  {choice.label}{" "}
                  <span className="meta">
                    {choice.origin}
                    {choice.size ? ` · ${choice.size}` : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <p className="meta">{t("chooseTotal", { size: total })}</p>
      <button type="submit" disabled={pending}>
        {t("chooseSave")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("chooseSaved")}</p> : null}
    </form>
  );
}
