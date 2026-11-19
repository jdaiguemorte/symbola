// Lot 58 (PRE-08, PAR-09 ; ADR 0097) — test d'abus, sans base : l'évaluation des prestataires, les
// leçons, le temps passé, les frais propres et le bilan restent internes à l'équipe. Aucun écran ni
// aucune route d'un tiers (portail du client, espace du prestataire, jour J par lien) ni du Comptable
// n'importe leurs fonctions, et aucun export vers un tiers (e-reporting, journaux comptables, FEC) ne
// lit leurs tables.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const INTERNAL = /\b(evaluateVendor|evaluateEventVendor|getVendorCollaborationHistory|listEventEvaluations|getEventClosing|listEventClosings|loadClosing|financialSummary|vendorEvaluations|eventClosings)\b/;

describe("PRE-08 — La note reste interne à l'organisation (lot 58)", () => {
  it("ni le portail du client, ni l'espace du prestataire, ni le jour J par lien, ni les écrans du Comptable ne lisent une évaluation ou une clôture", () => {
    const thirdParty = ["app/portail", "app/prestataire", "app/lien", "app/comptable", "app/jour-j"].filter((dir) => {
      try {
        return statSync(join(ROOT, dir)).isDirectory();
      } catch {
        return false;
      }
    });
    expect(thirdParty).toContain("app/portail");
    expect(thirdParty).toContain("app/prestataire");
    const offenders = thirdParty.flatMap((dir) => files(join(ROOT, dir))).filter((path) => INTERNAL.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("aucun export vers un tiers (e-reporting, journaux comptables, FEC) ne lit les évaluations, les clôtures ou le bilan", () => {
    const exportsToThirdParties = ["modules/quotes/accounting-exports.ts", "modules/quotes/accounting-export-rules.ts", "app/devis/exports-comptables", "app/devis/e-reporting"];
    const paths = exportsToThirdParties.flatMap((path) => (statSync(join(ROOT, path)).isDirectory() ? files(join(ROOT, path)) : [join(ROOT, path)]));
    expect(paths.filter((path) => INTERNAL.test(readFileSync(path, "utf8")))).toEqual([]);
  });
});
