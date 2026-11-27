import { describe, expect, it } from "vitest";
import { matchSlotToVendorType, proposeSlotForVendorType, proposeVendorTypeForSlot } from "./vendor-slot-match";

// Lot 73a (PRE-02, BUD-01 ; spécification du lot 73, § 5.1, critère 7 ; P7) — la correspondance calculée
// entre un poste du budget et un métier ou une famille du carnet, sans donnée nouvelle.
describe("PRE-02 — La correspondance d'un poste et d'un métier (lot 73a)", () => {
  const catalog = {
    types: [
      { id: "t-caterer", label: "Traiteur", starterKey: "caterer", familyId: "f-food" },
      { id: "t-florist", label: "Fleuriste", starterKey: "florist", familyId: "f-decor" },
      { id: "t-decorator", label: "Décorateur", starterKey: "decorator", familyId: "f-decor" },
      { id: "t-transport", label: "Transport des invités", starterKey: "transport", familyId: "f-move" },
      { id: "t-dj", label: "DJ / musiciens", starterKey: "music", familyId: "f-fun" },
    ],
    families: [
      { id: "f-food", label: "Traiteur et boissons" },
      { id: "f-decor", label: "Fleurs et décoration" },
      { id: "f-move", label: "Transport et logistique" },
      { id: "f-fun", label: "Musique et animation" },
    ],
    synonyms: [
      { key: "caterer", fr: ["Traiteur", "Restauration"], en: ["Caterer", "Catering"] },
      { key: "music", fr: ["DJ / musiciens", "DJ", "Orchestre"], en: ["DJ", "Band"] },
      { key: "transport", fr: ["Transport des invités", "Navette"], en: ["Shuttle"] },
    ],
  };

  it("le poste de départ « Traiteur » donne le métier « Traiteur »", () => {
    expect(matchSlotToVendorType("Traiteur", catalog)).toEqual({ kind: "type", typeId: "t-caterer" });
  });

  it("« Fleurs et décoration » donne la famille du même nom", () => {
    expect(matchSlotToVendorType("Fleurs et décoration", catalog)).toEqual({ kind: "family", familyId: "f-decor" });
  });

  it("un synonyme des modèles de départ (« Orchestre », « Catering ») donne son métier", () => {
    expect(matchSlotToVendorType("Orchestre", catalog)).toEqual({ kind: "type", typeId: "t-dj" });
    expect(matchSlotToVendorType("catering", catalog)).toEqual({ kind: "type", typeId: "t-caterer" });
  });

  it("à défaut, la ressemblance des mots (« Fleurs » et « Fleuriste »)", () => {
    expect(matchSlotToVendorType("Fleurs", catalog)).toEqual({ kind: "type", typeId: "t-florist" });
  });

  it("un poste créé à la main sans correspondance ne donne rien : la fenêtre demande de choisir", () => {
    expect(matchSlotToVendorType("Feu d'artifice", catalog)).toBeNull();
    expect(matchSlotToVendorType("", catalog)).toBeNull();
  });

  it("dans l'autre sens : le poste proposé d'après le métier d'une fiche, celui du métier avant celui de la famille", () => {
    const slots = [
      { id: "s-music", label: "DJ / musiciens" },
      { id: "s-decor", label: "Fleurs et décoration" },
      { id: "s-florist", label: "Fleuriste" },
      { id: "s-hand", label: "Feu d'artifice" },
    ];
    expect(proposeSlotForVendorType(slots, "t-florist", catalog)).toBe("s-florist");
    expect(proposeSlotForVendorType(slots.filter((slot) => slot.id !== "s-florist"), "t-florist", catalog)).toBe("s-decor");
    expect(proposeSlotForVendorType(slots, "t-caterer", catalog)).toBeNull();
    expect(proposeSlotForVendorType(slots, null, catalog)).toBeNull();
  });

  it("le métier proposé d'après le poste (création depuis un poste) : celui du poste, ou rien pour une famille", () => {
    expect(proposeVendorTypeForSlot("Transport des invités", catalog)).toBe("t-transport");
    expect(proposeVendorTypeForSlot("Fleurs et décoration", catalog)).toBeNull();
  });
});
