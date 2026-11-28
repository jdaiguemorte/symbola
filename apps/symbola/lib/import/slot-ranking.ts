// Lot 71d (HUB-14, BUD-01, PRE-01 ; spécification du lot 71, § 5.4 ; maquette 08, « Doublons ») — ranger
// chaque ligne d'un budget importé sous un poste du mariage. Une seule règle, dans l'ordre : même nom ;
// synonymes du métier (données de départ, `vendor-type-synonyms.json`) ; l'un commence par l'autre, mot
// entier (« Lieu » → « Lieu de réception ») ; un poste combiné du fichier (« Photo et vidéo ») réparti
// entre deux postes du mariage d'après le détail de chaque ligne, « À vérifier » ; ressemblance forte et
// sans égale ; sinon un nouveau poste aux mots du fichier. Deux postes qui conviennent autant : aucun
// n'est choisi d'office. Chaque ligne reste une ligne : le rangement ne fond rien.
import { textSimilarity } from "@symbola/import-engine";
import { starterCombinedVendorTypes, starterVendorTypeDetailWords, starterVendorTypeSynonyms } from "@symbola/starter-templates";

export type RankingSlot = { id: string; label: string };
export type RankingRow = { rowIndex: number; slotLabel: string | null; lineLabel: string | null };

// « same » : même nom ; « close » : nom proche (synonyme, préfixe, ressemblance) ; « split » : un poste
// combiné du fichier réparti d'après le détail ; « new » : aucun poste proche, un poste sera créé.
export type SlotPlacementReason = "same" | "close" | "split" | "new";
export type SlotPlacement = { rowIndex: number; fileSlot: string; slotId: string | null; reason: SlotPlacementReason };

export type RankingData = {
  synonyms: { key: string; words: string[] }[];
  combined: { parts: string[]; labels: string[] }[];
  details: { key: string; words: string[] }[];
};

// Ressemblance au-dessus de laquelle un poste est « proche » sans autre raison.
const CLOSE_SIMILARITY = 0.8;

export function budgetRankingData(): RankingData {
  return {
    synonyms: starterVendorTypeSynonyms().map((item) => ({ key: item.key, words: [...item.fr, ...item.en] })),
    combined: starterCombinedVendorTypes().items.map((item) => ({ parts: item.parts, labels: [...item.fr, ...item.en] })),
    details: starterVendorTypeDetailWords(),
  };
}

export const foldLabel = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const startsWithWord = (longer: string, shorter: string) => shorter !== "" && foldLabel(longer).startsWith(`${foldLabel(shorter)} `);

function keysOf(label: string, data: RankingData): string[] {
  const folded = foldLabel(label);
  return data.synonyms.filter((group) => group.words.some((word) => foldLabel(word) === folded)).map((group) => group.key);
}

function only<T>(found: readonly T[]): T | null | "ambiguous" {
  if (found.length === 1) return found[0]!;
  return found.length > 1 ? "ambiguous" : null;
}

// Le poste du mariage d'un libellé du fichier, sans le partage d'un poste combiné.
function placeLabel(label: string, slots: readonly RankingSlot[], data: RankingData): { slotId: string; reason: "same" | "close" } | "ambiguous" | null {
  const folded = foldLabel(label);
  const same = only(slots.filter((slot) => foldLabel(slot.label) === folded));
  if (same === "ambiguous") return "ambiguous";
  if (same) return { slotId: same.id, reason: "same" };
  const keys = keysOf(label, data);
  const rules: ((slot: RankingSlot) => boolean)[] = [
    (slot) => keys.length > 0 && keysOf(slot.label, data).some((key) => keys.includes(key)),
    (slot) => startsWithWord(slot.label, label) || startsWithWord(label, slot.label),
  ];
  for (const rule of rules) {
    const found = only(slots.filter(rule));
    if (found === "ambiguous") return "ambiguous";
    if (found) return { slotId: found.id, reason: "close" };
  }
  return null;
}

// Le poste du mariage d'un métier (une clé de départ) : son nom est un synonyme de la clé, ou commence
// par l'un d'eux.
function slotOfKey(key: string, slots: readonly RankingSlot[], data: RankingData): string | null {
  const words = data.synonyms.find((group) => group.key === key)?.words ?? [];
  const found = slots.filter((slot) => words.some((word) => foldLabel(word) === foldLabel(slot.label) || startsWithWord(slot.label, word)));
  return found.length === 1 ? found[0]!.id : null;
}

// Les deux postes (ou plus) d'un poste combiné du fichier, quand chacun de ses métiers a son poste.
function splitTargets(label: string, slots: readonly RankingSlot[], data: RankingData): { key: string; slotId: string }[] | null {
  const folded = foldLabel(label);
  const combined = data.combined.find((item) => item.labels.some((entry) => foldLabel(entry) === folded));
  if (!combined) return null;
  const targets = combined.parts.map((key) => ({ key, slotId: slotOfKey(key, slots, data) }));
  if (targets.some((target) => target.slotId === null)) return null;
  if (new Set(targets.map((target) => target.slotId)).size !== targets.length) return null;
  return targets as { key: string; slotId: string }[];
}

// La part d'un poste combiné que désigne le détail d'une ligne : celle dont le plus de mots y figurent
// (mots du détail du métier et ses synonymes) ; aucune, la première (la ligne reste « À vérifier »).
function splitPart(lineLabel: string | null, targets: readonly { key: string; slotId: string }[], data: RankingData): string {
  const words = new Set(foldLabel(lineLabel ?? "").split(" ").filter(Boolean));
  let best = targets[0]!;
  let bestHits = 0;
  for (const target of targets) {
    const vocabulary = [...(data.details.find((entry) => entry.key === target.key)?.words ?? []), ...(data.synonyms.find((group) => group.key === target.key)?.words ?? [])].map(foldLabel);
    const hits = vocabulary.filter((entry) => entry !== "" && (words.has(entry) || (entry.includes(" ") && foldLabel(lineLabel ?? "").includes(entry)))).length;
    if (hits > bestHits) {
      best = target;
      bestHits = hits;
    }
  }
  return best.slotId;
}

function placeBySimilarity(label: string, slots: readonly RankingSlot[]): string | null {
  const scored = slots.map((slot) => ({ id: slot.id, score: textSimilarity(label, slot.label) })).filter((entry) => entry.score >= CLOSE_SIMILARITY).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0]!.score === scored[1]!.score) return null;
  return scored[0]!.id;
}

export function rankBudgetRows(rows: readonly RankingRow[], slots: readonly RankingSlot[], data: RankingData): SlotPlacement[] {
  const byLabel = new Map<string, { placed: ReturnType<typeof placeLabel>; split: ReturnType<typeof splitTargets>; similar: string | null }>();
  return rows.map((row) => {
    const fileSlot = row.slotLabel?.trim() ?? "";
    let known = byLabel.get(foldLabel(fileSlot));
    if (!known) {
      const placed = fileSlot ? placeLabel(fileSlot, slots, data) : null;
      const split = !placed || placed === "ambiguous" ? (fileSlot ? splitTargets(fileSlot, slots, data) : null) : null;
      const similar = !placed && !split && fileSlot ? placeBySimilarity(fileSlot, slots) : null;
      known = { placed, split, similar };
      byLabel.set(foldLabel(fileSlot), known);
    }
    if (known.placed && known.placed !== "ambiguous") return { rowIndex: row.rowIndex, fileSlot, slotId: known.placed.slotId, reason: known.placed.reason };
    if (known.split) return { rowIndex: row.rowIndex, fileSlot, slotId: splitPart(row.lineLabel, known.split, data), reason: "split" };
    if (known.similar) return { rowIndex: row.rowIndex, fileSlot, slotId: known.similar, reason: "close" };
    return { rowIndex: row.rowIndex, fileSlot, slotId: null, reason: "new" };
  });
}
