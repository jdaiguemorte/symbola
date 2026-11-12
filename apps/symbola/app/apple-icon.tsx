// Lot 29a (ARC-09, décision D7) — icône de l'écran d'accueil de l'iPhone (180 px, fond
// plein : iOS n'affiche pas la transparence et arrondit lui-même les angles).
import { brandIcon } from "./brand-icon";
import { BRAND_COLORS } from "./brand-colors";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return brandIcon(180, 0.8, BRAND_COLORS.surface);
}
