// Lot 16 (L16-HUB-21, ADR 0045) — vocabulaire des clients : les textes « le client »
// (messages/vocabulary/clients.<langue>.json) remplacent ceux du catalogue, qui
// parle des mariés, clé par clé. L'app les choisit selon le type de l'événement
// affiché, sinon selon le métier de l'organisation (apps/symbola/lib/vocabulary.ts).
type Messages = { [key: string]: Messages | string | Messages[] | string[] };

export function withMetierMessages<T extends object>(base: T, overrides: object | null): T {
  if (!overrides) return base;
  const merge = (target: unknown, source: unknown): unknown => {
    // Listes (questions de l'aide) : remplacées élément par élément, par leur rang.
    if (Array.isArray(target) && typeof source === "object" && source !== null) {
      const items = source as Record<string, unknown>;
      return target.map((item, index) => (String(index) in items ? merge(item, items[String(index)]) : item));
    }
    if (typeof target === "object" && target !== null && typeof source === "object" && source !== null) {
      const result: Messages = { ...(target as Messages) };
      for (const [key, value] of Object.entries(source as Messages)) result[key] = key in result ? (merge(result[key], value) as Messages) : value;
      return result;
    }
    return typeof source === "string" ? source : target;
  };
  return merge(base, overrides) as T;
}
