import { describe, expect, it } from "vitest";
import { hasTerms, matchesTerms, phoneDigits, prepareTerms, recordMatches } from "./match";

describe("RGPD-01 — Correspondance d'une personne", () => {
  it("nom insensible à la casse et aux accents, chaque mot devant apparaître", () => {
    const terms = prepareTerms({ name: "elodie DURAND" });
    expect(matchesTerms("Élodie Durand", terms)).toBe(true);
    expect(matchesTerms("Durand Élodie", terms)).toBe(true);
    expect(matchesTerms("Élodie Martin", terms)).toBe(false);
    // « Durandal » n'est pas « Durand ».
    expect(matchesTerms("Élodie Durandal", terms)).toBe(false);
  });

  it("un nom réparti sur deux champs (prénom, nom) correspond", () => {
    const terms = prepareTerms({ name: "Élodie Durand" });
    expect(recordMatches(["Élodie", "Durand"], terms)).toBe(true);
    expect(recordMatches(["Élodie", "Martin"], terms)).toBe(false);
  });

  it("e-mail contenu dans le texte, sans tenir compte de la casse", () => {
    const terms = prepareTerms({ email: "Elodie.Durand@Example.org" });
    expect(matchesTerms("elodie.durand@example.org", terms)).toBe(true);
    expect(matchesTerms("Écrire à elodie.durand@example.org avant juin", terms)).toBe(true);
    expect(matchesTerms("ines@example.org", terms)).toBe(false);
  });

  it("téléphone comparé sur ses chiffres, +33 ramené à 0, y compris au milieu d'une note", () => {
    expect(phoneDigits("+33 6 12 34 56 78")).toBe("0612345678");
    expect(phoneDigits("0033612345678")).toBe("0612345678");
    const terms = prepareTerms({ phone: "06.12.34.56.78" });
    expect(matchesTerms("+33 6 12 34 56 78", terms)).toBe(true);
    expect(matchesTerms("Appeler le 06 12 34 56 78 après 18 h", terms)).toBe(true);
    expect(matchesTerms("06 98 76 54 32", terms)).toBe(false);
  });

  it("des termes trop courts ne désignent personne", () => {
    expect(hasTerms(prepareTerms({ name: "A", phone: "12", email: "a" }))).toBe(false);
    expect(hasTerms(prepareTerms({ name: "Lé" }))).toBe(true);
  });
});
