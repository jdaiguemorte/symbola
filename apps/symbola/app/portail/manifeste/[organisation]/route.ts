// Lot 55 (POR-11, POR-08 ; ADR 0102) — manifeste du portail installable, aux couleurs et au nom de
// l'organisation, logo en icône. Public (un navigateur le lit sans les cookies de la page) :
// l'organisation est désignée par son identifiant, non devinable ; rien de personnel n'y figure (le
// nom et la couleur de l'entreprise, comme sur ses documents). Un identifiant inconnu reçoit le
// manifeste du portail aux couleurs de Symbola, sans dire s'il existe.
import { getTranslations } from "next-intl/server";
import { BRAND_COLORS } from "@/app/brand-colors";
import { isValidId } from "@/app/events/module-access";
import { portalTheme } from "@/lib/portal/theme";
import { appDatabase } from "@symbola/db/client";
import { getDocumentHeader } from "@/modules/hub/service";
import { getDocumentSettings } from "@/modules/quotes/service";

export async function GET(_request: Request, { params }: { params: Promise<{ organisation: string }> }): Promise<Response> {
  const { organisation } = await params;
  const t = await getTranslations("PortalInstall");
  const header = isValidId(organisation) ? await getDocumentHeader(appDatabase(), organisation).catch(() => null) : null;
  const name = header?.organizationName?.trim() || "Symbola";
  const theme = portalTheme(header ? (await getDocumentSettings(organisation)).color : null);
  const icons = [
    ...(header?.logoKey ? [{ src: `/portail/manifeste/${organisation}/icone`, sizes: "any", type: "image/png", purpose: "any" }] : []),
    { src: "/icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  ];
  const manifest = {
    name: t("manifestName", { organization: name }),
    short_name: name.slice(0, 30),
    description: t("manifestDescription", { organization: name }),
    start_url: "/portail",
    scope: "/portail",
    display: "standalone",
    background_color: BRAND_COLORS.surface,
    theme_color: theme.primary,
    icons,
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600", "X-Robots-Tag": "noindex" } });
}
