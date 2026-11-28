// Lot 76 (NFR-01, NFR-02 ; ADR 0124) — le tableau des mesures du temps de réponse, avec leur marge,
// pour le résumé du job de CI. Lit le fichier écrit par apps/symbola/e2e/mesure.ts (une ligne JSON par
// mesure) ; une mesure jouée plusieurs fois (reprises de Playwright) garde sa dernière valeur, et le
// nombre de passages est dit.
// Usage : node tools/ci-pipeline/tableau-mesures.mjs <fichier> >> "$GITHUB_STEP_SUMMARY"
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function measuresTable(text) {
  const byName = new Map();
  for (const line of text.split("\n").filter(Boolean)) {
    const measure = JSON.parse(line);
    const previous = byName.get(measure.mesure);
    byName.set(measure.mesure, { ...measure, passages: (previous?.passages ?? 0) + 1 });
  }
  if (byName.size === 0) return "### Mesures du temps de réponse\n\nAucune mesure relevée (job coupé avant les mesures ?).\n";
  const rows = [...byName.values()].map((measure) => {
    const margin = measure.seuil - measure.valeur;
    const share = Math.round((margin / measure.seuil) * 100);
    const verdict = margin > 0 ? "✅" : "❌";
    const passes = measure.passages > 1 ? ` (${measure.passages} passages, le dernier)` : "";
    const detail = measure.detail ? ` — ${measure.detail}` : "";
    return `| ${verdict} ${measure.mesure}${detail}${passes} | ${measure.valeur} ${measure.unite} | ${measure.seuil} ${measure.unite} | ${margin} ${measure.unite} (${share} %) |`;
  });
  return ["### Mesures du temps de réponse", "", "| Mesure | Valeur | Seuil | Marge |", "| --- | ---: | ---: | ---: |", ...rows, ""].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const file = process.argv[2];
  process.stdout.write(measuresTable(file && existsSync(file) ? readFileSync(file, "utf8") : ""));
}
