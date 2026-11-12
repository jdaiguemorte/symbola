// Lot 29a (ARC-09, décision D7) — icône de l'onglet (32 px). Les icônes de l'application
// installée (192 et 512 px, « maskable ») sont servies par app/icons/[name]/route.ts et
// listées par le manifeste (manifest.ts).
import { brandIcon } from "./brand-icon";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return brandIcon(32, 1, null);
}
