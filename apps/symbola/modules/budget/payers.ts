// Lot 43 (BUD-06, D8 ; ADR 0089) — règles pures de la répartition par payeur. Une ligne du budget se
// partage entre payeurs, en montant ou en pourcentage ; les montants passent d'abord (plafonnés au
// total), les pourcentages ensuite, et le reste revient aux mariés. Les arrondis vont au plus grand
// reste : la somme des parts égale toujours le total, au centime (ADR 0059 : entiers, jamais de float).
export type PayerShare = { payerId: string; percentageBasisPoints: number | null; amountCents: number | null };

export function lineReferenceAmount(line: { committedAmountCents: number | null; quotedAmountCents: number | null; estimatedAmountCents: number | null }): number {
  return line.committedAmountCents ?? line.quotedAmountCents ?? line.estimatedAmountCents ?? 0;
}

export function splitAmongPayers(totalCents: number, shares: PayerShare[], defaultPayerId: string): Map<string, number> {
  const result = new Map<string, number>();
  const add = (payerId: string, cents: number) => result.set(payerId, (result.get(payerId) ?? 0) + cents);
  let left = Math.max(0, totalCents);
  for (const share of shares) {
    if (share.amountCents === null) continue;
    const cents = Math.min(left, Math.max(0, share.amountCents));
    add(share.payerId, cents);
    left -= cents;
  }
  const base = left;
  const percentages = shares.filter((share) => share.amountCents === null && share.percentageBasisPoints !== null);
  const exact = percentages.map((share) => ({ payerId: share.payerId, raw: (base * share.percentageBasisPoints!) / 10000 }));
  const floors = exact.map((entry) => ({ ...entry, cents: Math.floor(entry.raw) }));
  const sumPercent = percentages.reduce((sum, share) => sum + share.percentageBasisPoints!, 0);
  const target = Math.round((base * Math.min(sumPercent, 10000)) / 10000);
  let extra = target - floors.reduce((sum, entry) => sum + entry.cents, 0);
  const order = [...floors].sort((a, b) => b.raw - b.cents - (a.raw - a.cents));
  for (const entry of order) {
    if (extra <= 0) break;
    entry.cents += 1;
    extra -= 1;
  }
  for (const entry of floors) {
    add(entry.payerId, entry.cents);
    left -= entry.cents;
  }
  if (left > 0 || result.size === 0) add(defaultPayerId, left);
  return result;
}

export type SharesProblem = "invalid" | "duplicate" | "over_100";

export function validateShares(shares: PayerShare[]): SharesProblem | null {
  const seen = new Set<string>();
  let percent = 0;
  for (const share of shares) {
    if (seen.has(share.payerId)) return "duplicate";
    seen.add(share.payerId);
    const hasPercent = share.percentageBasisPoints !== null;
    const hasAmount = share.amountCents !== null;
    if (hasPercent === hasAmount) return "invalid";
    if (hasPercent && (!Number.isInteger(share.percentageBasisPoints) || share.percentageBasisPoints! < 1 || share.percentageBasisPoints! > 10000)) return "invalid";
    if (hasAmount && (!Number.isInteger(share.amountCents) || share.amountCents! < 1)) return "invalid";
    percent += share.percentageBasisPoints ?? 0;
  }
  return percent > 10000 ? "over_100" : null;
}
