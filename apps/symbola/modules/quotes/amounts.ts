// DEV-01 — règles pures de calcul d'un devis, testées sans base : montants
// en centimes entiers, taux et remises en points de base (2000 = 20 %),
// quantités en millièmes (1500 = 1,5) — jamais de float (CLAUDE.md §5).

// Arrondi au plus proche, demi vers le haut, pour des entiers positifs.
export function roundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export type LineInput = { quantityMilli: number; unitPriceCents: number; discountBasisPoints: number };

export function lineAmounts(line: LineInput): { grossCents: number; discountCents: number; netCents: number } {
  const grossCents = roundHalfUp(line.quantityMilli * line.unitPriceCents, 1000);
  const discountCents = roundHalfUp(grossCents * line.discountBasisPoints, 10000);
  return { grossCents, discountCents, netCents: grossCents - discountCents };
}

export type GlobalDiscount =
  | { kind: "none" }
  | { kind: "percent"; basisPoints: number }
  | { kind: "amount"; cents: number };

export type VatLine = { rateBasisPoints: number; baseCents: number; vatCents: number };

export type QuoteTotals = {
  subtotalCents: number;
  globalDiscountCents: number;
  totalHtCents: number;
  vatByRate: VatLine[];
  totalVatCents: number;
  totalTtcCents: number;
};

// La remise globale est répartie entre les taux de TVA au prorata de leur
// base ; le dernier taux reçoit le reste, pour que la somme des bases
// égale exactement le total HT.
export function computeQuoteTotals(
  lines: (LineInput & { vatRateBasisPoints: number })[],
  globalDiscount: GlobalDiscount,
  vatApplicable: boolean,
): QuoteTotals {
  const baseByRate = new Map<number, number>();
  let subtotalCents = 0;
  for (const line of lines) {
    const { netCents } = lineAmounts(line);
    subtotalCents += netCents;
    const rate = vatApplicable ? line.vatRateBasisPoints : 0;
    baseByRate.set(rate, (baseByRate.get(rate) ?? 0) + netCents);
  }

  const requested =
    globalDiscount.kind === "percent"
      ? roundHalfUp(subtotalCents * globalDiscount.basisPoints, 10000)
      : globalDiscount.kind === "amount"
        ? globalDiscount.cents
        : 0;
  const globalDiscountCents = Math.min(requested, subtotalCents);
  const totalHtCents = subtotalCents - globalDiscountCents;

  if (!vatApplicable) {
    return { subtotalCents, globalDiscountCents, totalHtCents, vatByRate: [], totalVatCents: 0, totalTtcCents: totalHtCents };
  }

  const rates = [...baseByRate.keys()].sort((a, b) => a - b);
  let distributed = 0;
  const vatByRate: VatLine[] = rates.map((rateBasisPoints, index) => {
    const base = baseByRate.get(rateBasisPoints)!;
    const share =
      index === rates.length - 1
        ? globalDiscountCents - distributed
        : subtotalCents === 0
          ? 0
          : roundHalfUp(globalDiscountCents * base, subtotalCents);
    distributed += share;
    const baseCents = base - share;
    return { rateBasisPoints, baseCents, vatCents: roundHalfUp(baseCents * rateBasisPoints, 10000) };
  });
  const totalVatCents = vatByRate.reduce((sum, rate) => sum + rate.vatCents, 0);
  return { subtotalCents, globalDiscountCents, totalHtCents, vatByRate, totalVatCents, totalTtcCents: totalHtCents + totalVatCents };
}

// Numéro d'un document : « D-2027-0001 » (série, année, rang sur 4 chiffres
// au moins). Le préfixe est paramétrable par organisation.
export function formatDocumentNumber(prefix: string, year: number, rank: number): string {
  return `${prefix}-${year}-${String(rank).padStart(4, "0")}`;
}

// Date sans heure (« AAAA-MM-JJ ») + n jours, calculée en UTC : un jour vaut
// toujours 24 h, sans effet du passage à l'heure d'été.
export function validUntil(sentOn: string, validityDays: number): string {
  const [year, month, day] = sentOn.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + validityDays)).toISOString().slice(0, 10);
}
