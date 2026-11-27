import { describe, expect, it } from "vitest";
import { proposeVendorTypeFromName } from "./type-proposal";

// Lot 73a (PRE-01, HUB-14 ; spécification du lot 73, § 5.1, critère 6 ; D9, V6) — un métier proposé
// d'après le nom d'une fiche « à classer », que la planner valide : rien n'est enregistré ici.
describe("PRE-01 — Un métier proposé d'après le nom d'une fiche (lot 73a)", () => {
  const types = [
    { id: "t-caterer", label: "Traiteur", starterKey: "caterer" },
    { id: "t-car", label: "Voiture des mariés", starterKey: "wedding_car" },
    { id: "t-venue", label: "Lieu de réception", starterKey: "venue" },
    { id: "t-florist", label: "Fleuriste", starterKey: null },
  ];
  const synonyms = [
    { key: "caterer", fr: ["Traiteur", "Traiteurs", "Restauration"], en: ["Caterer"] },
    { key: "wedding_car", fr: ["Voiture des mariés", "Calèche"], en: ["Wedding car"] },
    { key: "venue", fr: ["Lieu de réception", "Domaine", "Château"], en: ["Venue"] },
  ];

  it("« Belle Époque Traiteur » → Traiteur, d'après le mot « Traiteur »", () => {
    expect(proposeVendorTypeFromName("Belle Époque Traiteur", types, synonyms)).toEqual({ typeId: "t-caterer", word: "Traiteur" });
  });

  it("« Calèches du Marais » → le métier dont un synonyme est « Calèche », pluriel compris", () => {
    expect(proposeVendorTypeFromName("Calèches du Marais", types, synonyms)).toEqual({ typeId: "t-car", word: "Calèches" });
  });

  it("« Bulles & Cie » → rien", () => {
    expect(proposeVendorTypeFromName("Bulles & Cie", types, synonyms)).toBeNull();
  });

  it("un mot dans un autre mot ne compte pas (« Domaines » dans « Condominium »)", () => {
    expect(proposeVendorTypeFromName("Condominium Events", types, synonyms)).toBeNull();
    expect(proposeVendorTypeFromName("Domaines du Lac", types, synonyms)).toEqual({ typeId: "t-venue", word: "Domaines" });
  });

  it("sans accents ni casse ; un libellé de l'organisation sans synonyme compte aussi", () => {
    expect(proposeVendorTypeFromName("CHATEAU DE LA MOTTE", types, synonyms)).toEqual({ typeId: "t-venue", word: "CHATEAU" });
    expect(proposeVendorTypeFromName("Les fleuristes d'Anna", types, synonyms)).toEqual({ typeId: "t-florist", word: "fleuristes" });
  });

  it("le synonyme le plus long l'emporte (« Voiture des mariés » plutôt qu'un seul mot)", () => {
    const withLieu = [...types, { id: "t-place", label: "Lieu", starterKey: null }];
    expect(proposeVendorTypeFromName("Lieu de réception Les Tilleuls", withLieu, synonyms)).toEqual({ typeId: "t-venue", word: "Lieu de réception" });
  });

  it("n'enregistre rien : la même entrée rend la même proposition, sans effet", () => {
    const before = JSON.stringify(types);
    proposeVendorTypeFromName("Belle Époque Traiteur", types, synonyms);
    expect(JSON.stringify(types)).toBe(before);
  });
});
