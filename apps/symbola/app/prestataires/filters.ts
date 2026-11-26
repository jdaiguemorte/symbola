// Lot 11 (L11-PRE-04 à L11-PRE-06) — filtres du carnet lus dans l'URL (liens
// partageables, retour arrière) : type, étiquette, champs-filtres du type,
// « déjà travaillé avec », texte, centre et rayon. Lot 16 (L16-PRE-14) : famille
// (« famille=<id> », ou « famille=a-classer »), puis type en second rang.
import { parseAmountToCents } from "@symbola/i18n";
import type { FindVendorsInput, VendorFieldFilter, VendorType } from "@/modules/vendors/service";

export type BookQuery = Record<string, string | string[] | undefined>;

export type BookFilters = {
  text: string;
  familyId: string | null;
  unclassified: boolean;
  typeId: string | null;
  tagId: string | null;
  workedWith: boolean;
  // Lot 15 : fiches sans point sur la carte (« à placer »).
  unplaced: boolean;
  // Lot 28c (PRE-01) : évaluation d'au moins tant (« note=4 »).
  minRating: number | null;
  aroundText: string;
  radiusKm: number;
  fieldInputs: Record<string, string>;
  fieldFilters: VendorFieldFilter[];
  eventId: string | null;
  slotId: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const RADIUS_CHOICES = [5, 10, 15, 25, 50, 100] as const;
// Valeur du paramètre « famille » pour les types sans famille et les fiches sans type.
export const UNCLASSIFIED_FAMILY = "a-classer";

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
  const family = one(query, "famille");
  return {
    text: one(query, "q"),
    familyId: UUID.test(family) ? family : null,
    unclassified: family === UNCLASSIFIED_FAMILY,
    typeId,
    tagId: UUID.test(one(query, "etiquette")) ? one(query, "etiquette") : null,
    workedWith: one(query, "deja") === "1",
    unplaced: one(query, "aplacer") === "1",
    minRating: /^[1-5]$/.test(one(query, "note")) ? Number(one(query, "note")) : null,
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
    ...(filters.familyId ? { familyId: filters.familyId } : {}),
    ...(filters.unclassified ? { unclassified: true } : {}),
    ...(filters.typeId ? { typeIds: [filters.typeId] } : {}),
    ...(filters.tagId ? { tagIds: [filters.tagId] } : {}),
    fieldFilters: filters.fieldFilters,
    workedWith: filters.workedWith,
    unplacedOnly: filters.unplaced,
    ...(filters.minRating ? { minRating: filters.minRating } : {}),
    ...(center ? { around: { ...center, radiusKm: filters.radiusKm } } : {}),
  };
}

// Même sélection pour l'export (L11-PRE-11) : la requête courante, telle quelle.
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

// Lot 63a (PRE-01, PRE-11 ; recette du 21/11/2026) — les filtres actifs du carnet, chacun en pastille
// qui se retire seule, et « Effacer les filtres » qui les retire tous. La famille, le type, la vue
// et l'évènement d'origine ne sont pas des filtres de la barre : ils restent.
export const BAR_FILTER_KEYS = ["q", "autour", "rayon", "deja", "note", "aplacer", "etiquette"] as const;

export type ActiveFilter = { key: string; label: string; href: string };

export type ActiveFilterLabels = {
  text: (text: string) => string;
  around: (place: string, km: number) => string;
  workedWith: string;
  rating: (rating: number) => string;
  unplaced: string;
  tag: (tagId: string) => string | null;
  field: (fieldId: string, op: "min" | "max" | "eq", value: string) => string | null;
};

export function activeFilters(path: string, query: BookQuery, filters: BookFilters, labels: ActiveFilterLabels): ActiveFilter[] {
  const without = (...keys: string[]) => `${path}${queryString(query, Object.fromEntries(keys.map((key) => [key, ""])))}`;
  const list: ActiveFilter[] = [];
  if (filters.text) list.push({ key: "q", label: labels.text(filters.text), href: without("q") });
  if (filters.aroundText && !filters.aroundText.startsWith("fiche:")) {
    list.push({ key: "autour", label: labels.around(filters.aroundText, filters.radiusKm), href: without("autour", "rayon") });
  }
  if (filters.workedWith) list.push({ key: "deja", label: labels.workedWith, href: without("deja") });
  if (filters.minRating) list.push({ key: "note", label: labels.rating(filters.minRating), href: without("note") });
  if (filters.unplaced) list.push({ key: "aplacer", label: labels.unplaced, href: without("aplacer") });
  if (filters.tagId) {
    const label = labels.tag(filters.tagId);
    if (label) list.push({ key: "etiquette", label, href: without("etiquette") });
  }
  for (const [key, value] of Object.entries(filters.fieldInputs)) {
    if (!value) continue;
    const match = /^(min|max|eq)_(.+)$/.exec(key);
    if (!match) continue;
    const label = labels.field(match[2]!, match[1] as "min" | "max" | "eq", value);
    if (label) list.push({ key, label, href: without(key) });
  }
  return list;
}

export function clearFiltersHref(path: string, query: BookQuery, filters: BookFilters): string {
  const keys = [...BAR_FILTER_KEYS, ...Object.keys(filters.fieldInputs)];
  return `${path}${queryString(query, Object.fromEntries(keys.map((key) => [key, ""])))}`;
}

// Lot 69 (UX-08, UX-10 ; C-69) : ce que dit la liste quand elle est vide. « Filtres » seulement s'il y a
// des fiches que les filtres écartent ; sinon, c'est le carnet qui est vide.
export type VendorBookEmptyState = "noTypes" | "book" | "filters";
export function vendorBookEmptyState({ total, results, types }: { total: number; results: number; types: number }): VendorBookEmptyState | null {
  if (results > 0) return null;
  if (total > 0) return "filters";
  return types === 0 ? "noTypes" : "book";
}
