import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, looksLikeUrl, normalizePostalCode, splitList, splitPhones, tidyText } from "./cleanup";

describe("IMP-07 / IMP-08 — Remise en état des valeurs exportées (lot 14a)", () => {
  it("décode les entités HTML nommées, accentuées et numériques ; laisse le reste tel quel", () => {
    expect(decodeHtmlEntities("Ch&acirc;teau &amp; Jardins")).toBe("Château & Jardins");
    expect(decodeHtmlEntities("C&eacute;r&eacute;monie la&iuml;que &Agrave; 950&nbsp;&euro;")).toBe("Cérémonie laïque À 950 €");
    expect(decodeHtmlEntities("&#233;t&#xE9; &oelig;uvre")).toBe("été œuvre");
    expect(decodeHtmlEntities("Rock & roll &inconnu; &")).toBe("Rock & roll &inconnu; &");
  });

  it("ramène les espaces multiples et insécables à un seul, ligne par ligne", () => {
    expect(tidyText("  Salle  180 m²  \n\n\n\n  Parc ")).toBe("Salle 180 m²\n\nParc");
  });

  it("complète un code postal à 4 chiffres, garde un code étranger", () => {
    expect(normalizePostalCode("5000")).toBe("05000");
    expect(normalizePostalCode("86000")).toBe("86000");
    expect(normalizePostalCode("1000.0")).toBe("01000");
    expect(normalizePostalCode("SW1A 1AA")).toBe("SW1A 1AA");
  });

  it("sépare et met en forme plusieurs téléphones, avec le prénom entre parenthèses", () => {
    expect(splitPhones("0612345678 ( Amélie),0698765432 ( Paul)")).toEqual([
      { number: "06 12 34 56 78", label: "Amélie" },
      { number: "06 98 76 54 32", label: "Paul" },
    ]);
    expect(splitPhones("+33 6 12 34 56 78")).toEqual([{ number: "06 12 34 56 78", label: null }]);
    expect(splitPhones("06.12.34.56.78")).toEqual([{ number: "06 12 34 56 78", label: null }]);
    expect(splitPhones("+44 20 7946 0000")).toEqual([{ number: "+44 20 7946 0000", label: null }]);
    expect(splitPhones("n/c")).toEqual([]);
  });

  it("découpe une liste sans doublon ni élément vide", () => {
    expect(splitList("Pop, Rock,,pop , Électro")).toEqual(["Pop", "Rock", "Électro"]);
  });

  it("reconnaît une adresse web", () => {
    expect(looksLikeUrl("https://www.exemple.org")).toBe(true);
    expect(looksLikeUrl("www.exemple.org")).toBe(true);
    expect(looksLikeUrl("Moins de 50 invités,50 à 100")).toBe(false);
  });
});
