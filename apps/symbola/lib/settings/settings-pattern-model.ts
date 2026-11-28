// Lot 74h (D7, G8 ; page 30 des maquettes du lot 68 ; avenant à l'ADR 0120) — le patron d'un écran de
// réglage, sans React : ce que la barre d'enregistrement d'un formulaire lié dit, ce qui compte comme
// changé, s'il faut demander « Quitter sans enregistrer ? », combien de temps « ✓ Enregistré » reste
// affiché à côté d'un réglage isolé. Lu par app/ui/settings-save-bar.tsx et app/ui/saved-indicator.tsx ;
// les vagues 74i et 74j le réemploient tel quel.

// Un formulaire tel que le navigateur l'enverrait : une valeur par nom de champ (une case : « 1 » ou « »).
export type FormValues = Record<string, string>;

// « ✓ Enregistré » à côté d'un réglage isolé : visible quelques secondes, puis effacé (§ 6.8).
export const SAVED_VISIBLE_MS = 4000;

// Des espaces autour d'un texte ne comptent pas comme un changement (même règle que le panneau de tâche).
function same(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").trim() === (b ?? "").trim();
}

// Les champs modifiés, dans l'ordre des libellés : seuls les champs nommés par la barre comptent (les
// champs cachés, les versions, le jeton du formulaire n'en font pas partie).
export function changedFieldNames(baseline: FormValues, current: FormValues, fieldLabels: Record<string, string>): string[] {
  return Object.keys(fieldLabels).filter((name) => !same(baseline[name], current[name]));
}

export type SaveBarState =
  | { kind: "nothing" }
  | { kind: "changed"; count: number; fields: string[] }
  | { kind: "saved"; at: Date }
  | { kind: "nothingToSave" };

// Ce que dit la barre, en mots : « Rien à enregistrer », « 2 modifications à enregistrer : Ville,
// Téléphone », « Enregistré à 10 h 42 ». `pressedWithoutChange` : on a appuyé sur le bouton sans rien
// changer (il n'est jamais grisé, il répond « Rien à enregistrer »).
export function saveBarState(input: { changed: string[]; fieldLabels: Record<string, string>; savedAt: Date | null; pressedWithoutChange: boolean }): SaveBarState {
  if (input.changed.length > 0) return { kind: "changed", count: input.changed.length, fields: input.changed.map((name) => input.fieldLabels[name] ?? name) };
  if (input.pressedWithoutChange) return { kind: "nothingToSave" };
  if (input.savedAt) return { kind: "saved", at: input.savedAt };
  return { kind: "nothing" };
}

// Quitter l'écran : tout de suite s'il n'y a rien de changé, sinon la question (règle M1).
export function leaveDecision(changed: string[]): "leave" | "confirm" {
  return changed.length === 0 ? "leave" : "confirm";
}

// Un lien qui mène ailleurs que sur l'écran lui-même (une ancre de la même page ne quitte pas l'écran).
export function leavesScreen(currentHref: string, targetHref: string): boolean {
  const current = new URL(currentHref);
  const target = new URL(targetHref, currentHref);
  return target.origin !== current.origin || target.pathname !== current.pathname || target.search !== current.search;
}

// « Enregistré à 10 h 42 », heure de Paris (ARC-17).
export function savedTimeLabel(at: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "Europe/Paris" }).format(at);
}
