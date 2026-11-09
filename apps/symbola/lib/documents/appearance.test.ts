import { describe, expect, it } from "vitest";
import { contrastRatio, documentAppearance, MIN_TEXT_CONTRAST } from "./appearance";

const DEFAULT_COLOR = "#3b3b3b";

describe("DEV-09 — Apparence des documents", () => {
  it("une couleur déjà lisible est gardée telle quelle, avec du texte blanc sur le bandeau", () => {
    const appearance = documentAppearance("#4F6B5A", "modern", DEFAULT_COLOR);
    expect(appearance.accent).toBe("#4f6b5a");
    expect(appearance.onAccent).toBe("#ffffff");
  });

  it("une couleur trop claire (jaune pâle) est assombrie jusqu'à 4,5:1 sur le blanc et sur la teinte des blocs", () => {
    const appearance = documentAppearance("#f5e6a3", "modern", DEFAULT_COLOR);
    expect(appearance.accent).not.toBe("#f5e6a3");
    expect(contrastRatio(appearance.accent, "#ffffff")).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    expect(contrastRatio(appearance.accent, appearance.tint)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it("le texte posé sur la couleur est blanc ou encre, selon ce qui contraste le mieux", () => {
    for (const color of ["#a8553a", "#2f4a66", "#b08a2e", "#6d3b5a", "#ff0000", "#00ff00"]) {
      const appearance = documentAppearance(color, "modern", DEFAULT_COLOR);
      expect(contrastRatio(appearance.onAccent, appearance.accent)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  it("sans couleur, ou avec une valeur illisible, la couleur neutre de départ et la police Moderne", () => {
    expect(documentAppearance(null, null, DEFAULT_COLOR)).toMatchObject({ accent: DEFAULT_COLOR, font: "modern" });
    expect(documentAppearance("rouge", undefined, DEFAULT_COLOR).accent).toBe(DEFAULT_COLOR);
  });

  it("la police Classique est gardée", () => {
    expect(documentAppearance("#4f6b5a", "classic", DEFAULT_COLOR).font).toBe("classic");
  });
});
