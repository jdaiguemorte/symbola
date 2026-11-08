// Lot 16 (HUB-21) — vocabulaire selon le métier de l'organisation : les textes
// propres à un métier (messages/metier/<métier>.<langue>.json) remplacent ceux
// du catalogue, clé par clé ; une wedding planner garde le catalogue tel quel.
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
