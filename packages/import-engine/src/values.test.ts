import { describe, expect, it } from "vitest";
import {
  detectDateOrder,
  detectDecimalStyle,
  looksLikeEmail,
  looksLikePhone,
  parseAmountCents,
  parseDate,
  parsePercentageBasisPoints,
} from "./values";

describe("IMP-02 — Les dates et montants au format français sont reconnus", () => {
  it.each([
    ["31/12/2026", "2026-12-31"],
    ["31.12.2026", "2026-12-31"],
    ["31-12-2026", "2026-12-31"],
    ["1/3/27", "2027-03-01"],
    ["2026-12-31", "2026-12-31"],
    ["2026-12-31 14:30", "2026-12-31"],
    ["2026-12-31T00:00:00", "2026-12-31"],
    ["29/02/2028", "2028-02-29"],
  ])("date %j → %s", (value, expected) => {
    expect(parseDate(value)).toBe(expected);
  });

  it.each(["31/02/2026", "29/02/2027", "32/01/2026", "2026-13-01", "demain", "12/2026", ""])("date invalide %j", (value) => {
    expect(parseDate(value)).toBeNull();
  });

  it("une date ambiguë (05/06/2026) suit le format majoritaire de la colonne", () => {
    expect(detectDateOrder(["05/06/2026", "25/12/2026", "13/01/2027"])).toBe("dmy");
    expect(detectDateOrder(["05/06/2026", "12/25/2026", "01/13/2027"])).toBe("mdy");
    // À égalité ou sans indice : le français.
    expect(detectDateOrder(["05/06/2026", "01/02/2027"])).toBe("dmy");
    expect(parseDate("05/06/2026", "dmy")).toBe("2026-06-05");
    expect(parseDate("05/06/2026", "mdy")).toBe("2026-05-06");
  });

  it.each([
    ["1 234,56", 123456],
    ["1 234,56 €", 123456],
    ["1 234,56 €", 123456],
    ["1.234,56", 123456],
    ["25 000,00", 2500000],
    ["-12,50", -1250],
    ["(12,50)", -1250],
    ["800", 80000],
    ["0,5", 50],
    ["12.5", 1250],
    ["18500.5", 1850050],
    ["1.500", 150000],
  ])("montant français %j → %i centimes", (value, expected) => {
    expect(parseAmountCents(value, "comma")).toBe(expected);
  });

  it.each([
    ["12,000.00", 1200000],
    ["9500", 950000],
    ["1,234.5", 123450],
  ])("montant anglais %j → %i centimes", (value, expected) => {
    expect(parseAmountCents(value, "dot")).toBe(expected);
  });

  it.each(["", "abc", "12,345,6", "1,2,3", "12 €€", "1,234", "€"])("montant invalide %j (virgule décimale)", (value) => {
    expect(parseAmountCents(value, "comma")).toBeNull();
  });

  it("le séparateur décimal d'une colonne est déduit de ses valeurs", () => {
    expect(detectDecimalStyle(["1 234,56", "800", "75,00"])).toBe("comma");
    expect(detectDecimalStyle(["12,000.00", "9500", "1,234.50"])).toBe("dot");
    expect(detectDecimalStyle(["25000", "18500.5"])).toBe("dot");
    expect(detectDecimalStyle(["800", "1200"])).toBe("comma");
  });

  it("pourcentages en points de base", () => {
    expect(parsePercentageBasisPoints("20 %")).toBe(2000);
    expect(parsePercentageBasisPoints("5,5")).toBe(550);
    expect(parsePercentageBasisPoints("0")).toBe(0);
    expect(parsePercentageBasisPoints("150")).toBeNull();
    expect(parsePercentageBasisPoints("vingt")).toBeNull();
  });

  it("e-mails et téléphones reconnus par leur contenu", () => {
    expect(looksLikeEmail("elodie.durand@example.org")).toBe(true);
    expect(looksLikeEmail("elodie.durand")).toBe(false);
    expect(looksLikePhone("+33 6 12 34 56 78")).toBe(true);
    expect(looksLikePhone("06.12.34.56.78")).toBe(true);
    expect(looksLikePhone("2027")).toBe(false);
  });
});
