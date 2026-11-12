import { describe, expect, it } from "vitest";
import { starterBudgetVatRateBasisPoints } from "@symbola/starter-templates";
import { budgetClientKind, htFromTtcCents, htTotalByRate } from "./vat";

describe("BUD-09 — HT d'un montant saisi TTC (ADR 0059)", () => {
  it("120,00 € TTC à 20 % font 100,00 € HT", () => {
    expect(htFromTtcCents(12000, 2000)).toBe(10000);
  });

  it("arrondit au centime le plus proche : 1,00 € TTC à 20 % font 0,83 € HT", () => {
    expect(htFromTtcCents(100, 2000)).toBe(83);
  });

  it("arrondit un demi-centime vers le haut : 0,03 € TTC à 20 % (2,5 centimes) font 0,03 € HT", () => {
    expect(htFromTtcCents(3, 2000)).toBe(3);
  });

  it("à 0 % (prestataire en franchise), le HT égale le TTC", () => {
    expect(htFromTtcCents(54321, 0)).toBe(54321);
  });

  it("un écart négatif garde son signe et le même arrondi", () => {
    expect(htFromTtcCents(-12000, 2000)).toBe(-10000);
    expect(htFromTtcCents(-3, 2000)).toBe(-3);
  });

  it("ne passe jamais par un nombre à virgule : un gros budget reste exact", () => {
    expect(htFromTtcCents(1_200_000_00, 2000)).toBe(1_000_000_00);
  });
});

describe("BUD-09 — Total HT par taux (ADR 0059, point 4)", () => {
  it("additionne les TTC d'un même taux avant de convertir, une seule fois par taux", () => {
    const lines = [{ ttc: 100 }, { ttc: 100 }, { ttc: 100 }];
    // Ligne par ligne : 3 × 0,83 = 2,49 ; par taux : 3,00 € TTC → 2,50 € HT.
    expect(htTotalByRate(lines, () => 2000, (line) => line.ttc)).toBe(250);
  });

  it("convertit chaque taux à part : 20 %, 10 % et 0 %", () => {
    const lines = [
      { rate: 2000, ttc: 12000 },
      { rate: 1000, ttc: 11000 },
      { rate: 0, ttc: 5000 },
    ];
    expect(htTotalByRate(lines, (line) => line.rate, (line) => line.ttc)).toBe(25000);
  });

  it("ignore les montants inconnus", () => {
    expect(htTotalByRate([{ ttc: null }, { ttc: 12000 }], () => 2000, (line) => line.ttc)).toBe(10000);
  });
});

describe("BUD-09 — Le mode dépend du type de client, sans réglage manuel (D5)", () => {
  it("particulier sans devis", () => {
    expect(budgetClientKind([])).toBe("individual");
  });

  it("le type d'acheteur du devis le plus récent", () => {
    expect(budgetClientKind([
      { status: "draft", clientKind: "individual" },
      { status: "sent", clientKind: "professional" },
    ])).toBe("professional");
  });

  it("le devis signé l'emporte sur un brouillon plus récent", () => {
    expect(budgetClientKind([
      { status: "signed", clientKind: "professional" },
      { status: "draft", clientKind: "individual" },
    ])).toBe("professional");
  });

  it("le taux de départ des modèles est de 20 %", () => {
    expect(starterBudgetVatRateBasisPoints()).toBe(2000);
  });
});
