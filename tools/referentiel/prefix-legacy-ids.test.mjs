import { describe, expect, it } from "vitest";
import { findBareIds, legacyFileName, loadTable, parseTable, prefixIds } from "./prefix-legacy-ids.mjs";

const table = parseTable(
  [
    "| Ancien | Nouveau nom | Origine | Titre |",
    "| --- | --- | --- | --- |",
    "| EVT-03 | PRD-EVT-03 | `docs/archive/PRD-MVP.md` | Statut des postes prestataires |",
    "| HUB-28 | L21-HUB-28 | `docs/lots/lot-21-etiquettes-et-reglages.md` | Le menu des réglages défile seul |",
    "| SEC-01 | L16-SEC-01 | `docs/lots/lot-16-reprise-ux.md` | Code de double authentification protégé |",
  ].join("\n"),
);

describe("NFR-24 — Anciens identifiants préfixés (lot 25, décision Q1)", () => {
  it("préfixe un ancien identifiant par son origine (PRD ou lot)", () => {
    expect(prefixIds("describe('EVT-03 — Statut', () => {}); // HUB-28", table)).toEqual({
      text: "describe('PRD-EVT-03 — Statut', () => {}); // L21-HUB-28",
      count: 2,
    });
  });

  it("ne re-préfixe jamais un identifiant déjà préfixé", () => {
    const once = prefixIds("SEC-01 et HUB-28", table).text;
    expect(prefixIds(once, table)).toEqual({ text: "L16-SEC-01 et L21-HUB-28", count: 0 });
  });

  it("laisse les identifiants absents de la table : nouveaux (NFR-10, ARC-11) et sans collision (SOC-10, DEV-02)", () => {
    const text = "NFR-10, ARC-11, SOC-10, DEV-02, EVT-030, XEVT-03";
    expect(prefixIds(text, table)).toEqual({ text, count: 0 });
  });

  it("signale un ancien identifiant resté sans préfixe, avec sa ligne", () => {
    expect(findBareIds("ok\nvoir HUB-28\nL21-HUB-28 et NFR-13", table)).toEqual([{ line: 2, id: "HUB-28" }]);
  });

  it("renomme un fichier nommé d'après un ancien identifiant, et lui seul", () => {
    expect(legacyFileName("apps/symbola/e2e/evt-03.spec.ts", table)).toBe("apps/symbola/e2e/prd-evt-03.spec.ts");
    expect(legacyFileName("apps/symbola/e2e/sec-01-double-authentification.spec.ts", table)).toBe(
      "apps/symbola/e2e/l16-sec-01-double-authentification.spec.ts",
    );
    expect(legacyFileName("apps/symbola/e2e/prd-evt-03.spec.ts", table)).toBeNull();
    expect(legacyFileName("apps/symbola/e2e/imp-02-colonnes.spec.ts", table)).toBeNull();
  });

  it("lit la table du dépôt : 69 anciens identifiants, chacun préfixé par son origine", () => {
    const repoTable = loadTable();
    expect(repoTable.size).toBe(69);
    for (const [legacy, renamed] of repoTable) expect(renamed).toMatch(new RegExp(`^(PRD|L\\d+)-${legacy}$`));
    expect(repoTable.get("HUB-28")).toBe("L21-HUB-28");
    expect(repoTable.has("NFR-10")).toBe(false);
  });
});
