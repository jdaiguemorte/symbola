// HUB-04 — « Un test en CI échoue si une clé de traduction manque dans
// l'une des deux langues. » Comparaison récursive des deux catalogues.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([key, value]) => flattenKeys(value, prefix ? `${prefix}.${key}` : key));
}

const root = resolve(import.meta.dirname, "..", "src", "messages");
const fr = JSON.parse(readFileSync(resolve(root, "fr.json"), "utf8"));
const en = JSON.parse(readFileSync(resolve(root, "en.json"), "utf8"));

const frKeys = new Set(flattenKeys(fr));
const enKeys = new Set(flattenKeys(en));

const missingInEn = [...frKeys].filter((key) => !enKeys.has(key));
const missingInFr = [...enKeys].filter((key) => !frKeys.has(key));

if (missingInEn.length > 0 || missingInFr.length > 0) {
  if (missingInEn.length > 0) {
    console.error("Clés absentes de en.json :\n" + missingInEn.map((k) => `  - ${k}`).join("\n"));
  }
  if (missingInFr.length > 0) {
    console.error("Clés absentes de fr.json :\n" + missingInFr.map((k) => `  - ${k}`).join("\n"));
  }
  process.exit(1);
}

// Lot 16 (HUB-21, ADR 0045) : vocabulaire « le client » (messages/vocabulary/<vocabulaire>.<langue>.json),
// fusionné sur les catalogues : mêmes clés en FR et en EN, toutes présentes au catalogue.
const vocabularyDir = resolve(root, "vocabulary");
for (const metier of ["clients"]) {
  const overrideFr = new Set(flattenKeys(JSON.parse(readFileSync(resolve(vocabularyDir, `${metier}.fr.json`), "utf8"))));
  const overrideEn = new Set(flattenKeys(JSON.parse(readFileSync(resolve(vocabularyDir, `${metier}.en.json`), "utf8"))));
  const problems = [
    ...[...overrideFr].filter((key) => !overrideEn.has(key)).map((key) => `absente de ${metier}.en.json : ${key}`),
    ...[...overrideEn].filter((key) => !overrideFr.has(key)).map((key) => `absente de ${metier}.fr.json : ${key}`),
    ...[...overrideFr].filter((key) => !frKeys.has(key)).map((key) => `inconnue du catalogue : ${key}`),
  ];
  if (problems.length > 0) {
    console.error(`Textes du vocabulaire ${metier} :\n` + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }
}

console.log(`Catalogues fr.json/en.json cohérents (${frKeys.size} clés).`);
