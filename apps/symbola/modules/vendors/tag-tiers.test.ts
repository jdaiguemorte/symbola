import { describe, expect, it } from "vitest";
import { parseTier, proposeTierGroups, tierUnitKey } from "./tag-tiers";

describe("Lot 20 (décision 5) — Paliers d'étiquettes repérés dans les libellés", () => {
  it("lit les tranches « 100 à 150 personnes », « Moins de 50 personnes » et « Plus de 200 personnes »", () => {
    expect(parseTier("100 à 150 personnes")).toEqual({ floor: 100, unit: "personnes" });
    expect(parseTier("100 à 200m2")).toEqual({ floor: 100, unit: "m2" });
    expect(parseTier("100 - 200 m2")).toEqual({ floor: 100, unit: "m2" });
    expect(parseTier("Moins de 50 personnes")).toEqual({ floor: 0, unit: "personnes" });
    expect(parseTier("Plus de 200 personnes")).toEqual({ floor: 200.5, unit: "personnes" });
    expect(parseTier("Champêtre")).toBeNull();
    expect(parseTier("Accès PMR")).toBeNull();
  });

  it("regroupe par unité, sans casse ni pluriel, et trie du plus petit au plus grand palier", () => {
    const proposals = proposeTierGroups([
      { id: "c", label: "150 à 200 personnes" },
      { id: "a", label: "Moins de 50 Personne" },
      { id: "b", label: "100 à 150 personnes" },
      { id: "d", label: "Plus de 200 personnes" },
      { id: "e", label: "100 à 200m2" },
      { id: "f", label: "Champêtre" },
    ]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.tags.map((tag) => tag.id)).toEqual(["a", "b", "c", "d"]);
    expect(tierUnitKey("Personnes")).toBe(tierUnitKey("personne"));
  });

  it("une unité seule (un palier) n'est pas proposée", () => {
    expect(proposeTierGroups([{ id: "x", label: "100 à 200m2" }, { id: "y", label: "Bougies" }])).toEqual([]);
  });
});
