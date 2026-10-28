import { getTranslations } from "next-intl/server";

// Les 5 étapes visibles de l'import (PRD §7) ; `current` est l'index de
// l'étape en cours (0 = fichier).
export const IMPORT_STEPS = ["file", "columns", "matches", "gaps", "confirmation"] as const;

export async function ImportSteps({ current }: { current: number }) {
  const t = await getTranslations("Import");
  return (
    <nav aria-label={t("stepsLabel")}>
      <ol>
        {IMPORT_STEPS.map((step, index) => (
          <li key={step} aria-current={index === current ? "step" : undefined}>
            {t("stepNumber", { number: index + 1, total: IMPORT_STEPS.length })} {t(`step.${step}`)}
            {index < current ? ` — ${t("stepDone")}` : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
