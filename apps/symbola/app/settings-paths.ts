// Écrans de réglage regroupés sous « Paramètres » (maquette validée) : le
// menu principal ne garde que le métier ; chaque module y range ses listes
// et modèles, atteints aussi par la roue crantée de ses écrans.
export const SETTINGS_PATHS = [
  "/parametres",
  "/events/parametres",
  "/events/modeles",
  "/events/modeles-programme",
  "/budget/parametres",
  "/devis/parametres",
  "/devis/catalogue",
  "/devis/e-reporting",
  "/import",
  "/rgpd",
  "/profil",
] as const;

export function isSettingsPath(pathname: string): boolean {
  return SETTINGS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
