// DEV-04 — montants des factures : un acompte reprend la ventilation par
// taux de TVA du devis, au prorata ; arrondis au centime, sans écart avec
// le montant facturé (centimes entiers, jamais de float).
import { describe, expect, it } from "vitest";
import type { QuoteTotals } from "./amounts";
import { addDays, balanceTotals, prorateTotals, subtractTotals } from "./invoicing";

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

describe("FAC-05 — Le solde déduit les acomptes en HT et en TVA, taux par taux (lot 31c, expert-comptable, D20)", () => {
  it("deux taux : chaque acompte figé est retiré de son propre taux", () => {
    const deposit = prorateTotals(ASSUJETTI, 80400);
    expect(balanceTotals(ASSUJETTI, [deposit])).toEqual({
      totalHtCents: 161000,
      vatByRate: [
        { rateBasisPoints: 1000, baseCents: 56000, vatCents: 5600 },
        { rateBasisPoints: 2000, baseCents: 105000, vatCents: 21000 },
      ],
      totalVatCents: 26600,
      totalTtcCents: 187600,
    });
  });

  it("acomptes plus solde redonnent exactement le devis, taux par taux, quel que soit l'arrondi des acomptes", () => {
    for (const amounts of [[1], [7, 33333], [99999, 1], [33333, 33333, 33333], [267999]]) {
      const deposits = amounts.map((amount) => prorateTotals(ASSUJETTI, amount));
      const balance = balanceTotals(ASSUJETTI, deposits);
      for (const line of ASSUJETTI.vatByRate) {
        const paid = deposits.flatMap((deposit) => deposit.vatByRate).filter((entry) => entry.rateBasisPoints === line.rateBasisPoints);
        const rest = balance.vatByRate.find((entry) => entry.rateBasisPoints === line.rateBasisPoints)!;
        expect(rest.baseCents + paid.reduce((sum, entry) => sum + entry.baseCents, 0)).toBe(line.baseCents);
        expect(rest.vatCents + paid.reduce((sum, entry) => sum + entry.vatCents, 0)).toBe(line.vatCents);
      }
      expect(balance.totalTtcCents).toBe(268000 - amounts.reduce((sum, amount) => sum + amount, 0));
      expect(balance.totalHtCents + balance.totalVatCents).toBe(balance.totalTtcCents);
    }
  });

  it("un avoir partiel réduit la déduction de son acompte, taux par taux", () => {
    const deposit = prorateTotals(ASSUJETTI, 80400);
    const credit = prorateTotals({ subtotalCents: deposit.totalHtCents, globalDiscountCents: 0, ...deposit }, 26800);
    const net = subtractTotals(deposit, credit);
    expect(net.totalTtcCents).toBe(53600);
    expect(net.vatByRate.reduce((sum, line) => sum + line.baseCents + line.vatCents, 0)).toBe(53600);
    expect(balanceTotals(ASSUJETTI, [net]).totalTtcCents).toBe(268000 - 53600);
  });

  it("franchise : le solde est le total moins les acomptes, sans TVA", () => {
    const franchise: QuoteTotals = { ...ASSUJETTI, vatByRate: [], totalVatCents: 0, totalHtCents: 300000, totalTtcCents: 300000 };
    const deposit = prorateTotals(franchise, 90000);
    expect(balanceTotals(franchise, [deposit])).toEqual({ totalHtCents: 210000, vatByRate: [], totalVatCents: 0, totalTtcCents: 210000 });
  });

  it("sans acompte : le solde est le devis entier (arrhes : prix total, lot 31c, D21)", () => {
    expect(balanceTotals(ASSUJETTI, [])).toEqual({ totalHtCents: 230000, vatByRate: ASSUJETTI.vatByRate, totalVatCents: 38000, totalTtcCents: 268000 });
  });
});
