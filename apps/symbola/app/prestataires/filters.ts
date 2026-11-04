// Lot 11 (PRE-04 à PRE-06) — filtres du carnet lus dans l'URL (liens
// partageables, retour arrière) : type, étiquette, champs-filtres du type,
// « déjà travaillé avec », texte, centre et rayon.
import { parseAmountToCents } from "@symbola/i18n";
import type { FindVendorsInput, VendorFieldFilter, VendorType } from "@/modules/vendors/service";

export type BookQuery = Record<string, string | string[] | undefined>;

export type BookFilters = {
  text: string;
  typeId: string | null;
  tagId: string | null;
  workedWith: boolean;
  aroundText: string;
  radiusKm: number;
  fieldInputs: Record<string, string>;
  fieldFilters: VendorFieldFilter[];
  eventId: string | null;
  slotId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const RADIUS_CHOICES = [5, 10, 15, 25, 50, 100] as const;

function one(query: BookQuery, key: string): string {
  const value = query[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseBookFilters(query: BookQuery, types: VendorType[]): BookFilters {
  const typeId = UUID.test(one(query, "type")) ? one(query, "type") : null;
  const radius = Number(one(query, "rayon"));
  const type = types.find((candidate) => candidate.id === typeId);
  const fieldInputs: Record<string, string> = {};
  const fieldFilters: VendorFieldFilter[] = [];
  for (const field of type?.fields.filter((candidate) => candidate.isFilter) ?? []) {
    for (const op of ["min", "max", "eq"] as const) {
      const raw = one(query, `${op}_${field.id}`);
      if (!raw) continue;
      fieldInputs[`${op}_${field.id}`] = raw;
      const filterOp = op === "min" ? "gte" : op === "max" ? "lte" : "eq";
      let value: string | number | boolean | null = raw;
      if (field.kind === "number") value = Number(raw.replace(",", "."));
      if (field.kind === "amount") value = parseAmountToCents(raw) ?? null;
      if (field.kind === "boolean") value = raw === "oui";
      if (value === null || (typeof value === "number" && !Number.isFinite(value))) continue;
      fieldFilters.push({ fieldId: field.id, op: filterOp, value });
    }
  }
  return {
    text: one(query, "q"),
    typeId,
    tagId: UUID.test(one(query, "etiquette")) ? one(query, "etiquette") : null,
    workedWith: one(query, "deja") === "1",
    aroundText: one(query, "autour"),
    radiusKm: RADIUS_CHOICES.includes(radius as (typeof RADIUS_CHOICES)[number]) ? radius : 15,
    fieldInputs,
    fieldFilters,
    eventId: UUID.test(one(query, "evenement")) ? one(query, "evenement") : null,
    slotId: UUID.test(one(query, "poste")) ? one(query, "poste") : null,
  };
}

export function toFindInput(
  organizationId: string,
  filters: BookFilters,
  center: { latitude: number; longitude: number } | null,
): FindVendorsInput {
  return {
    organizationId,
    ...(filters.text ? { text: filters.text } : {}),
    ...(filters.typeId ? { typeIds: [filters.typeId] } : {}),
    ...(filters.tagId ? { tagIds: [filters.tagId] } : {}),
    fieldFilters: filters.fieldFilters,
    workedWith: filters.workedWith,
    ...(center ? { around: { ...center, radiusKm: filters.radiusKm } } : {}),
  };
}

// Même sélection pour l'export (PRE-11) : la requête courante, telle quelle.
export function queryString(query: BookQuery, overrides: Record<string, string | null> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first && !(key in overrides)) params.set(key, first);
  }
  for (const [key, value] of Object.entries(overrides)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : "";
}
