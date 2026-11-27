// Lot 71a (HUB-14, UX-02 ; spécification du lot 71, § 5.1, critère 8) — noms et villes repris à la casse
// de l'app : un mot écrit tout en capitales par l'ancien outil retrouve sa casse ; ce qui est déjà écrit
// en minuscules et capitales reste tel quel (« de La Tour », « McAllister »).
import { describe, expect, it } from "vitest";
import { appNameCase } from "./name-case";

describe("HUB-14 — Noms et villes à la casse de l'app (lot 71a)", () => {
  it("« Léa MARTIN », « POITIERS » deviennent « Léa Martin », « Poitiers »", () => {
    expect(appNameCase("Léa MARTIN")).toBe("Léa Martin");
    expect(appNameCase("MARTIN")).toBe("Martin");
    expect(appNameCase("POITIERS")).toBe("Poitiers");
  });

  it("particules : « DE LA TOUR » → « de La Tour », « LE GALL » → « Le Gall », « D'ARTAGNAN » → « d'Artagnan », « O'NEIL » → « O'Neil »", () => {
    expect(appNameCase("DE LA TOUR")).toBe("de La Tour");
    expect(appNameCase("LE GALL")).toBe("Le Gall");
    expect(appNameCase("D'ARTAGNAN")).toBe("d'Artagnan");
    expect(appNameCase("O'NEIL")).toBe("O'Neil");
    expect(appNameCase("VAN DER BERG")).toBe("van der Berg");
  });

  it("traits d'union : « JEAN-PIERRE », « SAINT-EXEMPLE », « AIX-EN-PROVENCE », « SAINT-JEAN-DE-LUZ »", () => {
    expect(appNameCase("JEAN-PIERRE")).toBe("Jean-Pierre");
    expect(appNameCase("SAINT-EXEMPLE")).toBe("Saint-Exemple");
    expect(appNameCase("AIX-EN-PROVENCE")).toBe("Aix-en-Provence");
    expect(appNameCase("SAINT-JEAN-DE-LUZ")).toBe("Saint-Jean-de-Luz");
    expect(appNameCase("BOULOGNE-SUR-MER")).toBe("Boulogne-sur-Mer");
  });

  it("accents : « ÉLODIE », « CHÂLONS-EN-CHAMPAGNE », « ÇA »", () => {
    expect(appNameCase("ÉLODIE")).toBe("Élodie");
    expect(appNameCase("CHÂLONS-EN-CHAMPAGNE")).toBe("Châlons-en-Champagne");
    expect(appNameCase("ÇAVA")).toBe("Çava");
  });

  it("« MC » : « MCALLISTER » → « McAllister » ; une initiale ou un sigle d'une lettre reste en capitale", () => {
    expect(appNameCase("MCALLISTER")).toBe("McAllister");
    expect(appNameCase("J.-P. MARTIN")).toBe("J.-P. Martin");
    expect(appNameCase("A. LEROY")).toBe("A. Leroy");
  });

  it("ce qui n'est pas tout en capitales reste tel quel ; espaces gardés ; vide reste vide", () => {
    expect(appNameCase("de La Tour")).toBe("de La Tour");
    expect(appNameCase("McAllister")).toBe("McAllister");
    expect(appNameCase("léa martin")).toBe("léa martin");
    expect(appNameCase("Clémence  MARTIN")).toBe("Clémence  Martin");
    expect(appNameCase("")).toBe("");
  });
});
