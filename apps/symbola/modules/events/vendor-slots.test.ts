import { describe, expect, it } from "vitest";
import { summarizeVendorSlots } from "./service";

describe("EVT-03 — Barre d'avancement des postes", () => {
  it("compte les postes réservés sur les postes requis, sans les postes non requis", () => {
    expect(
      summarizeVendorSlots([
        { status: "booked" },
        { status: "to_find" },
        { status: "not_required" },
        { status: "quote_received" },
        { status: "booked" },
      ]),
    ).toEqual({ booked: 2, required: 4 });
  });

  it("vaut 0 sur 0 pour un événement sans poste", () => {
    expect(summarizeVendorSlots([])).toEqual({ booked: 0, required: 0 });
  });
});
