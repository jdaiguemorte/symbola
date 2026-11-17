// Lot 39b (UX-09 ; D8 ; ADR 0074) — enregistrement automatique d'une fiche, champ par champ, sans
// jamais écraser en silence ce qu'une autre personne a enregistré entre-temps. Chaque envoi porte la
// version de la fiche (date de dernière modification) et les valeurs de départ (celles que la
// personne avait sous les yeux). Si la fiche a changé depuis, on fusionne :
// - un champ que la personne n'a pas touché prend la valeur enregistrée entre-temps ;
// - un champ qu'elle a changé, et que l'autre n'a pas touché, prend sa valeur ;
// - un champ changé des deux côtés, différemment, est un conflit : rien n'est écrit, l'écran montre
//   les deux valeurs et la personne choisit.
export type FieldValues = Record<string, string>;

export type MergeResult = { merged: FieldValues; conflicts: string[] };

export function mergeEdits(fields: readonly string[], baseline: FieldValues, mine: FieldValues, stored: FieldValues): MergeResult {
  const merged: FieldValues = {};
  const conflicts: string[] = [];
  for (const field of fields) {
    const base = baseline[field] ?? "";
    const own = mine[field] ?? "";
    const theirs = stored[field] ?? "";
    const changedByMe = own !== base;
    const changedByThem = theirs !== base;
    if (changedByMe && changedByThem && own !== theirs) conflicts.push(field);
    merged[field] = changedByMe ? own : theirs;
  }
  return { merged, conflicts };
}

export function sameValues(fields: readonly string[], left: FieldValues, right: FieldValues): boolean {
  return fields.every((field) => (left[field] ?? "") === (right[field] ?? ""));
}

// Valeurs de départ envoyées par l'écran : un objet de textes, sur les seuls champs de la fiche.
export function parseBaseline(raw: FormDataEntryValue | null, fields: readonly string[]): FieldValues | null {
  if (typeof raw !== "string" || raw.length > 100_000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const values: FieldValues = {};
  for (const field of fields) {
    const value = (parsed as Record<string, unknown>)[field];
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}
