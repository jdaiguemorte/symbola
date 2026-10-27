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

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
