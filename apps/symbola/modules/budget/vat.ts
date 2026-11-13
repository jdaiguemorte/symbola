// Lot 28c (BUD-09, décision D5, ADR 0059) — HT d'un budget saisi TTC, sans
// accès aux données. Montants en centimes entiers, taux en points de base
// (2000 = 20 %), jamais de float (CLAUDE.md § 5). Une seule règle d'arrondi :
// au centime le plus proche, la moitié vers le haut (en valeur absolue pour un
// écart négatif), appliquée une fois par taux.
import type { BudgetClientKind } from "@symbola/contracts";

// HT = TTC × 10000 / (10000 + taux), arrondi au centime.
export function htFromTtcCents(ttcCents: number, rateBasisPoints: number): number {
  if (ttcCents < 0) return -htFromTtcCents(-ttcCents, rateBasisPoints);
  const denominator = 10000 + rateBasisPoints;
  return Math.floor((2 * ttcCents * 10000 + denominator) / (2 * denominator));
}

// Total HT de plusieurs montants TTC : additionnés par taux, puis convertis une
// fois par taux (ADR 0059, point 4) ; la somme des HT des lignes peut différer
// d'un centime de ce total.
export function htTotalByRate<T>(items: T[], rateOf: (item: T) => number, ttcOf: (item: T) => number | null): number {
  const ttcByRate = new Map<number, number>();
  for (const item of items) {
    const ttc = ttcOf(item);
    if (ttc === null) continue;
    const rate = rateOf(item);
    ttcByRate.set(rate, (ttcByRate.get(rate) ?? 0) + ttc);
  }
  let total = 0;
  for (const [rate, ttc] of ttcByRate) total += htFromTtcCents(ttc, rate);
  return total;
}

// D5 : le type d'acheteur du devis de l'événement — le devis signé le plus
// récent, à défaut le plus récent ; particulier sans devis. Lot 31b (D16) : un client
// non-professionnel (association, SCI…) voit son budget comme un particulier, TTC.
export function budgetClientKind(quotes: { status: string; clientKind: BudgetClientKind | "non_professional" }[]): BudgetClientKind {
  const signed = quotes.filter((quote) => quote.status === "signed");
  const kind = (signed.at(-1) ?? quotes.at(-1))?.clientKind ?? "individual";
  return kind === "professional" ? "professional" : "individual";
}
