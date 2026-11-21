// Lot 63a (UX-14, FAC-01 ; recette du 21/11/2026) — « il manque souvent le petit astérisque des
// champs obligatoires ». Règle de DESIGN.md : un champ `required` porte « * » dans son libellé
// (composant RequiredMark) et le formulaire dit « * obligatoire » (RequiredLegend).
//
// Contrôle à cliquet : un écran qui a un champ obligatoire emploie RequiredMark. Les écrans écrits
// avant la règle sont listés dans required-mark-allowlist.json ; la liste ne fait que rétrécir
// (un écran converti en sort, un nouvel écran n'y entre pas).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import allowlist from "./required-mark-allowlist.json";

const APP = join(__dirname, "..");
const ROOT = join(APP, "..");
const REQUIRED = /\srequired(\s|\/|>|=\{|$)/m;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

const unmarked = tsxFiles(APP)
  .filter((path) => {
    const source = readFileSync(path, "utf8");
    return REQUIRED.test(source) && !source.includes("RequiredMark");
  })
  .map((path) => relative(ROOT, path))
  .sort();

describe("UX-14 — Un champ obligatoire porte son astérisque (lot 63a)", () => {
  it("un nouvel écran avec un champ obligatoire emploie RequiredMark", () => {
    expect(unmarked.filter((path) => !allowlist.includes(path))).toEqual([]);
  });

  it("la liste des écrans à convertir ne garde que ceux qui restent à faire", () => {
    expect(allowlist.filter((path) => !unmarked.includes(path))).toEqual([]);
  });

  it("l'envoi en signature d'un devis marque ses champs obligatoires", () => {
    expect(allowlist).not.toContain("app/devis/[quoteId]/signature-forms.tsx");
  });
});
