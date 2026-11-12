// Lot 29a (ARC-09, décision D7) — les couleurs du manifeste et des icônes sont les jetons
// de DESIGN.md (ADR 0057) : aucune valeur hors jeton.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_COLORS } from "./brand-colors";

const designMd = readFileSync(resolve(import.meta.dirname, "..", "..", "..", "DESIGN.md"), "utf8");

function token(name: string): string | undefined {
  return new RegExp(`^  ${name}: "(#[0-9A-Fa-f]{6})"$`, "m").exec(designMd)?.[1];
}

describe("ARC-09 — Couleurs de l'application installée", () => {
  it.each(Object.entries(BRAND_COLORS))("%s est le jeton de DESIGN.md", (name, value) => {
    expect(value).toBe(token(name));
  });
});
