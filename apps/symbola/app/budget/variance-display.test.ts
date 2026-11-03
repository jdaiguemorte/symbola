import { describe, expect, it } from "vitest";
import { varianceDisplay } from "./variance-display";

describe("BUD-02/04 — Affichage de l'écart", () => {
  it("dépassement en rouge, économie en vert, toujours avec un libellé", () => {
    expect(varianceDisplay(50000)).toEqual({ labelKey: "varianceOver", amountCents: 50000, className: "text-overdue" });
    expect(varianceDisplay(-2000)).toEqual({ labelKey: "varianceUnder", amountCents: 2000, className: "text-paid" });
    expect(varianceDisplay(0)).toEqual({ labelKey: "varianceEqual", amountCents: null, className: undefined });
    expect(varianceDisplay(null)).toEqual({ labelKey: "varianceUnset", amountCents: null, className: undefined });
  });
});
