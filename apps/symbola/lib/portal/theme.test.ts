import { describe, expect, it } from "vitest";
import { BRAND_COLORS } from "@/app/brand-colors";
import { PORTAL_MIN_CONTRAST, portalContrasts, portalTheme, portalThemeCss } from "./theme";

describe("POR-08 — Portail aux couleurs de la planner, contraste corrigé (lot 55, UX-14)", () => {
  it("reprend la couleur des documents quand elle est déjà lisible", () => {
    const theme = portalTheme("#7a1f3d");
    expect(theme).toMatchObject({ primary: "#7a1f3d", onPrimary: "#ffffff", custom: true });
  });

  it("assombrit une couleur trop claire jusqu'à 4,5:1 sur le blanc, et le texte posé dessus garde le seuil", () => {
    for (const color of ["#ffd1dc", "#f5e6c8", "#ffff00", "#9ad0ec", "#ffffff"]) {
      const theme = portalTheme(color);
      const contrasts = portalContrasts(theme);
      expect(theme.primary, color).not.toBe(color);
      expect(contrasts.onWhite, color).toBeGreaterThanOrEqual(PORTAL_MIN_CONTRAST);
      expect(contrasts.onPrimary, color).toBeGreaterThanOrEqual(PORTAL_MIN_CONTRAST);
      expect(contrasts.onTint, color).toBeGreaterThanOrEqual(PORTAL_MIN_CONTRAST);
      expect(contrasts.primaryOnTint, color).toBeGreaterThanOrEqual(PORTAL_MIN_CONTRAST);
    }
  });

  it("sans couleur réglée (ou valeur invalide), les couleurs de Symbola", () => {
    expect(portalTheme(null)).toMatchObject({ primary: BRAND_COLORS.primary.toLowerCase(), custom: false });
    expect(portalTheme("rouge; } body { display:none")).toMatchObject({ primary: BRAND_COLORS.primary.toLowerCase(), custom: false });
  });

  it("n'écrit dans la feuille de style que des couleurs #rrggbb", () => {
    const css = portalThemeCss({ primary: "#123456", onPrimary: "#ffffff", tint: "red;}*{x:y", custom: true });
    expect(css).toBe(".link-shell{--portal-primary:#123456;--portal-on-primary:#ffffff;--portal-tint:#000000;}");
  });
});
