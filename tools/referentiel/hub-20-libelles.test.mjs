// Lot 40b (HUB-20, décision D12) — aucun libellé métier dans le code : les listes (types
// d'évènements, familles, types, étiquettes et postes de prestataires, sources, motifs de perte,
// moyens de paiement) sont des référentiels de l'organisation, nés de ces modèles de départ. Le test
// lit leurs libellés (FR et EN) et les cherche, entre guillemets, dans les sources de l'app et des
// paquets ; une occurrence fait échouer, avec le fichier et la ligne. Le contrôle suit les modèles :
// un nouveau libellé de départ entre de lui-même dans la liste cherchée.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const templates = join(repoRoot, "packages/starter-templates/src");
const REFERENTIALS = /^(event-types|vendor-families|vendor-types|vendor-tags|vendor-slots|prospect-sources|loss-reasons|payment-methods)(\.event-agency)?\.json$/;
// Hors du contrôle : les données de départ elles-mêmes, les tests, les parcours de bout en bout, les
// captures de l'aide et le jeu fictif de recette (qui nomment des valeurs pour les vérifier).
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".next", ".turbo", "e2e", "captures", "recette", "starter-templates", "dist"]);

function referentialLabels(directory = templates) {
  const labels = new Set();
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    const record = value;
    if (typeof record.fr === "string" && typeof record.en === "string") {
      labels.add(record.fr);
      labels.add(record.en);
    }
    Object.values(record).forEach(walk);
  };
  for (const file of readdirSync(directory).filter((name) => REFERENTIALS.test(name))) walk(JSON.parse(readFileSync(join(directory, file), "utf8")));
  return labels;
}

function sourceFiles(directory, files = []) {
  for (const name of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) sourceFiles(path, files);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
  }
  return files;
}

// Un libellé entre guillemets, sauf comme nom d'un espace de traductions (useTranslations("Security")).
function findLabels(text, labels) {
  const found = [];
  const lines = text.split("\n");
  for (const label of labels) {
    for (const quote of ['"', "'", "`"]) {
      const quoted = `${quote}${label}${quote}`;
      lines.forEach((content, index) => {
        let at = content.indexOf(quoted);
        while (at !== -1) {
          if (!/(Translations\(|namespace:\s*)$/.test(content.slice(0, at))) found.push({ line: index + 1, label });
          at = content.indexOf(quoted, at + 1);
        }
      });
    }
  }
  return found;
}

describe("HUB-20 — Référentiels modifiables, aucun libellé métier dans le code", () => {
  it("les modèles de départ fournissent les libellés cherchés (FR et EN)", () => {
    const labels = referentialLabels();
    expect(labels.size).toBeGreaterThan(300);
    for (const sample of ["Mariage", "Wedding", "Lieu de réception", "Budget insuffisant", "Virement bancaire"]) expect(labels.has(sample), sample).toBe(true);
  });

  it("aucun libellé d'un référentiel n'est écrit dans les sources de l'app ni des paquets", () => {
    const labels = referentialLabels();
    const problems = [join(repoRoot, "apps/symbola"), join(repoRoot, "packages")]
      .flatMap((directory) => sourceFiles(directory))
      .flatMap((file) => findLabels(readFileSync(file, "utf8"), labels).map(({ line, label }) => `${relative(repoRoot, file)}:${line} : « ${label} »`));
    expect(problems).toEqual([]);
  });

  it("un libellé glissé dans une liste du code est trouvé ; un nom de traductions ou un commentaire ne l'est pas", () => {
    const labels = ["Mariage", "Security", "Lieu de réception"];
    expect(findLabels(`const types = ["Mariage", 'Séminaire'];`, labels)).toEqual([{ line: 1, label: "Mariage" }]);
    expect(findLabels('const t = await getTranslations("Security");\nconst u = useTranslations({ namespace: "Security" });', labels)).toEqual([]);
    expect(findLabels("// le Lieu de réception de l'évènement", labels)).toEqual([]);
  });
});
