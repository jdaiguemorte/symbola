// Lot 20 (décision 5, ADR 0049) — paliers d'étiquettes. Des étiquettes comme
// « 50 à 100 personnes », « 100 à 150 personnes », « Plus de 200 personnes »
// décrivent la même mesure par tranches : elles forment un groupe « palier »,
// où une fiche n'en porte qu'une. Cette fonction pure les repère dans les
// étiquettes sans groupe (reprise des étiquettes importées), pour les
// proposer ; rien n'est rangé sans validation.

export type TierCandidate = { id: string; label: string };
export type TierProposal = { unit: string; tags: (TierCandidate & { floor: number })[] };

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const PATTERNS: { regex: RegExp; floor: (match: RegExpMatchArray) => number; unit: (match: RegExpMatchArray) => string }[] = [
  // « 100 à 150 personnes », « 100-150 m2 », « 100 à 200m2 »
  { regex: new RegExp(String.raw`^${NUMBER}\s*(?:à|a|-|–)\s*${NUMBER}\s*([^\d\s].*)$`, "i"), floor: (m) => toNumber(m[1]!), unit: (m) => m[3]! },
  // « Moins de 50 personnes », « Jusqu'à 50 personnes »
  { regex: new RegExp(String.raw`^(?:moins de|jusqu'à|jusqu’à|max(?:imum)?)\s*${NUMBER}\s*([^\d\s].*)$`, "i"), floor: () => 0, unit: (m) => m[2]! },
  // « Plus de 200 personnes », « Au-delà de 200 personnes », « + de 200 personnes »
  { regex: new RegExp(String.raw`^(?:plus de|au-delà de|au delà de|\+\s*de|>\s*)\s*${NUMBER}\s*([^\d\s].*)$`, "i"), floor: (m) => toNumber(m[1]!) + 0.5, unit: (m) => m[2]! },
];

function toNumber(value: string): number {
  return Number(value.replace(",", "."));
}

// L'unité comparée sans casse ni accents ni pluriel final (« Personne » et
// « personnes » vont ensemble).
export function tierUnitKey(unit: string): string {
  return unit
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[²]/g, "2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/s$/, "");
}

export function parseTier(label: string): { floor: number; unit: string } | null {
  const clean = label.trim();
  for (const pattern of PATTERNS) {
    const match = clean.match(pattern.regex);
    if (match) return { floor: pattern.floor(match), unit: pattern.unit(match).trim() };
  }
  return null;
}

// Les groupes de paliers proposés : au moins deux étiquettes de la même
// unité, triées du plus petit au plus grand palier.
export function proposeTierGroups(tags: TierCandidate[]): TierProposal[] {
  const byUnit = new Map<string, { unit: string; tags: (TierCandidate & { floor: number })[] }>();
  for (const tag of tags) {
    const tier = parseTier(tag.label);
    if (!tier) continue;
    const key = tierUnitKey(tier.unit);
    const entry = byUnit.get(key) ?? { unit: tier.unit.toLowerCase(), tags: [] };
    entry.tags.push({ ...tag, floor: tier.floor });
    byUnit.set(key, entry);
  }
  return [...byUnit.values()]
    .filter((entry) => entry.tags.length >= 2)
    .map((entry) => ({ unit: entry.unit, tags: [...entry.tags].sort((a, b) => a.floor - b.floor || a.label.localeCompare(b.label, "fr")) }))
    .sort((a, b) => a.unit.localeCompare(b.unit, "fr"));
}
