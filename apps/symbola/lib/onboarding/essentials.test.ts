// Lot 63f (HUB-09, HUB-18, HUB-23, UX-04 ; ADR 0103) — assistant « L'essentiel » : étapes
// proposées, ce qui manque pour envoyer un devis, étape où reprendre.
import { describe, expect, it } from "vitest";
import { essentialSteps, essentialsDone, missingForQuote, nextEssentialStep, stepDone, type EssentialsSnapshot } from "./essentials";

const empty: EssentialsSnapshot = {
  organizationName: "",
  siret: null,
  address: null,
  postalCode: null,
  city: null,
  logoKey: null,
  vatRegime: null,
  iban: null,
  quotesEnabled: true,
  reached: 0,
  finished: false,
};

const filled: EssentialsSnapshot = {
  ...empty,
  organizationName: "Atelier Lumière",
  siret: "73282932000074",
  address: "12 rue des Tilleuls",
  postalCode: "69002",
  city: "Lyon",
  vatRegime: "franchise",
};

describe("HUB-09, HUB-18, HUB-23 — Assistant « L'essentiel »", () => {
  it("six étapes, une question par écran : société, adresse, logo, TVA, banque, numérotation", () => {
    expect(essentialSteps(true)).toEqual(["company", "address", "logo", "vat", "bank", "numbering"]);
  });

  it("ARC-06 : sans le module Devis, ni banque ni numérotation (quatre étapes)", () => {
    expect(essentialSteps(false)).toEqual(["company", "address", "logo", "vat"]);
  });

  it("raison sociale, adresse, SIRET et régime de TVA sont obligatoires pour envoyer un devis", () => {
    expect(missingForQuote(empty)).toEqual(["organizationName", "address", "siret", "vatRegime"]);
    expect(missingForQuote(filled)).toEqual([]);
  });

  it("l'adresse compte faite seulement avec la ligne, le code postal et la ville", () => {
    expect(missingForQuote({ ...filled, postalCode: null })).toEqual(["address"]);
    expect(missingForQuote({ ...filled, city: "  " })).toEqual(["address"]);
  });

  it("une raison sociale faite d'espaces manque", () => {
    expect(missingForQuote({ ...filled, organizationName: "   " })).toEqual(["organizationName"]);
  });

  it("une étape obligatoire est faite quand ses champs sont remplis ; une étape facultative quand elle a été franchie", () => {
    expect(stepDone("company", filled)).toBe(true);
    expect(stepDone("company", { ...filled, siret: null })).toBe(false);
    expect(stepDone("vat", filled)).toBe(true);
    expect(stepDone("logo", filled)).toBe(false);
    expect(stepDone("logo", { ...filled, logoKey: "org/logo/abc" })).toBe(true);
    // Le logo est passé : l'étape 4 a été atteinte.
    expect(stepDone("logo", { ...filled, reached: 3 })).toBe(true);
    expect(stepDone("bank", { ...filled, iban: "FR7630006000011234567890189" })).toBe(true);
    expect(stepDone("numbering", { ...filled, reached: 5 })).toBe(false);
    expect(stepDone("numbering", { ...filled, reached: 6 })).toBe(true);
  });

  it("reprend à la première étape qui n'est pas faite, la première sinon", () => {
    expect(nextEssentialStep(empty)).toBe(1);
    expect(nextEssentialStep({ ...filled, reached: 2 })).toBe(3);
    expect(nextEssentialStep({ ...filled, reached: 6, iban: "FR76" })).toBe(1);
  });

  it("l'essentiel est réglé quand rien ne manque pour envoyer un devis, assistant fini ou non (les Paramètres comptent aussi)", () => {
    expect(essentialsDone(empty)).toBe(false);
    expect(essentialsDone({ ...empty, finished: true })).toBe(false);
    expect(essentialsDone(filled)).toBe(true);
  });
});
