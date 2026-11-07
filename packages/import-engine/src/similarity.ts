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

// Lot 14 (IMP-07) — prestataire du carnet : même nom (casse et accents près),
// même ville si elle est renseignée des deux côtés.
export function vendorSimilarity(row: { name: string; city: string | null }, candidate: { name: string; city: string | null }): number {
  const name = textSimilarity(row.name, candidate.name);
  let factor = 1;
  if (row.city && candidate.city) factor = textSimilarity(row.city, candidate.city) >= 0.85 ? 1 : 0.3;
  else if (row.city || candidate.city) factor = 0.9;
  return Math.round(name * factor * 100);
}

// Lot 14 (décision N) — type de prestataire d'un fichier rapproché d'un type
// du carnet : même nom (100), même groupe de synonymes (90, « Coiffeur(se) »
// et « Coiffure »), ou nom très proche (au moins 90). Groupes : données de
// @symbola/starter-templates.
export const VENDOR_TYPE_SYNONYM_SCORE = 90;

export function matchVendorType(
  label: string,
  types: { id: string; label: string }[],
  synonymGroups: readonly (readonly string[])[],
): { typeId: string; score: number } | null {
  const key = normalizeLabel(label).join(" ");
  if (key === "") return null;
  const exact = types.find((type) => normalizeLabel(type.label).join(" ") === key);
  if (exact) return { typeId: exact.id, score: 100 };
  const groups = synonymGroups.map((group) => new Set(group.map((entry) => normalizeLabel(entry).join(" "))));
  const own = groups.filter((group) => group.has(key));
  const synonym = types.find((type) => own.some((group) => group.has(normalizeLabel(type.label).join(" "))));
  if (synonym) return { typeId: synonym.id, score: VENDOR_TYPE_SYNONYM_SCORE };
  let best: { typeId: string; score: number } | null = null;
  for (const type of types) {
    const score = labelSimilarity(label, type.label);
    if (score >= VENDOR_TYPE_SYNONYM_SCORE && (!best || score > best.score)) best = { typeId: type.id, score };
  }
  return best;
}
