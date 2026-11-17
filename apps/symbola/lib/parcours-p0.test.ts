// Lot 40b (NFR-21, décision D13, ADR 0076) — tous les parcours P0 sont couverts de bout en bout :
// la liste des parcours P0 vient du cahier des charges (§ 7), leur couverture de e2e/parcours.json.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "..");
const specification = readFileSync(resolve(appRoot, "../../docs/CAHIER_DES_CHARGES.md"), "utf8");
const map = JSON.parse(readFileSync(join(appRoot, "e2e/parcours.json"), "utf8")) as Record<string, { titre: string; parcours: string[]; ecarts: string[] } | string>;

// « ### PAR-08 · Tenir le jour J (P0 en lecture, P1 pour le pointage) » compte comme P0.
function p0Journeys(text: string): string[] {
  return [...text.matchAll(/^### (PAR-\d+) · .*\(P0\b/gm)].map((match) => match[1]!);
}

describe("NFR-21 — Tous les parcours P0 couverts de bout en bout", () => {
  it("le cahier des charges compte six parcours P0", () => {
    expect(p0Journeys(specification)).toEqual(["PAR-01", "PAR-02", "PAR-03", "PAR-04", "PAR-06", "PAR-08"]);
  });

  it("chaque parcours P0 a au moins un parcours de bout en bout, et chaque fichier cité existe", () => {
    const problems: string[] = [];
    for (const journey of p0Journeys(specification)) {
      const entry = map[journey];
      if (!entry || typeof entry === "string" || entry.parcours.length === 0) {
        problems.push(`${journey} : aucun parcours de bout en bout`);
        continue;
      }
      for (const file of entry.parcours) if (!existsSync(join(appRoot, "e2e", file))) problems.push(`${journey} : ${file} introuvable`);
    }
    expect(problems).toEqual([]);
  });

  it("la carte ne cite que des parcours du cahier des charges", () => {
    const known = new Set([...specification.matchAll(/^### (PAR-\d+) ·/gm)].map((match) => match[1]));
    expect(Object.keys(map).filter((key) => key.startsWith("PAR-") && !known.has(key))).toEqual([]);
  });
});
