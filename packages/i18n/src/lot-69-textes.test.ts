// Lot 69 (UX-10, UX-13 ; corrections simples de l'audit UX, lot 68) — textes affichés.
import { describe, expect, it } from "vitest";
import enMessages from "./messages/en.json";
import frMessages from "./messages/fr.json";

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
