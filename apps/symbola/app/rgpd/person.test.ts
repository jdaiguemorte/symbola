import { describe, expect, it } from "vitest";
import { displayPerson } from "./person";

describe("RGPD-09 — Nom d'une demande close anonymisé, affiché traduit", () => {
  it("Étant donné un nom anonymisé par la purge, alors l'écran affiche le texte traduit", () => {
    expect(displayPerson("[anonymisé]", "[anonymised]")).toBe("[anonymised]");
  });

  it("Étant donné un nom encore gardé comme preuve, alors il s'affiche tel quel", () => {
    expect(displayPerson("Élodie Martin", "[anonymised]")).toBe("Élodie Martin");
  });
});
