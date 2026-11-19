// Lot 29a (ARC-09, décision D7) — manifeste de l'application installable : nom, démarrage
// sur l'accueil, affichage autonome, couleurs et icônes de la marque. La description suit la
// langue de la personne (cookie ou compte), d'où une réponse calculée à chaque demande.
// Lot 55 (POR-11) : une route, et non plus la convention app/manifest.ts, que Next.js place en tête
// de chaque page sans qu'une page puisse la remplacer ; le lien vient des métadonnées de app/layout.tsx,
// que le portail remplace par son propre manifeste.
import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BRAND_COLORS } from "../brand-colors";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const t = await getTranslations("Manifest");
  const manifest: MetadataRoute.Manifest = {
    name: "Symbola",
    short_name: "Symbola",
    description: t("description"),
    lang: await getLocale(),
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BRAND_COLORS.surface,
    theme_color: BRAND_COLORS.primary,
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } });
}
