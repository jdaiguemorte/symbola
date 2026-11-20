// Écrans de réglage regroupés sous « Paramètres » (maquette validée) : le
// menu principal ne garde que le métier ; chaque module y range ses listes
// et modèles, atteints aussi par la roue crantée de ses écrans.
// Lot 61 : la liste vient du menu des Paramètres lui-même (settings-menu.ts).
// Tenue à part, elle avait oublié six rubriques (modèles de devis, de contrat,
// de proposition et d'évènement, relances, exports comptables), qui
// s'ouvraient sans le menu des réglages, sous « Devis et factures » ou
// « Événements ».
import { SETTINGS_MENU_HREFS } from "./settings-menu";

export const SETTINGS_PATHS: readonly string[] = SETTINGS_MENU_HREFS;

// Lot 16 (IMP-11, décision E) : l'assistant d'import s'ouvre en plein écran,
// sans le menu des rubriques ; son point d'entrée reste Paramètres › Importer.
export function isImportAssistantPath(pathname: string): boolean {
  return pathname.startsWith("/import/");
}

export function isSettingsPath(pathname: string): boolean {
  if (isImportAssistantPath(pathname)) return false;
  return SETTINGS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
