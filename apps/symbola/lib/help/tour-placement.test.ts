// Lot 74d (C-02 ; page 25 des maquettes du lot 68) — où se pose la bulle d'une visite, et quelles bulles
// sont montrées (absents jusqu'ici).
import { describe, expect, it } from "vitest";
import { placeTourBubble, visibleTourSteps, type Rect } from "@symbola/ui";

const bubble = { width: 360, height: 200 };
const desktop = { width: 1440, height: 900 };
const short = { width: 911, height: 512 };

function overlaps(a: Rect, top: number, left: number) {
  return left < a.left + a.width && left + bubble.width > a.left && top < a.top + a.height && top + bubble.height > a.top;
}

describe("L74-74d — La bulle de la visite", () => {
  it("se place sous la zone quand la place le permet, centrée sur elle", () => {
    const target = { top: 100, left: 500, width: 200, height: 40 };
    expect(placeTourBubble(target, bubble, desktop)).toEqual({ top: 152, left: 420, side: "below" });
  });

  it("à droite si la place manque dessous, sans recouvrir la zone", () => {
    const target = { top: 300, left: 100, width: 300, height: 180 };
    const placement = placeTourBubble(target, bubble, short);
    expect(placement.side).toBe("right");
    expect(overlaps(target, placement.top, placement.left)).toBe(false);
  });

  it("à gauche si la zone touche le bord droit, au-dessus en dernier recours", () => {
    const right = { top: 300, left: 600, width: 300, height: 180 };
    expect(placeTourBubble(right, bubble, short).side).toBe("left");
    const wide = { top: 280, left: 20, width: 870, height: 200 };
    const above = placeTourBubble(wide, bubble, short);
    expect(above.side).toBe("above");
    expect(overlaps(wide, above.top, above.left)).toBe(false);
  });

  it("jamais hors de l'écran ; au centre sans zone", () => {
    const corner = { top: 10, left: 1420, width: 20, height: 20 };
    const placement = placeTourBubble(corner, bubble, desktop);
    expect(placement.left + bubble.width).toBeLessThanOrEqual(desktop.width - 8);
    expect(placement.left).toBeGreaterThanOrEqual(8);
    expect(placeTourBubble(null, bubble, desktop).side).toBe("center");
  });

  it("critère 4 — une bulle dont la zone n'est pas à l'écran est sautée", () => {
    const steps = [{ target: "a" }, { target: "b" }, { target: "c" }, {}];
    expect(visibleTourSteps(steps, (target) => target !== "b")).toEqual([{ target: "a" }, { target: "c" }]);
  });
});
