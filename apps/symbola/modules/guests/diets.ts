// Lot 49 (INV-07, RGP-06, RGP-07, DAT-08 ; D7, D8) — règles des régimes et allergies : la liste
// cochée d'une personne est chiffrée au niveau du champ (AES-256-GCM, clé DATA_ENCRYPTION_KEY,
// ADR 0078), rattachée à sa place (organisation, table, colonne, personne) ; les nombres sont
// comptés après déchiffrement, sans nom, et un nombre sous le seuil s'affiche « moins de N »
// (réponse 3 de la DPO : ne pas dévoiler un régime unique dans un petit groupe).
import { openField, sealField, type FieldPlace } from "@symbola/auth";
import type { DietCount } from "@symbola/contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Une ligne de guests.diets par personne : la place est celle de la personne.
export function dietPlace(organizationId: string, guestId: string): FieldPlace {
  return { organizationId, table: "guests.diets", column: "options_sealed", rowId: guestId };
}

export function sealDietOptions(optionIds: string[], place: FieldPlace, key?: Buffer): string {
  const value = JSON.stringify([...new Set(optionIds)].sort());
  return key ? sealField(value, place, key) : sealField(value, place);
}

// Une valeur illisible (altérée, recopiée ailleurs, autre clé) lève FieldUnreadableError.
export function openDietOptions(sealed: string, place: FieldPlace, key?: Buffer): string[] {
  const value = key ? openField(sealed, place, key) : openField(sealed, place);
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && UUID.test(id)).sort() : [];
}

// Nombres par entrée de la liste, dans l'ordre de la liste ; une entrée portée par personne
// n'apparaît pas ; sous le seuil, le nombre est caché (« moins de N »).
export function aggregateDiets(entries: { optionIds: string[] }[], options: { id: string; label: string; kind: "diet" | "allergen" }[], threshold: number): DietCount[] {
  const counts = new Map<string, number>();
  for (const entry of entries) for (const id of new Set(entry.optionIds)) counts.set(id, (counts.get(id) ?? 0) + 1);
  return options.flatMap((option) => {
    const count = counts.get(option.id) ?? 0;
    if (count === 0) return [];
    return [{ optionId: option.id, label: option.label, kind: option.kind, count: count < threshold ? null : count, fewerThan: count < threshold ? threshold : null }];
  });
}
