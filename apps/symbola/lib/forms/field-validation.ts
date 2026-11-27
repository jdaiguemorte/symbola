// Lot 70b (UX-10, NFR-16, HUB-19 ; P-18, C-04) — la validation écrite par Symbola, la même à l'écran et
// au serveur. Les schémas Zod des formulaires portent, en guise de message, une clé du domaine de
// traduction « Validation » ; l'écran et le serveur la traduisent chacun dans la langue de l'utilisateur.
// Aucun texte en dur, aucune bulle du navigateur (les formulaires sont en `noValidate`).
import type { z } from "zod";

export type FieldErrorEntry = { field: string; key: string };

// Les erreurs d'un formulaire, une par champ (la première trouvée), dans l'ordre du schéma.
export function fieldErrors(schema: z.ZodType, values: Record<string, string>): FieldErrorEntry[] {
  const result = schema.safeParse(values);
  if (result.success) return [];
  const seen = new Set<string>();
  const entries: FieldErrorEntry[] = [];
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "");
    if (!field || seen.has(field)) continue;
    seen.add(field);
    entries.push({ field, key: issue.message });
  }
  return entries;
}

// Les valeurs texte d'un formulaire (les fichiers ne sont pas validés ici).
export function formValues(data: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of data.entries()) {
    if (typeof value === "string" && !(name in values)) values[name] = value;
  }
  return values;
}

// Côté serveur : les erreurs traduites, champ par champ, à renvoyer à l'écran.
export function translatedFieldErrors(entries: FieldErrorEntry[], translate: (key: string) => string): Record<string, string> {
  return Object.fromEntries(entries.map((entry) => [entry.field, translate(entry.key)]));
}

// Une date au format de l'échange (AAAA-MM-JJ), qui existe au calendrier.
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
