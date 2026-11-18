// Lot 43 (BUD-11, D9 ; ADR 0089) — règle pure du calendrier des sorties d'argent du client : ses
// échéances (celles de la planner, celles des prestataires), groupées mois par mois, chacune avec son
// payeur et son statut ; filtrable par payeur (un payeur « part seule » ne voit que les siennes).
export type CashEntry = {
  id: string;
  source: "planner" | "vendor";
  label: string;
  // À qui l'argent sort : l'organisation ou le prestataire.
  counterpart: string;
  amountCents: number;
  dueOn: string;
  payerId: string;
  status: "upcoming" | "declared" | "paid";
};

export type CashMonth = { month: string; entries: CashEntry[]; totalCents: number; remainingCents: number };

export function buildCashCalendar(entries: CashEntry[], filter: { payerId: string | null }): CashMonth[] {
  const months = new Map<string, CashEntry[]>();
  for (const entry of entries) {
    if (filter.payerId !== null && entry.payerId !== filter.payerId) continue;
    const month = entry.dueOn.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), entry]);
  }
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, list]) => {
      const sorted = [...list].sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.label.localeCompare(b.label));
      return {
        month,
        entries: sorted,
        totalCents: sorted.reduce((sum, entry) => sum + entry.amountCents, 0),
        remainingCents: sorted.filter((entry) => entry.status !== "paid").reduce((sum, entry) => sum + entry.amountCents, 0),
      };
    });
}
