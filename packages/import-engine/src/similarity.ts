// IMP-03 — niveau de ressemblance (0-100) entre une ligne importée et un
// élément existant. Les textes sont comparés sans accents, casse ni
// ponctuation, par coefficient de Dice sur les paires de lettres (tolère les
// fautes de frappe : « Élodie Durand » / « Elodie Durant »).
import { normalizeLabel } from "./mapping";

function bigrams(text: string): Map<string, number> {
  const result = new Map<string, number>();
  const compact = ` ${text} `;
  for (let i = 0; i < compact.length - 1; i += 1) {
    const pair = compact.slice(i, i + 2);
    result.set(pair, (result.get(pair) ?? 0) + 1);
  }
  return result;
}

// Ressemblance de deux textes, de 0 (rien en commun) à 1 (identiques une fois
// normalisés).
export function textSimilarity(a: string, b: string): number {
  const left = normalizeLabel(a).join(" ");
  const right = normalizeLabel(b).join(" ");
  if (left === "" || right === "") return 0;
  if (left === right) return 1;
  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  let shared = 0;
  let total = 0;
  for (const count of leftPairs.values()) total += count;
  for (const count of rightPairs.values()) total += count;
  for (const [pair, count] of leftPairs) shared += Math.min(count, rightPairs.get(pair) ?? 0);
  return (2 * shared) / total;
}

export type PersonName = { firstName: string; lastName: string | null };

// Clients d'un événement, comparés sans tenir compte de leur ordre (« Élodie
// et Mathéo » = « Mathéo et Élodie »).
export function clientsSimilarity(rowClients: PersonName[], candidateClients: PersonName[]): number {
  const full = (person: PersonName) => `${person.firstName} ${person.lastName ?? ""}`.trim();
  if (rowClients.length === 0 || candidateClients.length === 0) return 0;
  const remaining = [...candidateClients];
  let sum = 0;
  for (const client of rowClients) {
    let bestIndex = -1;
    let best = 0;
    remaining.forEach((candidate, index) => {
      // Nom absent d'un côté : seul le prénom est comparé.
      const score =
        client.lastName && candidate.lastName ? textSimilarity(full(client), full(candidate)) : textSimilarity(client.firstName, candidate.firstName);
      if (score > best) {
        best = score;
        bestIndex = index;
      }
    });
    sum += best;
    if (bestIndex !== -1) remaining.splice(bestIndex, 1);
  }
  return sum / Math.max(rowClients.length, candidateClients.length);
}

// Événement : mêmes clients et même date (PRD IMP-03). Une date absente d'un
// côté baisse la ressemblance ; deux dates différentes l'écartent presque.
export function eventSimilarity(
  row: { eventDate: string | null; clients: PersonName[] },
  candidate: { eventDate: string | null; clients: PersonName[] },
): number {
  const clients = clientsSimilarity(row.clients, candidate.clients);
  let factor = 1;
  if (row.eventDate === null || candidate.eventDate === null) factor = 0.8;
  else if (row.eventDate !== candidate.eventDate) factor = 0.3;
  return Math.round(clients * factor * 100);
}

export function labelSimilarity(a: string, b: string): number {
  return Math.round(textSimilarity(a, b) * 100);
}

export const MATCH_THRESHOLD = 60;

export type MatchCandidate<T> = { id: string; value: T };

// Meilleur élément existant pour une ligne, au-dessus du seuil ; à égalité,
// le premier de la liste.
export function bestMatch<R, T>(
  row: R,
  candidates: MatchCandidate<T>[],
  score: (row: R, candidate: T) => number,
  threshold: number = MATCH_THRESHOLD,
): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null;
  for (const candidate of candidates) {
    const value = score(row, candidate.value);
    if (value >= threshold && (!best || value > best.score)) best = { id: candidate.id, score: value };
  }
  return best;
}
