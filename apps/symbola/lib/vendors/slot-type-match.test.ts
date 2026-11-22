import { describe, expect, it } from "vitest";
import { rankSlotVendors, slotChoiceList, slotMatchesVendorType } from "./slot-type-match";

describe("BUD-04, PRE-02 — « Choisir un prestataire… » propose d'abord le métier du poste (lot 63c, #39)", () => {
  it("un poste va avec le type dont un mot commence comme le sien, accents et casse ignorés", () => {
    expect(slotMatchesVendorType("Fleurs", "Fleuriste")).toBe(true);
    expect(slotMatchesVendorType("Traiteur", "Traiteur")).toBe(true);
    expect(slotMatchesVendorType("Photographe", "Photographe et vidéaste")).toBe(true);
    expect(slotMatchesVendorType("Vidéo", "Vidéaste")).toBe(false);
    expect(slotMatchesVendorType("DJ", "DJ")).toBe(true);
    expect(slotMatchesVendorType("DJ", "Décoratrice")).toBe(false);
    expect(slotMatchesVendorType("Lieu de réception", "Traiteur")).toBe(false);
  });

  it("le métier du poste d'abord, puis « Déjà travaillé ensemble », puis l'ordre alphabétique", () => {
    const ranked = rankSlotVendors(
      [
        { id: "1", name: "Zinnia", matchesSlot: false, workedWith: true },
        { id: "2", name: "Flore et Sens", matchesSlot: true, workedWith: false },
        { id: "3", name: "Atelier Floréal", matchesSlot: true, workedWith: true },
        { id: "4", name: "Amarante", matchesSlot: false, workedWith: false },
      ],
      "fr",
    );
    expect(ranked.map((vendor) => vendor.name)).toEqual(["Atelier Floréal", "Flore et Sens", "Zinnia", "Amarante"]);
  });
});

describe("PRE-02 — Lot 65b : la liste du choix, sans rien taper ou pour une recherche (M14 C)", () => {
  const vendor = (id: string, matchesSlot: boolean) => ({ id, name: id, matchesSlot, workedWith: false });
  it("sans rien taper : tout le métier du poste, au-delà de huit fiches", () => {
    const ranked = [...Array.from({ length: 10 }, (_, index) => vendor(`f${index}`, true)), vendor("autre", false)];
    expect(slotChoiceList(ranked, "  ").map((entry) => entry.id)).toEqual(ranked.slice(0, 10).map((entry) => entry.id));
  });
  it("sans fiche du métier, ou pour une recherche : les huit premières", () => {
    const others = Array.from({ length: 12 }, (_, index) => vendor(`a${index}`, false));
    expect(slotChoiceList(others, "")).toHaveLength(8);
    expect(slotChoiceList([vendor("f", true), ...others], "a")).toHaveLength(8);
  });
});
