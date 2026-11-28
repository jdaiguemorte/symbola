"use client";

// Lot 72d (EVT-02 ; J9) — « Le bouton « Ouvrir le Jour J » apparaît dans l'en-tête de la fiche … jours avant
// le jour J » : un réglage isolé, qui s'enregistre seul et le dit à côté (« ✓ Enregistré », règle 19 de
// DESIGN.md) ; hors de 1 à 30, l'erreur est écrite sous le champ, la saisie reste (P-18).
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FieldError } from "@/app/ui/field-error";
import { saveDayOfLeadDaysAction, type DayOfLeadDaysState } from "./actions";

const PAUSE_MS = 700;

export function DayOfLeadDaysForm({ days }: { days: number }) {
  const t = useTranslations("DayChecklists.lead");
  const [state, action, pending] = useActionState<DayOfLeadDaysState, FormData>(saveDayOfLeadDaysAction, {});
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shownSaved, setShownSaved] = useState(false);
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // « ✓ Enregistré » reste cinq secondes, puis s'efface.
  useEffect(() => {
    if (!state.saved) return;
    setShownSaved(true);
    const hide = setTimeout(() => setShownSaved(false), 5000);
    return () => clearTimeout(hide);
  }, [state]);

  const submitSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => form.current?.requestSubmit(), PAUSE_MS);
  };

  return (
    <form ref={form} action={action} className="lead-days-form" noValidate>
      <label htmlFor={`${id}-days`}>{t("label")}</label>
      <div className="lead-days-field">
        <input
          id={`${id}-days`}
          name="days"
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          className="field-short"
          defaultValue={days}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? `${errorId} ${hintId}` : hintId}
          onChange={submitSoon}
          onBlur={() => {
            if (timer.current) {
              clearTimeout(timer.current);
              timer.current = null;
              form.current?.requestSubmit();
            }
          }}
        />
        <span>{t("suffix")}</span>
        <span role="status" className="lead-days-saved">
          {pending ? "" : shownSaved && !state.error ? t("saved") : ""}
        </span>
      </div>
      <FieldError id={errorId} message={state.error ? t("error") : undefined} />
      <p id={hintId} className="muted">
        {t("hint")}
      </p>
    </form>
  );
}
