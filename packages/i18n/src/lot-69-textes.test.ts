// Lot 69 (UX-10, UX-13 ; corrections simples de l'audit UX, lot 68) — textes affichés.
import { describe, expect, it } from "vitest";
import enMessages from "./messages/en.json";
import frMessages from "./messages/fr.json";
import agencyFr from "./messages/vocabulary/clients.fr.json";

describe("UX-10, HUB-24 — Aucune formule technique dans l'aide des termes clients (C-76, lot 69)", () => {
  const texts = {
    "fr Help.clientTerms.body": frMessages.Help.clientTerms.body,
    "fr ClientTerms.intro": frMessages.ClientTerms.intro,
    "en Help.clientTerms.body": enMessages.Help.clientTerms.body,
    "en ClientTerms.intro": enMessages.ClientTerms.intro,
  };
  for (const [name, text] of Object.entries(texts)) {
    it(`${name} ne montre ni accolades ni nom de variable`, () => {
      expect(text).not.toContain("{{");
      expect(text).not.toMatch(/[a-z]_[a-z]/);
    });
  }
});

describe("HUB-14, UX-10 — L'écran d'import cite les trois PDF repris ailleurs (C-51, lot 69)", () => {
  it("fr : fiches d'évènement, programme et prestataires retenus", () => {
    const hint = frMessages.Import.pdfHint;
    expect(hint).toContain("fiches d'évènement");
    expect(hint).toContain("Programme du jour J");
    expect(hint).toContain("prestataires retenus");
    expect(hint).toContain("Trois PDF");
  });
  it("en : event sheets, schedule and retained vendors", () => {
    const hint = enMessages.Import.pdfHint;
    expect(hint).toMatch(/event sheets/i);
    expect(hint).toContain("Wedding day schedule");
    expect(hint).toMatch(/retained vendors/i);
    expect(hint).toContain("Three");
  });
});

// Lot 69 (UX-10, UX-13, HUB-19 ; C-89) : une seule graphie, celle du cahier des charges et de CLAUDE.md.
function stringValues(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(stringValues);
  if (node && typeof node === "object") return Object.values(node).flatMap(stringValues);
  return [];
}

describe("UX-10, UX-13 — « évènement » est la seule graphie affichée (C-89, lot 69)", () => {
  const OLD_SPELLING = /[ÉéEe]vén?ement|ÉVÉNEMENT/;
  it("fr.json : aucune valeur n'écrit « événement »", () => {
    const found = stringValues(frMessages).filter((value) => /[ÉéEe]vénement|ÉVÉNEMENT/.test(value));
    expect(found.slice(0, 5)).toEqual([]);
  });
  it("le vocabulaire d'agence (clients.fr.json) non plus", () => {
    const found = stringValues(agencyFr).filter((value) => /[ÉéEe]vénement|ÉVÉNEMENT/.test(value));
    expect(found.slice(0, 5)).toEqual([]);
  });
  it("la graphie voulue est bien présente", () => {
    expect(stringValues(frMessages).some((value) => value.includes("évènement"))).toBe(true);
    expect(OLD_SPELLING.test("évènement")).toBe(false);
  });
});
