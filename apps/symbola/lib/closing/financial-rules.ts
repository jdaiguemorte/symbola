// Lot 58 (PAR-09, étape 4 ; D4 ; ADR 0097) — règles pures du bilan financier d'un évènement : la marge
// (honoraires + commissions − frais propres de la planner, réponse de Julien du 18/11), la marge par
// heure si le temps passé est saisi. Montants en centimes entiers ; arrondi au demi supérieur.
export type FinancialFigures = { feesCents: number; commissionsCents: number; ownExpensesCents: number; timeSpentMinutes: number | null };

export type FinancialSummary = FinancialFigures & { marginCents: number; marginPerHourCents: number | null };

function roundHalfUp(numerator: number, denominator: number): number {
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const absolute = Math.floor((Math.abs(numerator) * 2 + Math.abs(denominator)) / (2 * Math.abs(denominator)));
  return sign * absolute;
}

export function financialSummary(figures: FinancialFigures): FinancialSummary {
  const marginCents = figures.feesCents + figures.commissionsCents - figures.ownExpensesCents;
  const marginPerHourCents = figures.timeSpentMinutes && figures.timeSpentMinutes > 0 ? roundHalfUp(marginCents * 60, figures.timeSpentMinutes) : null;
  return { ...figures, marginCents, marginPerHourCents };
}

// Le tableau de bord du temps n'existe que pour qui a saisi un temps : sans saisie, rien n'est mis en
// avant (absent de l'accueil, aucun rappel).
export function showsTimeDashboard(summaries: readonly { timeSpentMinutes: number | null }[]): boolean {
  return summaries.some((summary) => summary.timeSpentMinutes !== null);
}
