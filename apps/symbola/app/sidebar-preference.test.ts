import { describe, expect, it } from "vitest";
import { SIDEBAR_COLLAPSED_COOKIE, isSidebarCollapsed, sidebarCollapsedCookie } from "./sidebar-preference";

describe("Lot 65f — menu latéral réductible : préférence de l'appareil", () => {
  it("le menu est ouvert par défaut, sans cookie ou avec une valeur inconnue", () => {
    expect(isSidebarCollapsed(undefined)).toBe(false);
    expect(isSidebarCollapsed("")).toBe(false);
    expect(isSidebarCollapsed("0")).toBe(false);
    expect(isSidebarCollapsed("true")).toBe(false);
  });

  it("le menu est réduit quand le cookie vaut 1", () => {
    expect(isSidebarCollapsed("1")).toBe(true);
  });

  it("le cookie écrit se relit dans le même état, pour tout le site et un an", () => {
    for (const collapsed of [true, false]) {
      const cookie = sidebarCollapsedCookie(collapsed);
      const [pair, ...attributes] = cookie.split("; ");
      const [name, value] = pair!.split("=");
      expect(name).toBe(SIDEBAR_COLLAPSED_COOKIE);
      expect(isSidebarCollapsed(value)).toBe(collapsed);
      expect(attributes).toEqual(["path=/", "max-age=31536000", "samesite=lax"]);
    }
  });
});
