// Lot 63b (HUB-14) — rapprochements vérifiables : la ligne du fichier et la fiche existante côte à
// côte (nom, métier, ville, e-mail, téléphone), chaque valeur qui diffère dite par un texte, pas
// seulement par une couleur. Deux fiches qui n'ont en commun qu'un mot du nom (le prénom,
// « Benjamin » et « Benjamin Dupuy ») sont « À vérifier », et « Ce sont deux prestataires » par
// défaut : jamais une fusion silencieuse. Règles pures.
import { normalizeLabel, textSimilarity } from "@symbola/import-engine";

export type VendorCompareRecord = { name: string | null; type: string | null; city: string | null; email: string | null; phone: string | null };
export type VendorCompareField = keyof VendorCompareRecord;
export type VendorCompareLine = { key: VendorCompareField; file: string | null; existing: string | null; different: boolean };

const FIELDS: VendorCompareField[] = ["name", "type", "city", "email", "phone"];

const normalized = (key: VendorCompareField, value: string): string =>
  key === "phone" ? value.replace(/\D/g, "").replace(/^33/, "0") : key === "email" ? value.trim().toLowerCase() : normalizeLabel(value).join(" ");

export function compareVendorRecords(file: VendorCompareRecord, existing: VendorCompareRecord): VendorCompareLine[] {
  return FIELDS.map((key) => {
    const left = file[key]?.trim() || null;
    const right = existing[key]?.trim() || null;
    // Une valeur absente d'un côté n'est pas une différence : la fiche serait complétée.
    const different = left !== null && right !== null && normalized(key, left) !== normalized(key, right);
    return { key, file: left, existing: right, different };
  });
}

// Un seul mot du nom en commun, et des noms différents : le prénom seul ne fait pas le même prestataire.
export function onlyOneNameInCommon(fileName: string, existingName: string): boolean {
  const left = new Set(normalizeLabel(fileName));
  const right = new Set(normalizeLabel(existingName));
  if (left.size === 0 || right.size === 0) return false;
  const shared = [...left].filter((token) => right.has(token));
  const same = shared.length === left.size && shared.length === right.size;
  return !same && shared.length <= 1;
}

// « À vérifier » : seul un mot du nom est commun, ou le métier et la ville diffèrent tous les deux.
export function vendorMatchNeedsCheck(lines: VendorCompareLine[]): boolean {
  const line = (key: VendorCompareField) => lines.find((entry) => entry.key === key);
  const name = line("name");
  if (name?.file && name.existing && onlyOneNameInCommon(name.file, name.existing)) return true;
  return Boolean(line("type")?.different && line("city")?.different);
}

// Lot 71d (HUB-14, PRE-01 ; spécification du lot 71, § 5.4 ; maquette 08) — le prestataire nommé par une
// ligne de budget face au carnet. Même nom (casse, accents et ponctuation près) : retrouvé, jamais
// doublé. Tous les mots de l'un dans l'autre (« Élodie Beauté », « Élodie Perrot · Beauté »), ou des
// noms très proches : un doublon possible, que la planner tranche. Sinon : pas au carnet.
const POSSIBLE_SIMILARITY = 0.75;

const nameKey = (name: string) => normalizeLabel(name).join(" ");

export type CarnetVendorMatch = { kind: "found"; vendorId: string } | { kind: "possible"; vendorId: string } | { kind: "none" };

export function findCarnetVendor(name: string, carnet: readonly { id: string; name: string }[]): CarnetVendorMatch {
  const key = nameKey(name);
  if (key === "") return { kind: "none" };
  const same = carnet.find((vendor) => nameKey(vendor.name) === key);
  if (same) return { kind: "found", vendorId: same.id };
  const words = new Set(normalizeLabel(name));
  const scored = carnet
    .map((vendor) => {
      const other = new Set(normalizeLabel(vendor.name));
      const [shorter, longer] = words.size <= other.size ? [words, other] : [other, words];
      const contained = shorter.size >= 2 && [...shorter].every((word) => longer.has(word));
      return { id: vendor.id, score: contained ? 1 : textSimilarity(name, vendor.name) };
    })
    .filter((entry) => entry.score >= POSSIBLE_SIMILARITY)
    .sort((a, b) => b.score - a.score);
  // Deux fiches aussi proches l'une que l'autre : aucune n'est proposée d'office.
  if (scored.length === 0 || (scored.length > 1 && scored[0]!.score === scored[1]!.score)) return { kind: "none" };
  return { kind: "possible", vendorId: scored[0]!.id };
}

// « Ce qui les rapproche », en mots : les mots des deux noms (tels qu'écrits au carnet), le même métier,
// la même ville ; et si le téléphone peut être comparé (le budget n'en a pas).
export type VendorLikeness = { sharedWords: string[]; sameType: boolean; sameCity: boolean; phoneComparable: boolean };

export function vendorLikeness(file: VendorCompareRecord, carnet: VendorCompareRecord): VendorLikeness {
  const fileWords = new Set(normalizeLabel(file.name ?? ""));
  const sharedWords = (carnet.name ?? "")
    .split(/[^\p{L}\p{N}'’-]+/u)
    .filter((word) => word !== "" && normalizeLabel(word).length === 1 && fileWords.has(normalizeLabel(word)[0]!));
  const lines = compareVendorRecords(file, carnet);
  const sameAs = (key: VendorCompareField) => {
    const line = lines.find((entry) => entry.key === key);
    return Boolean(line?.file && line.existing && !line.different);
  };
  return { sharedWords, sameType: sameAs("type"), sameCity: sameAs("city"), phoneComparable: Boolean(file.phone && carnet.phone) };
}
