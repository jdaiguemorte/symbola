// Lot 76 (NFR-01, NFR-02 ; ADR 0124) — chaque test de mesure du temps de réponse dit sa valeur, même
// quand il passe : dans la sortie des parcours, en annotation du rapport, et dans un fichier (une ligne
// JSON par mesure, E2E_MESURES_FICHIER) dont la CI tire le tableau « mesure, valeur, seuil, marge » du
// résumé du job. Appelé avant l'assertion : une mesure au-dessus du seuil s'affiche aussi.
// Les tests de mesure se reconnaissent à « NFR-01 » ou « NFR-02 » dans leur titre (ou celui de leur
// description) : la CI les joue à part, serveur chaud (playwright.config.ts, E2E_MESURES).
import { appendFileSync } from "node:fs";
import type { TestInfo } from "@playwright/test";

export type Measure = { mesure: string; valeur: number; seuil: number; unite?: string; detail?: string };

export function reportMeasure(testInfo: TestInfo, measure: Measure): void {
  const unit = measure.unite ?? "ms";
  const value = Math.round(measure.valeur);
  const text = `${measure.mesure} : ${value} ${unit} (seuil ${measure.seuil} ${unit}, marge ${measure.seuil - value} ${unit})${measure.detail ? ` — ${measure.detail}` : ""}`;
  console.log(`Mesure — ${text}`);
  testInfo.annotations.push({ type: "mesure", description: text });
  const file = process.env.E2E_MESURES_FICHIER;
  if (file) appendFileSync(file, `${JSON.stringify({ ...measure, valeur: value, unite: unit })}\n`);
}
