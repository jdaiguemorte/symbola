// Lot 71e (HUB-14, UX-17 ; spécification du lot 71, § 5.5, critère 1 et tests ; R10, C-62).
import { describe, expect, it } from "vitest";
import { personFromFullName, sameCouple } from "./couple";

const leaHugo = [
  { firstName: "Léa", lastName: "Martin" },
  { firstName: "Hugo", lastName: "Bernard" },
];

describe("HUB-14 — Le fichier d'un autre couple arrête l'import (sameCouple, lot 71e)", () => {
  it("« Clémence MARTIN, Bastien LEROY » n'est pas « Léa Martin, Hugo Bernard » : un autre couple", () => {
    expect(sameCouple(["Clémence MARTIN", "Bastien LEROY"].map(personFromFullName), leaHugo)).toBe("different");
  });

  it("« Léa MARTIN » seule suffit à ne rien demander", () => {
    expect(sameCouple([personFromFullName("Léa MARTIN")], leaHugo)).toBe("same");
  });

  it("« Martin » seul ne suffit pas", () => {
    expect(sameCouple([personFromFullName("MARTIN")], leaHugo)).toBe("different");
    expect(sameCouple([{ firstName: null, lastName: "Martin" }], leaHugo)).toBe("different");
  });

  it("les accents et la casse sont ignorés", () => {
    expect(sameCouple([personFromFullName("LEA MARTIN")], leaHugo)).toBe("same");
    expect(sameCouple([personFromFullName("hugo bernard")], leaHugo)).toBe("same");
  });

  it("le prénom et le nom inversés concordent", () => {
    expect(sameCouple([personFromFullName("MARTIN Léa")], leaHugo)).toBe("same");
    expect(sameCouple([{ firstName: "Bernard", lastName: "Hugo" }], leaHugo)).toBe("same");
  });

  it("un seul marié du fichier, ou un seul sur la fiche, suffit à comparer", () => {
    expect(sameCouple([personFromFullName("Hugo BERNARD")], leaHugo)).toBe("same");
    expect(sameCouple(["Clémence MARTIN", "Hugo BERNARD"].map(personFromFullName), [{ firstName: "Hugo", lastName: "Bernard" }])).toBe("same");
  });

  it("les noms composés se comparent mot pour mot", () => {
    const event = [{ firstName: "Jean-Pierre", lastName: "Le Goff" }];
    expect(personFromFullName("Jean-Pierre LE GOFF")).toEqual({ firstName: "Jean-Pierre", lastName: "LE GOFF" });
    expect(sameCouple([personFromFullName("Jean-Pierre LE GOFF")], event)).toBe("same");
    expect(sameCouple([personFromFullName("Jean Pierre Le Goff")], event)).toBe("same");
    expect(sameCouple([personFromFullName("Jean-Paul LE GOFF")], event)).toBe("different");
  });

  it("un prénom seul (le programme ne donne que « Clémence ») se compare au prénom", () => {
    expect(sameCouple([{ firstName: "Clémence", lastName: null }], leaHugo)).toBe("different");
    expect(sameCouple([{ firstName: "Léa", lastName: null }], leaHugo)).toBe("same");
  });

  it("rien n'est demandé quand la fiche n'a pas de mariés ou que le fichier n'en nomme pas", () => {
    expect(sameCouple([], leaHugo)).toBe("unknown");
    expect(sameCouple([personFromFullName("Clémence MARTIN")], [])).toBe("unknown");
    expect(sameCouple([personFromFullName("Clémence MARTIN")], [{ firstName: "", lastName: null }])).toBe("unknown");
  });
});
