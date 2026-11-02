"use client";

import { startTransition, useActionState } from "react";
import { useTranslations } from "next-intl";
import { validatePurgeAction, type PurgeFormState } from "./actions";

export type PurgeFormLine = { key: string; rule: string; label: string; dueOn: string; previousReason: string | null };

// RGPD-05 — liste du mois : chaque ligne est purgée, sauf si la titulaire
// l'exclut avec un motif. Rien n'est purgé sans cette validation.
export function PurgeForm({ lines }: { lines: PurgeFormLine[] }) {
  const t = useTranslations("Privacy");
  const initialState: PurgeFormState = {};
  const [state, formAction, pending] = useActionState(validatePurgeAction, initialState);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        // Soumission manuelle : en cas d'erreur (motif manquant), React ne
        // vide pas le formulaire, la titulaire garde ses exclusions et motifs.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <ul>
        {lines.map((line, index) => (
          <li key={line.key}>
            <input type="hidden" name="line" value={line.key} />
            <strong>{t(`purgeRule.${line.rule}`)}</strong> — {line.label || t("purgeNoLabel")} — {t("purgeDueOn", { date: line.dueOn })}
            {line.previousReason ? (
              <>
                {" "}
                <small>({t("purgePreviousReason", { reason: line.previousReason })})</small>
              </>
            ) : null}
            <div>
              <label>
                <input type="checkbox" name={`exclude:${line.key}`} /> {t("purgeExclude")}
              </label>{" "}
              <label>
                {t("purgeReasonLabel", { index: index + 1 })}
                <input type="text" name={`reason:${line.key}`} maxLength={2000} defaultValue={line.previousReason ?? ""} />
              </label>
            </div>
          </li>
        ))}
      </ul>
      <label>
        <input type="checkbox" name="purgeAcknowledged" required /> {t("purgeConfirm")}
      </label>
      <button type="submit" disabled={pending}>
        {pending ? t("purging") : t("purgeSubmit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
