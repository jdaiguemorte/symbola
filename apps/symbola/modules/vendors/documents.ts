// Lot 48a (PRE-05 ; D3, ADR 0093) — échéance des pièces d'un prestataire, sans base. Dates en
// « AAAA-MM-JJ » (jours calendaires de Paris) : la pièce vaut jusqu'à son dernier jour inclus.
// - « expiring » : à N jours ou moins de la fin (N = réglage de l'organisation, 30 proposés) ;
// - « expired » : le dernier jour est passé ;
// - une pièce signalée sur un évènement : sa fin tombe avant la date de l'évènement.

export type DocumentAlert = "valid" | "expiring" | "expired" | "no_expiry";

function dayNumber(day: string): number {
  return Math.round(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000);
}

export function documentAlert(document: { validUntil: string | null }, today: string, alertDays: number): DocumentAlert {
  if (!document.validUntil) return "no_expiry";
  const left = dayNumber(document.validUntil) - dayNumber(today);
  if (left < 0) return "expired";
  return left <= alertDays ? "expiring" : "valid";
}

// Pièces déposées (pas seulement demandées) dont la validité s'arrête avant le jour de l'évènement.
export function documentsLapsingBefore<T extends { validUntil: string | null; status: "requested" | "to_verify" | "verified" }>(documents: T[], eventDate: string): T[] {
  return documents.filter((document) => document.status !== "requested" && document.validUntil !== null && document.validUntil < eventDate);
}
