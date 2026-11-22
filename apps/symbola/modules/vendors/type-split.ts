// Lot 63e (PRE-01, PRE-11, HUB-20 ; ADR 0105) — types combinés : une valeur comme « Photographe et
// vidéaste » désigne deux métiers. Règles pures, sans base :
// - reconnaître une valeur combinée : d'abord la liste en données (vendor-type-synonyms.json,
//   « combined »), puis les séparateurs de cette liste quand chaque morceau est le synonyme d'un type
//   de départ différent ; un synonyme d'un seul type n'est jamais coupé (« Hôtel / hébergement ») ;
// - planifier la reprise des types combinés d'une organisation : le type combiné est fusionné dans
//   son premier métier (fusion du lot 16), ou le devient s'il n'existe pas ; les métiers suivants sont
//   retrouvés (type de départ, synonymes) ou créés.
import { starterCombinedVendorTypes, starterVendorTypes, starterVendorTypeSynonyms, type StarterLocale } from "@symbola/starter-templates";

export function foldTypeLabel(label: string): string {
  return label
    .replace(/&amp;/gi, "&")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/\s+/g, " ")
    .trim();
}

type Dictionary = {
  combined: Map<string, { keys: string[]; locale: StarterLocale }>;
  synonyms: Map<string, { key: string; locale: StarterLocale }>;
  separators: string[];
};

let dictionary: Dictionary | null = null;

function loadDictionary(): Dictionary {
  if (dictionary) return dictionary;
  const data = starterCombinedVendorTypes();
  const combined = new Map<string, { keys: string[]; locale: StarterLocale }>();
  for (const item of data.items) {
    for (const label of item.fr) combined.set(foldTypeLabel(label), { keys: item.parts, locale: "fr" });
    for (const label of item.en) if (!combined.has(foldTypeLabel(label))) combined.set(foldTypeLabel(label), { keys: item.parts, locale: "en" });
  }
  const synonyms = new Map<string, { key: string; locale: StarterLocale }>();
  for (const item of starterVendorTypeSynonyms()) {
    for (const label of item.fr) synonyms.set(foldTypeLabel(label), { key: item.key, locale: "fr" });
    for (const label of item.en) if (!synonyms.has(foldTypeLabel(label))) synonyms.set(foldTypeLabel(label), { key: item.key, locale: "en" });
  }
  // Les plus longs d'abord : « , » ne coupe pas avant « / ».
  const separators = data.separators.map((separator) => separator.toLocaleLowerCase("fr")).sort((a, b) => b.length - a.length);
  dictionary = { combined, synonyms, separators };
  return dictionary;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Métiers (clés des types de départ) d'une valeur combinée, et langue où elle est écrite ; null pour
// une valeur qui ne désigne qu'un type (ou qu'on ne sait pas couper).
export function combinedTypeParts(label: string): { keys: string[]; locale: StarterLocale } | null {
  const { combined, synonyms, separators } = loadDictionary();
  const folded = foldTypeLabel(label);
  if (!folded) return null;
  const known = combined.get(folded);
  if (known) return { keys: [...known.keys], locale: known.locale };
  if (synonyms.has(folded)) return null;
  const pieces = folded
    .split(new RegExp(separators.map(escapeRegExp).join("|")))
    .map((piece) => piece.trim())
    .filter(Boolean);
  if (pieces.length < 2) return null;
  const found = pieces.map((piece) => synonyms.get(piece));
  if (found.some((entry) => !entry)) return null;
  const keys = [...new Set(found.map((entry) => entry!.key))];
  if (keys.length < 2) return null;
  const locale: StarterLocale = found.every((entry) => entry!.locale === "en") ? "en" : "fr";
  return { keys, locale };
}

// Libellé d'un type de départ dans une langue.
export function starterTypeLabel(key: string, locale: StarterLocale): string {
  return starterVendorTypes(locale).find((type) => type.key === key)?.label ?? key;
}

// À l'import : les libellés des métiers d'une valeur du fichier (ceux du catalogue, dans la langue de
// la valeur), ou la valeur elle-même si elle ne désigne qu'un type.
export function vendorTypeLabels(label: string): string[] {
  const parts = combinedTypeParts(label);
  if (!parts) return [label];
  return parts.keys.map((key) => starterTypeLabel(key, parts.locale));
}

export type SplitTypeInput = { id: string; label: string; familyId: string | null; starterKey: string | null; vendorCount: number };

export type SplitStep = {
  typeId: string;
  label: string;
  vendorCount: number;
  // Premier métier : fusion dans un type existant, ou le type combiné renommé (et rattaché au type de départ).
  first: { action: "merge"; into: { id: string; label: string } } | { action: "rename"; key: string; to: string };
  // Métiers suivants : type existant, ou à créer (existing nul) depuis le type de départ.
  others: { key: string; label: string; existing: { id: string; label: string } | null }[];
  // Lot 65e : deux métiers aboutiraient au même type : l'étape est signalée, jamais appliquée.
  conflict: boolean;
};

// Type de l'organisation qui porte un métier de départ : par sa clé, sinon par ses synonymes ; jamais un
// type combiné lui-même. Lot 65e : un rattachement n'est pas suivi quand le libellé du type est le
// synonyme d'un autre métier (« Maquillage » rattaché par erreur à la coiffure reste le maquillage).
function typeForKey(key: string, types: SplitTypeInput[], combinedIds: Set<string>): SplitTypeInput | null {
  const { synonyms } = loadDictionary();
  const candidates = types.filter((type) => !combinedIds.has(type.id));
  const labelKey = (type: SplitTypeInput) => synonyms.get(foldTypeLabel(type.label))?.key;
  return (
    candidates.find((type) => type.starterKey === key && (labelKey(type) === undefined || labelKey(type) === key)) ??
    candidates.find((type) => labelKey(type) === key) ??
    null
  );
}

// Lot 65e — garde-fou : chaque métier doit aboutir à un type distinct (le type combiné renommé tient la
// place du premier métier ; un métier à créer est distinct par sa clé).
export function splitTargetsCollide(firstTypeId: string, others: { key: string; existing: { id: string } | null }[]): boolean {
  const ids = [firstTypeId, ...others.map((part) => part.existing?.id ?? `new:${part.key}`)];
  return new Set(ids).size !== ids.length;
}

export function planTypeSplit(types: SplitTypeInput[], locale: StarterLocale): SplitStep[] {
  const combined = types.flatMap((type) => {
    const parts = combinedTypeParts(type.label);
    return parts ? [{ type, keys: parts.keys }] : [];
  });
  const combinedIds = new Set(combined.map((entry) => entry.type.id));
  return combined.map(({ type, keys }) => {
    const [firstKey, ...otherKeys] = keys as [string, ...string[]];
    const target = typeForKey(firstKey, types, combinedIds);
    const others = otherKeys.map((key) => {
      const existing = typeForKey(key, types, combinedIds);
      return { key, label: existing?.label ?? starterTypeLabel(key, locale), existing: existing ? { id: existing.id, label: existing.label } : null };
    });
    return {
      typeId: type.id,
      label: type.label,
      vendorCount: type.vendorCount,
      first: target ? { action: "merge", into: { id: target.id, label: target.label } } : { action: "rename", key: firstKey, to: starterTypeLabel(firstKey, locale) },
      others,
      conflict: splitTargetsCollide(target?.id ?? type.id, others),
    };
  });
}
