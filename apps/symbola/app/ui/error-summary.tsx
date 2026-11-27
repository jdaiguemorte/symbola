"use client";

// Lot 70b (UX-10 ; P-18, C-04 ; page 4 des maquettes du lot 68) — à partir de deux erreurs, un résumé en
// tête du formulaire : « Erreur : 2 champs à remplir avant d'enregistrer la tâche. », et un lien vers
// chaque champ. Annoncé aux lecteurs d'écran ; le focus, lui, va au premier champ en erreur.
import { useTranslations } from "next-intl";
import { focusField } from "./use-field-validation";

export function ErrorSummary({ errors, labels, fieldId, summaryKey = "summary" }: { errors: [string, string][]; labels: Record<string, string>; fieldId: (field: string) => string; summaryKey?: "summary" | "summaryTask" | "summaryEvent" }) {
  const t = useTranslations("Validation");
  if (errors.length < 2) return null;
  return (
    <div className="error-summary" role="alert">
      <p>
        <strong>{t("errorPrefix")}</strong> {t(summaryKey, { count: errors.length })}
      </p>
      <ul>
        {errors.map(([field]) => (
          <li key={field}>
            <a
              href={`#${fieldId(field)}`}
              aria-label={t("summaryLink", { field: labels[field] ?? field })}
              onClick={(event) => {
                event.preventDefault();
                focusField(event.currentTarget.closest("form"), field);
              }}
            >
              {labels[field] ?? field}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
