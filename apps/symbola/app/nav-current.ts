// Lien du menu principal « page courante » : l'écran affiché est le sien ou
// l'un de ses sous-écrans. Les écrans de réglage d'un module allument
// « Paramètres », pas le module. Lot 18 : une adresse plus précise qui a son
// propre lien (« Encaissements », /devis/encaissements) n'allume pas le lien
// parent (« Devis et factures », /devis).
import { isSettingsPath } from "./settings-paths";

function under(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function isCurrentNavLink(
  pathname: string,
  href: string,
  options: { settings?: boolean; exact?: boolean; except?: string[] } = {},
): boolean {
  if (options.exact) return pathname === href;
  if (options.settings) return isSettingsPath(pathname);
  if (isSettingsPath(pathname) || !under(pathname, href)) return false;
  return !(options.except ?? []).some((other) => under(pathname, other));
}
