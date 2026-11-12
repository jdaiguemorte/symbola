// Lot 29a (ARC-09, décision D7) — icônes de l'application installée, listées par le
// manifeste (manifest.ts) : 192 et 512 px, et une version « maskable » dont le logo tient
// dans la zone sûre. Publiques, sans aucune donnée.
import { brandIcon } from "@/app/brand-icon";
import { BRAND_COLORS } from "@/app/brand-colors";

const ICONS: Record<string, { size: number; scale: number }> = {
  "192.png": { size: 192, scale: 0.86 },
  "512.png": { size: 512, scale: 0.86 },
  "maskable-512.png": { size: 512, scale: 0.62 },
};

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  const icon = ICONS[(await params).name];
  if (!icon) return new Response(null, { status: 404 });
  const image = brandIcon(icon.size, icon.scale, BRAND_COLORS.surface);
  image.headers.set("Cache-Control", "public, max-age=86400");
  return image;
}
