// Lot 73d (PRE-01 ; spécification du lot 73, § 5.4, critère 4) — un nom proche d'une fiche du carnet, signalé
// sous le champ de la fenêtre de création : la ressemblance des noms de l'import (textSimilarity de
// @symbola/import-engine, lot 14), le signalement des doublons du 71d n'étant pas encore fusionné. La
// création reste possible. Côté serveur seulement : le moteur d'import n'entre pas dans la page.
import { textSimilarity } from "@symbola/import-engine";

// La ressemblance à partir de laquelle un nom est signalé (« Calèches du Lac » et « Calèches du Marais »).
export const SIMILAR_NAME_SCORE = 0.6;

export type SimilarVendor = { id: string; name: string; city: string | null };

// La fiche du carnet dont le nom ressemble le plus au nom tapé, s'il y en a une ; la fiche modifiée elle-
// même n'est jamais signalée. Moins de trois lettres : rien.
export function similarVendor(name: string, candidates: SimilarVendor[], options: { exceptId?: string | null } = {}): SimilarVendor | null {
  const typed = name.trim();
  if (typed.replace(/[^\p{L}\p{N}]/gu, "").length < 3) return null;
  let best: { vendor: SimilarVendor; score: number } | null = null;
  for (const vendor of candidates) {
    if (vendor.id === options.exceptId) continue;
    const score = textSimilarity(typed, vendor.name);
    if (score >= SIMILAR_NAME_SCORE && (!best || score > best.score)) best = { vendor, score };
  }
  return best?.vendor ?? null;
}
