// Lot 76 (ARC-20, SEC-36 ; ADR 0124) — le socle des parcours, rejoué sur chaque pull request, reste
// branché sur des parcours qui existent : un titre renommé ou un fichier déplacé ferait sinon fondre
// le socle en silence. La CI vérifie en plus que Playwright en sélectionne exactement un par entrée.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fileGrep, SOCLE, SOCLE_GREP } from "../e2e/socle";

const e2e = resolve(import.meta.dirname, "../e2e");

describe("ARC-20 — Le socle des parcours de la voie rapide (lot 76)", () => {
  it("compte une vingtaine de parcours, sans doublon", () => {
    expect(SOCLE.length).toBeGreaterThanOrEqual(18);
    expect(SOCLE.length).toBeLessThanOrEqual(25);
    expect(new Set(SOCLE.map((entry) => `${entry.fichier} ${entry.titre}`)).size).toBe(SOCLE.length);
  });

  it("chaque entrée nomme un fichier de parcours existant et un titre qui s'y trouve", () => {
    const problems: string[] = [];
    for (const entry of SOCLE) {
      const path = join(e2e, entry.fichier);
      if (!entry.fichier.endsWith(".spec.ts") || !existsSync(path)) {
        problems.push(`${entry.fichier} introuvable`);
        continue;
      }
      if (!readFileSync(path, "utf8").includes(entry.titre)) problems.push(`${entry.fichier} : « ${entry.titre} » introuvable`);
    }
    expect(problems).toEqual([]);
  });

  it("couvre les gestes essentiels : connexion, accueil, évènement, tâches, devis et facture, prestataires, import, jour J, liens des tiers, accès croisé", () => {
    const files = SOCLE.map((entry) => entry.fichier).join(" ");
    for (const prefix of ["sec-01-07-connexion", "aujourdhui", "prd-evt-01", "taches", "dev-01-devis", "dev-04-factures", "prestataires", "import", "jour-j", "por-0", "sec-36-suite-abus"]) expect(files).toContain(prefix);
  });

  it("le filtre retient le parcours visé, pas son voisin d'un autre fichier", () => {
    const grepTitle = (file: string, title: string) => `desktop ${file} ${title}`;
    expect(SOCLE_GREP.some((pattern) => pattern.test(grepTitle("dev-01-devis.spec.ts", "DEV-01 — composer un devis depuis un évènement")))).toBe(true);
    expect(SOCLE_GREP.some((pattern) => pattern.test(grepTitle("dev-02-signature.spec.ts", "DEV-01 — composer un devis")))).toBe(false);
    expect(fileGrep(["dev-01-devis.spec.ts"])[0]!.test(grepTitle("dev-01-devis.spec.ts", "un titre"))).toBe(true);
    expect(fileGrep(["dev-01-devis.spec.ts"])[0]!.test(grepTitle("xdev-01-devis.spec.ts", "un titre"))).toBe(false);
  });
});
