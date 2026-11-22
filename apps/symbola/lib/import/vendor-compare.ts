// Lot 63b (HUB-14) — rapprochements vérifiables : la ligne du fichier et la fiche existante côte à
// côte (nom, métier, ville, e-mail, téléphone), chaque valeur qui diffère dite par un texte, pas
// seulement par une couleur. Deux fiches qui n'ont en commun qu'un mot du nom (le prénom,
// « Benjamin » et « Benjamin Dupuy ») sont « À vérifier », et « Ce sont deux prestataires » par
// défaut : jamais une fusion silencieuse. Règles pures.
import { normalizeLabel } from "@symbola/import-engine";

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
