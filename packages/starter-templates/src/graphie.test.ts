// Lot 69 (UX-10, UX-13 ; C-89) — les textes de départ écrivent « évènement », la graphie du cahier des
// charges. Restent tels quels : la clé `_source` (note de rédaction, jamais affichée) et les fichiers de
// synonymes de reconnaissance de colonnes (les deux graphies doivent y être reconnues).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RECOGNITION_FILES = new Set(["import-synonyms.json", "import-profiles.json", "vendor-type-synonyms.json"]);

function shownStrings(node: unknown, key = ""): string[] {
  if (key === "_source") return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap((entry) => shownStrings(entry));
  if (node && typeof node === "object") return Object.entries(node).flatMap(([name, value]) => shownStrings(value, name));
  return [];
}

describe("UX-10, UX-13 — Graphie « évènement » dans les modèles de départ (C-89, lot 69)", () => {
  const files = readdirSync(DIR).filter((name) => name.endsWith(".json") && !RECOGNITION_FILES.has(name));
  it("aucun texte affiché des modèles n'écrit « événement »", () => {
    const found: string[] = [];
    for (const file of files) {
      for (const value of shownStrings(JSON.parse(readFileSync(path.join(DIR, file), "utf8")))) {
        if (/[ÉéEe]vénement|ÉVÉNEMENT/.test(value)) found.push(`${file} : ${value.slice(0, 60)}`);
      }
    }
    expect(found).toEqual([]);
  });
});
