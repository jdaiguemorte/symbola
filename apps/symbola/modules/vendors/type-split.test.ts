// Lot 63e (PRE-01, PRE-11, HUB-20 ; ADR 0105) — règles pures des types combinés : reconnaître
// « Photographe et vidéaste » (liste en données, puis séparateurs), et planifier la reprise des types
// combinés d'une organisation (fusion dans le premier métier, métiers suivants retrouvés ou créés).
import { describe, expect, it } from "vitest";
import { combinedTypeParts, planTypeSplit, vendorTypeLabels, type SplitTypeInput } from "./type-split";

describe("PRE-01, PRE-11 — Une valeur combinée donne plusieurs métiers", () => {
  it("« Photographe et vidéaste », « Photographe & Vidéaste » et « Coiffure et maquillage » sont reconnus par la liste en données", () => {
    expect(combinedTypeParts("Photographe et vidéaste")?.keys).toEqual(["photographer", "videographer"]);
    expect(combinedTypeParts("Photographe &amp; Vidéaste")?.keys).toEqual(["photographer", "videographer"]);
    expect(combinedTypeParts("  coiffure ET maquillage ")?.keys).toEqual(["hair_makeup", "makeup"]);
    expect(combinedTypeParts("Hair and make-up")).toEqual({ keys: ["hair_makeup", "makeup"], locale: "en" });
  });

  it("hors de la liste, un libellé coupé par un séparateur l'est si chaque morceau est le synonyme d'un type différent", () => {
    expect(combinedTypeParts("Officiante / Décoratrice")?.keys).toEqual(["officiant", "decorator"]);
    expect(combinedTypeParts("Traiteur + Food truck")?.keys).toEqual(["caterer", "food_truck"]);
    expect(combinedTypeParts("Photographe, vidéaste, photobooth")?.keys).toEqual(["photographer", "videographer", "photobooth"]);
  });

  it("un synonyme d'un seul type n'est jamais coupé (« Hôtel / hébergement », « Vins et boissons », « DJ / musiciens »)", () => {
    for (const label of ["Hôtel / hébergement", "Vins et boissons", "DJ / musiciens", "Sonorisation et lumière", "Mobilier et vaisselle", "Vidéo et écrans", "Photographe", "Baby-sitter"]) {
      expect(combinedTypeParts(label), label).toBeNull();
    }
  });

  it("un morceau inconnu laisse le libellé entier (« Photographe et ami » reste un type)", () => {
    expect(combinedTypeParts("Photographe et ami")).toBeNull();
    expect(combinedTypeParts("Fleurs et fleuristes")).toBeNull();
  });

  it("à l'import, les libellés des métiers sont ceux du catalogue, dans la langue du fichier", () => {
    expect(vendorTypeLabels("Photographe & Vidéaste")).toEqual(["Photographe", "Vidéaste"]);
    expect(vendorTypeLabels("Hair and make-up")).toEqual(["Hair", "Make-up"]);
    expect(vendorTypeLabels("Fleuriste")).toEqual(["Fleuriste"]);
  });
});

const type = (id: string, label: string, extra: Partial<SplitTypeInput> = {}): SplitTypeInput => ({ id, label, familyId: null, starterKey: null, vendorCount: 0, ...extra });

describe("PRE-01, HUB-20 — Reprise des types combinés d'une organisation", () => {
  it("le type combiné est fusionné dans le premier métier existant ; le second est retrouvé par son type de départ ou ses synonymes", () => {
    const plan = planTypeSplit([type("p", "Photographe", { starterKey: "photographer" }), type("v", "Vidéo"), type("c", "Photographe & Vidéaste", { vendorCount: 2 })], "fr");
    expect(plan).toEqual([
      {
        typeId: "c",
        label: "Photographe & Vidéaste",
        vendorCount: 2,
        first: { action: "merge", into: { id: "p", label: "Photographe" } },
        others: [{ key: "videographer", label: "Vidéo", existing: { id: "v", label: "Vidéo" } }],
      },
    ]);
  });

  it("sans type pour le premier métier, le type combiné le devient (renommé) ; un métier suivant absent est à créer", () => {
    const plan = planTypeSplit([type("c", "Coiffure et maquillage", { starterKey: "hair_makeup", vendorCount: 3 })], "fr");
    expect(plan).toEqual([
      { typeId: "c", label: "Coiffure et maquillage", vendorCount: 3, first: { action: "rename", key: "hair_makeup", to: "Coiffure" }, others: [{ key: "makeup", label: "Maquillage", existing: null }] },
    ]);
  });

  it("rien à faire pour une organisation sans type combiné ; rejouée après la reprise, la planification est vide", () => {
    expect(planTypeSplit([type("p", "Photographe", { starterKey: "photographer" }), type("h", "Coiffure", { starterKey: "hair_makeup" })], "fr")).toEqual([]);
  });
});
