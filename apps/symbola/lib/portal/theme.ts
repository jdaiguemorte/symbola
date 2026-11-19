// Lot 55 (POR-08, UX-14 ; D4 ; ADR 0101) — couleurs du portail : celles que l'organisation a réglées
// pour ses documents (lot 17), contrôlées. La couleur principale sert aux titres, liens et boutons :
// trop claire, elle est assombrie jusqu'à 4,5:1 sur le blanc (UX-14) ; le texte posé dessus (blanc
// ou encre) garde le même seuil ; la teinte claire sert de fond aux blocs. Fonctions pures.
import { contrastRatio, documentAppearance, DOCUMENT_INK, MIN_TEXT_CONTRAST } from "@/lib/documents/appearance";
import { BRAND_COLORS } from "@/app/brand-colors";

export type PortalTheme = { primary: string; onPrimary: string; tint: string; custom: boolean };

const HEX = /^#[0-9a-f]{6}$/i;

export function portalTheme(color: string | null | undefined): PortalTheme {
  const custom = Boolean(color && HEX.test(color));
  // Même calcul que les documents (ADR 0046) : 4,5:1 sur le blanc et sur la teinte claire.
  const appearance = documentAppearance(custom ? color!.toLowerCase() : null, null, BRAND_COLORS.primary.toLowerCase());
  return { primary: appearance.accent, onPrimary: appearance.onAccent, tint: appearance.tint, custom };
}

// Les deux contrastes que le portail garantit (vérifiés par les tests).
export function portalContrasts(theme: PortalTheme): { onWhite: number; onPrimary: number; onTint: number; primaryOnTint: number } {
  return { onWhite: contrastRatio(theme.primary, "#ffffff"), onPrimary: contrastRatio(theme.primary, theme.onPrimary), onTint: contrastRatio(DOCUMENT_INK, theme.tint), primaryOnTint: contrastRatio(theme.primary, theme.tint) };
}

export const PORTAL_MIN_CONTRAST = MIN_TEXT_CONTRAST;

// Les variables CSS du portail ; les valeurs sont des couleurs vérifiées (#rrggbb), rien d'autre ne
// peut s'y glisser.
export function portalThemeCss(theme: PortalTheme): string {
  const safe = (value: string) => (HEX.test(value) ? value : "#000000");
  return `.link-shell{--portal-primary:${safe(theme.primary)};--portal-on-primary:${safe(theme.onPrimary)};--portal-tint:${safe(theme.tint)};}`;
}
