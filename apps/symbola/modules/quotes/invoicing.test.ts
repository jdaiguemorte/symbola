// DEV-04 — montants des factures : un acompte reprend la ventilation par
// taux de TVA du devis, au prorata ; arrondis au centime, sans écart avec
// le montant facturé (centimes entiers, jamais de float).
import { describe, expect, it } from "vitest";
import type { QuoteTotals } from "./amounts";
import { addDays, prorateTotals } from "./invoicing";

const ASSUJETTI: QuoteTotals = {
  subtotalCents: 230000,
  globalDiscountCents: 0,
  totalHtCents: 230000,
  vatByRate: [
    { rateBasisPoints: 1000, baseCents: 80000, vatCents: 8000 },
    { rateBasisPoints: 2000, baseCents: 150000, vatCents: 30000 },
  ],
  totalVatCents: 38000,
  totalTtcCents: 268000,
};

describe("DEV-04 — Ventilation d'un montant facturé", () => {
  it("franchise : le montant est HT = TTC, sans TVA", () => {
    const franchise: QuoteTotals = { ...ASSUJETTI, vatByRate: [], totalVatCents: 0, totalHtCents: 300000, totalTtcCents: 300000 };
    expect(prorateTotals(franchise, 90000)).toEqual({ totalHtCents: 90000, vatByRate: [], totalVatCents: 0, totalTtcCents: 90000 });
  });

  it("assujettie : l'acompte suit la répartition par taux du devis, au centime près", () => {
    const deposit = prorateTotals(ASSUJETTI, 80400); // 30 % du TTC
    expect(deposit.totalTtcCents).toBe(80400);
    expect(deposit.vatByRate).toEqual([
      { rateBasisPoints: 1000, baseCents: 24000, vatCents: 2400 },
      { rateBasisPoints: 2000, baseCents: 45000, vatCents: 9000 },
    ]);
    expect(deposit.totalHtCents + deposit.totalVatCents).toBe(80400);
  });

  it("le total facturé est exact même quand le prorata ne tombe pas juste", () => {
    for (const amount of [1, 7, 33333, 99999, 267999, 268000]) {
      const result = prorateTotals(ASSUJETTI, amount);
      expect(result.totalTtcCents).toBe(amount);
      expect(result.totalHtCents + result.totalVatCents).toBe(amount);
      expect(result.vatByRate.reduce((sum, line) => sum + line.baseCents + line.vatCents, 0)).toBe(amount);
    }
  });

  it("calcule une échéance en jours calendaires", () => {
    expect(addDays("2027-12-20", 30)).toBe("2028-01-19");
  });
});
