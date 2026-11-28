// Lot 73d (PRE-01, UX-03, UX-10 ; spécification du lot 73, § 5.4, critères 1, 2 et 4 ; V10, C-46 ; maquette
// 20, « Créer ») — les règles pures de la fenêtre unique de création d'un prestataire, la même au carnet et
// depuis un poste du budget.
//
// - Les six champs, dans l'ordre de l'usage (nom, métier, contact, téléphone, e-mail, ville).
// - « Plus de détails » : tout ce que portaient les quatre rubriques d'avant (adresse, SIRET, site et
//   réseaux, étiquettes, évaluation, tarifs, note, champs du métier) ; rien n'est perdu (critère 2).
// - La liste des métiers, rangée par famille ; « À classer » en dernier, choisi exprès (critère 1).
// - Un nom proche d'une fiche du carnet, signalé sous le champ (critère 4) : la ressemblance des noms de
//   l'import (textSimilarity de @symbola/import-engine, lot 14), le signalement des doublons du 71d n'étant
//   pas encore fusionné. La création reste possible.
import { textSimilarity } from "@symbola/import-engine";
import { VENDOR_SOCIAL_NETWORKS } from "@symbola/contracts";
import { UNCLASSIFIED_TRADE } from "@/lib/forms/vendor-create-fields";

export const VENDOR_CREATE_FIELDS = ["name", "typeId", "contactName", "phone", "email", "city"] as const;

// Les champs de « Plus de détails » : ceux des quatre rubriques d'avant (identité, métiers et étiquettes,
// coordonnées, tarifs et note) qui ne sont pas parmi les six. Les étiquettes, les champs du métier et le
// pays suivent le métier choisi ; ils sont nommés ici pour l'inventaire.
export const VENDOR_DETAIL_FIELDS = [
  "addressLine",
  "postalCode",
  "country",
  "siret",
  "website",
  ...VENDOR_SOCIAL_NETWORKS.map((network) => `social_${network}` as const),
  "tagIds",
  "rating",
  "indicativePrices",
  "internalNote",
] as const;

// Les champs des quatre rubriques d'avant (lot 63e), pour vérifier que la fenêtre les garde tous.
export const LEGACY_RUBRIC_FIELDS = [
  "name",
  "siret",
  "website",
  ...VENDOR_SOCIAL_NETWORKS.map((network) => `social_${network}` as const),
  "typeIds",
  "tagIds",
  "contactName",
  "phone",
  "email",
  "addressLine",
  "postalCode",
  "city",
  "country",
  "rating",
  "indicativePrices",
  "internalNote",
] as const;

export type TradeOption = { value: string; label: string };
export type TradeGroup = { label: string | null; options: TradeOption[] };

// Les métiers, rangés par famille (dans l'ordre des familles), les métiers sans famille ensuite ; « À
// classer » est le dernier choix, seul.
export function tradeGroups(types: { id: string; label: string; familyId: string | null }[], families: { id: string; label: string }[], unclassifiedLabel: string): TradeGroup[] {
  const groups: TradeGroup[] = families
    .map((family) => ({ label: family.label, options: types.filter((type) => type.familyId === family.id).map((type) => ({ value: type.id, label: type.label })) }))
    .filter((group) => group.options.length > 0);
  const loose = types.filter((type) => !families.some((family) => family.id === type.familyId)).map((type) => ({ value: type.id, label: type.label }));
  if (loose.length > 0) groups.push({ label: null, options: loose });
  groups.push({ label: null, options: [{ value: UNCLASSIFIED_TRADE, label: unclassifiedLabel }] });
  return groups;
}

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
