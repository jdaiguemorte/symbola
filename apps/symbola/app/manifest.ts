// Lot 29a (ARC-09, décision D7) — manifeste de l'application installable : nom, démarrage
// sur l'accueil, affichage autonome, couleurs et icônes de la marque. La description suit la
// langue de la personne (cookie ou compte), d'où une réponse calculée à chaque demande.
import type { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BRAND_COLORS } from "./brand-colors";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("Manifest");
  return {
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
}
