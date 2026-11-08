// Écrans de réglage regroupés sous « Paramètres » (maquette validée) : le
// menu principal ne garde que le métier ; chaque module y range ses listes
// et modèles, atteints aussi par la roue crantée de ses écrans.
export const SETTINGS_PATHS = [
  "/parametres",
  "/events/parametres",
  "/events/modeles",
  "/events/modeles-programme",
  "/budget/parametres",
  "/prestataires/parametres",
  "/devis/parametres",
  "/devis/catalogue",
  "/devis/e-reporting",
  "/import",
  "/rgpd",
  "/profil",
] as const;

// Lot 16 (IMP-11, décision E) : l'assistant d'import s'ouvre en plein écran,
// sans le menu des rubriques ; son point d'entrée reste Paramètres › Importer.
export function isImportAssistantPath(pathname: string): boolean {
  return pathname.startsWith("/import/");
}

export function isSettingsPath(pathname: string): boolean {
  if (isImportAssistantPath(pathname)) return false;
  return SETTINGS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
