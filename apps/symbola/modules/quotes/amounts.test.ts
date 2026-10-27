import { describe, expect, it } from "vitest";
import { computeQuoteTotals, formatDocumentNumber, lineAmounts, roundHalfUp, validUntil } from "./amounts";

describe("DEV-01 — Arrondis (entiers uniquement, jamais de float)", () => {
  it("arrondit au plus proche, demi vers le haut", () => {
    expect(roundHalfUp(5, 10)).toBe(1);
    expect(roundHalfUp(4, 10)).toBe(0);
    expect(roundHalfUp(15, 10)).toBe(2);
    expect(roundHalfUp(0, 7)).toBe(0);
  });
});

describe("DEV-01 — Montants d'une ligne", () => {
  it("quantité en millièmes × prix HT en centimes, puis remise de ligne", () => {
    // 1,5 × 1 234,56 € = 1 851,84 € ; remise 10 % = 185,18 € (185,184 arrondi).
    expect(lineAmounts({ quantityMilli: 1500, unitPriceCents: 123456, discountBasisPoints: 1000 })).toEqual({
      grossCents: 185184,
      discountCents: 18518,
      netCents: 166666,
    });
  });

  it("sans remise, et pour une quantité fractionnaire qui tombe sur un demi-centime", () => {
    expect(lineAmounts({ quantityMilli: 1000, unitPriceCents: 9999, discountBasisPoints: 0 })).toEqual({
      grossCents: 9999,
      discountCents: 0,
      netCents: 9999,
    });
    // 0,5 × 0,01 € = 0,005 € → 0,01 €.
    expect(lineAmounts({ quantityMilli: 500, unitPriceCents: 1, discountBasisPoints: 0 }).grossCents).toBe(1);
  });
});

describe("DEV-01 — Totaux d'un devis", () => {
  const lines = [
    { quantityMilli: 1000, unitPriceCents: 100000, discountBasisPoints: 0, vatRateBasisPoints: 2000 },
    { quantityMilli: 2000, unitPriceCents: 25000, discountBasisPoints: 0, vatRateBasisPoints: 1000 },
  ];

  it("totalise HT, TVA par taux et TTC", () => {
    expect(computeQuoteTotals(lines, { kind: "none" }, true)).toEqual({
      subtotalCents: 150000,
      globalDiscountCents: 0,
      totalHtCents: 150000,
      vatByRate: [
        { rateBasisPoints: 1000, baseCents: 50000, vatCents: 5000 },
        { rateBasisPoints: 2000, baseCents: 100000, vatCents: 20000 },
      ],
      totalVatCents: 25000,
      totalTtcCents: 175000,
    });
  });

  it("répartit une remise globale entre les taux, au prorata, sans perdre un centime", () => {
    const totals = computeQuoteTotals(lines, { kind: "amount", cents: 10001 }, true);
    expect(totals.globalDiscountCents).toBe(10001);
    expect(totals.totalHtCents).toBe(139999);
    expect(totals.vatByRate.reduce((sum, rate) => sum + rate.baseCents, 0)).toBe(139999);
    expect(totals.totalTtcCents).toBe(totals.totalHtCents + totals.totalVatCents);

    const percent = computeQuoteTotals(lines, { kind: "percent", basisPoints: 1000 }, true);
    expect(percent.globalDiscountCents).toBe(15000);
    expect(percent.totalHtCents).toBe(135000);
  });

  it("étant donné une planner en franchise de TVA, aucune TVA n'est calculée : HT = TTC", () => {
    const totals = computeQuoteTotals(lines, { kind: "none" }, false);
    expect(totals.vatByRate).toEqual([]);
    expect(totals.totalVatCents).toBe(0);
    expect(totals.totalTtcCents).toBe(150000);
  });

  it("une remise globale ne dépasse jamais le sous-total", () => {
    expect(computeQuoteTotals(lines, { kind: "amount", cents: 999999 }, true).totalHtCents).toBe(0);
  });
});

describe("DEV-01 — Numéro et validité", () => {
  it("numérote par série et par année, sur 4 chiffres au moins", () => {
    expect(formatDocumentNumber("D", 2027, 1)).toBe("D-2027-0001");
    expect(formatDocumentNumber("F", 2027, 12345)).toBe("F-2027-12345");
  });

  it("calcule la date de fin de validité, passage à l'heure d'été et fin de mois compris", () => {
    expect(validUntil("2027-03-15", 30)).toBe("2027-04-14");
    expect(validUntil("2027-01-31", 30)).toBe("2027-03-02");
    expect(validUntil("2028-02-01", 29)).toBe("2028-03-01");
  });
});
