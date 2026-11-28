import { describe, expect, it } from "vitest";
import { compareVendorRecords, findCarnetVendor, onlyOneNameInCommon, vendorLikeness, vendorMatchNeedsCheck } from "./vendor-compare";

const benjaminFile = { name: "Benjamin", type: "DJ", city: "Villeurbanne", email: "bnj.mix@example.org", phone: null };
const benjaminBook = { name: "Benjamin Dupuy", type: "Photographe", city: "Annecy", email: "contact@dupuy-photo.example.org", phone: "06 39 98 00 44" };

describe("HUB-14 — Rapprochements vérifiables (lot 63b)", () => {
  it("la ligne du fichier et la fiche existante sont comparées champ par champ ; une valeur absente d'un côté n'est pas une différence", () => {
    expect(compareVendorRecords(benjaminFile, benjaminBook)).toEqual([
      { key: "name", file: "Benjamin", existing: "Benjamin Dupuy", different: true },
      { key: "type", file: "DJ", existing: "Photographe", different: true },
      { key: "city", file: "Villeurbanne", existing: "Annecy", different: true },
      { key: "email", file: "bnj.mix@example.org", existing: "contact@dupuy-photo.example.org", different: true },
      { key: "phone", file: null, existing: "06 39 98 00 44", different: false },
    ]);
    // Casse, accents, espaces et indicatif ne font pas une différence.
    const same = compareVendorRecords(
      { name: "Studio LUMIERE", type: "photographe", city: "Tours", email: "Lea@Studio.example.org", phone: "+33 6 39 98 00 05" },
      { name: "Studio Lumière", type: "Photographe", city: "TOURS", email: "lea@studio.example.org", phone: "06.39.98.00.05" },
    );
    expect(same.every((line) => !line.different)).toBe(true);
  });

  it("étant donné deux fiches qui n'ont en commun que le prénom, la proposition porte « À vérifier »", () => {
    expect(onlyOneNameInCommon("Benjamin", "Benjamin Dupuy")).toBe(true);
    expect(vendorMatchNeedsCheck(compareVendorRecords(benjaminFile, benjaminBook))).toBe(true);
    expect(onlyOneNameInCommon("Studio Lumière", "Studio Lumière")).toBe(false);
    expect(onlyOneNameInCommon("Maison Verdier Traiteur", "Maison Verdier")).toBe(false);
    // Même nom, même métier, même ville : rien à vérifier.
    expect(vendorMatchNeedsCheck(compareVendorRecords({ ...benjaminBook, email: null }, benjaminBook))).toBe(false);
    // Métier et ville différents, même nom complet : à vérifier aussi.
    expect(vendorMatchNeedsCheck(compareVendorRecords({ ...benjaminBook, type: "DJ", city: "Lyon" }, benjaminBook))).toBe(true);
  });
});

// Lot 71d (HUB-14, PRE-01 ; spécification du lot 71, § 5.4, critère 3 ; maquette 08) — les prestataires
// nommés par un budget face au carnet : retrouvés tels quels (jamais doublés), ou doublon possible
// montré côte à côte, avec ce qui les rapproche en mots. Aucun pourcentage.
describe("HUB-14 — Les prestataires d'un budget face au carnet (lot 71d)", () => {
  const carnet = [
    { id: "v-roche", name: "Domaine de la Roche Fictive" },
    { id: "v-elodie", name: "Élodie Perrot · Beauté" },
    { id: "v-pivoine", name: "Atelier Pivoine" },
    { id: "v-papier", name: "Atelier Papier Plié" },
  ];

  it("un prestataire déjà au carnet est retrouvé tel quel (casse et accents près), jamais doublé", () => {
    expect(findCarnetVendor("Domaine de la Roche Fictive", carnet)).toEqual({ kind: "found", vendorId: "v-roche" });
    expect(findCarnetVendor("atelier pivoine", carnet)).toEqual({ kind: "found", vendorId: "v-pivoine" });
  });

  it("critère 3 : « Élodie Beauté » est un doublon possible de « Élodie Perrot · Beauté »", () => {
    expect(findCarnetVendor("Élodie Beauté", carnet)).toEqual({ kind: "possible", vendorId: "v-elodie" });
  });

  it("un nom sans rien de proche au carnet n'y est pas ; un seul mot générique en commun ne suffit pas", () => {
    expect(findCarnetVendor("Nuit Blanche Sono", carnet)).toEqual({ kind: "none" });
    expect(findCarnetVendor("Atelier Fleuri", carnet)).toEqual({ kind: "none" });
  });

  it("critère 3 : « Ce qui les rapproche » en mots : les mots des deux noms, le même métier ; le téléphone qui ne peut pas être comparé", () => {
    const likeness = vendorLikeness(
      { name: "Élodie Beauté", type: "Coiffure et maquillage", city: null, email: null, phone: null },
      { name: "Élodie Perrot · Beauté", type: "Coiffure et maquillage", city: "Vertou", email: null, phone: "06 39 98 10 26" },
    );
    expect(likeness).toEqual({ sharedWords: ["Élodie", "Beauté"], sameType: true, sameCity: false, phoneComparable: false });
  });
});
