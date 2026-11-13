// DEV-04 — règles pures des factures (testées sans base) : ventilation
// d'un montant TTC facturé selon les taux de TVA du devis, au prorata,
// arrondi au centime (demi vers le haut) et sans écart avec le montant.
import { roundHalfUp, type QuoteTotals, type VatLine } from "./amounts";

export type InvoiceTotals = {
  totalHtCents: number;
  vatByRate: VatLine[];
  totalVatCents: number;
  totalTtcCents: number;
};

// Répartit `amountTtcCents` sur les taux du devis en proportion de leur TTC,
// puis sépare base et TVA dans chaque taux ; le dernier taux reçoit le reste.
export function prorateTotals(quoteTotals: QuoteTotals, amountTtcCents: number): InvoiceTotals {
  if (quoteTotals.vatByRate.length === 0 || quoteTotals.totalTtcCents === 0) {
    return { totalHtCents: amountTtcCents, vatByRate: [], totalVatCents: 0, totalTtcCents: amountTtcCents };
  }
  let remaining = amountTtcCents;
  const lines = quoteTotals.vatByRate.map((line, index) => {
    const rateTtc = line.baseCents + line.vatCents;
    const isLast = index === quoteTotals.vatByRate.length - 1;
    const share = isLast ? remaining : roundHalfUp(amountTtcCents * rateTtc, quoteTotals.totalTtcCents);
    remaining -= share;
    const baseCents = rateTtc === 0 ? share : roundHalfUp(share * line.baseCents, rateTtc);
    return { rateBasisPoints: line.rateBasisPoints, baseCents, vatCents: share - baseCents };
  });
  const totalVatCents = lines.reduce((sum, line) => sum + line.vatCents, 0);
  return { totalHtCents: amountTtcCents - totalVatCents, vatByRate: lines, totalVatCents, totalTtcCents: amountTtcCents };
}

// Lot 31c (FAC-05, réponse 7 de l'expert-comptable, D20) — retrait d'un montant figé, taux par
// taux : la base et la TVA de chaque taux, jamais un prorata du reste.
export function subtractTotals(from: InvoiceTotals, minus: InvoiceTotals): InvoiceTotals {
  const rates = [...new Set([...from.vatByRate, ...minus.vatByRate].map((line) => line.rateBasisPoints))].sort((a, b) => a - b);
  const vatByRate = rates.map((rateBasisPoints) => {
    const kept = from.vatByRate.find((line) => line.rateBasisPoints === rateBasisPoints);
    const removed = minus.vatByRate.find((line) => line.rateBasisPoints === rateBasisPoints);
    return {
      rateBasisPoints,
      baseCents: (kept?.baseCents ?? 0) - (removed?.baseCents ?? 0),
      vatCents: (kept?.vatCents ?? 0) - (removed?.vatCents ?? 0),
    };
  });
  return {
    totalHtCents: from.totalHtCents - minus.totalHtCents,
    vatByRate,
    totalVatCents: from.totalVatCents - minus.totalVatCents,
    totalTtcCents: from.totalTtcCents - minus.totalTtcCents,
  };
}

// Lot 31c (D20) — solde : le devis, moins chaque acompte facturé (net de ses avoirs) dans son
// propre taux. Acomptes et solde redonnent exactement le devis, taux par taux. Sans acompte (devis
// à arrhes, D21), le solde est le prix total.
export function balanceTotals(quoteTotals: QuoteTotals, deductions: InvoiceTotals[]): InvoiceTotals {
  const whole: InvoiceTotals = {
    totalHtCents: quoteTotals.totalHtCents,
    vatByRate: quoteTotals.vatByRate.map((line) => ({ ...line })),
    totalVatCents: quoteTotals.totalVatCents,
    totalTtcCents: quoteTotals.totalTtcCents,
  };
  return deductions.reduce(subtractTotals, whole);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
