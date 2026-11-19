import { describe, expect, it } from "vitest";
import { financialSummary, showsTimeDashboard } from "./financial-rules";

describe("PAR-09 — Bilan financier de la clôture (lot 58)", () => {
  it("marge = honoraires + commissions − frais propres, au centime", () => {
    expect(financialSummary({ feesCents: 350000, commissionsCents: 42050, ownExpensesCents: 18033, timeSpentMinutes: null })).toMatchObject({ marginCents: 374017, marginPerHourCents: null });
  });

  it("le temps passé, s'il est saisi, donne la marge par heure (arrondie au demi supérieur)", () => {
    expect(financialSummary({ feesCents: 100000, commissionsCents: 0, ownExpensesCents: 0, timeSpentMinutes: 90 }).marginPerHourCents).toBe(66667);
    expect(financialSummary({ feesCents: 0, commissionsCents: 0, ownExpensesCents: 1000, timeSpentMinutes: 60 }).marginPerHourCents).toBe(-1000);
  });

  it("sans temps saisi, le tableau de bord n'est pas mis en avant", () => {
    expect(showsTimeDashboard([{ timeSpentMinutes: null }, { timeSpentMinutes: null }])).toBe(false);
    expect(showsTimeDashboard([{ timeSpentMinutes: null }, { timeSpentMinutes: 600 }])).toBe(true);
  });
});
