// Lot 5 (IMP-05) — comparaison de valeurs importées, indépendante de l'ordre
// des clés : PostgreSQL range les clés d'un jsonb à sa façon, une valeur
// relue n'a pas forcément le même ordre que la valeur écrite.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value ?? null;
}

export function sameImportValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
