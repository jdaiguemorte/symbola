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

console.log(`Catalogues fr.json/en.json cohérents (${frKeys.size} clés).`);
