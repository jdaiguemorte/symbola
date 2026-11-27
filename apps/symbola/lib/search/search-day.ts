// Lot 70e (HUB-12 ; M9) — « Léa & Maxime · dans 6 jours » : où mène un résultat de recherche, dit en
// jours à partir d'aujourd'hui. Dates sans heure (`AAAA-MM-JJ`) : pas de dérive à l'heure d'été.
export function dayDistance(today: string, date: string): number {
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

export type DayPhrase = { kind: "today" } | { kind: "tomorrow" } | { kind: "yesterday" } | { kind: "future"; days: number } | { kind: "past"; days: number };

export function dayPhrase(distance: number): DayPhrase {
  if (distance === 0) return { kind: "today" };
  if (distance === 1) return { kind: "tomorrow" };
  if (distance === -1) return { kind: "yesterday" };
  return distance > 0 ? { kind: "future", days: distance } : { kind: "past", days: -distance };
}
