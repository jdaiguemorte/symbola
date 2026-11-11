import { describe, expect, it } from "vitest";
import { deriveSlotStatus, summarizeVendorSlots } from "./service";

describe("PRD-EVT-03 — Barre d'avancement des postes", () => {
  it("compte les postes engagés (un prestataire retenu, au moins) sur les postes requis, sans les postes non requis", () => {
    expect(
      summarizeVendorSlots([
        { status: "retained" },
        { status: "to_find" },
        { status: "not_required" },
        { status: "quote_received" },
        { status: "contract_signed" },
        { status: "paid_off" },
      ]),
    ).toEqual({ booked: 3, required: 5 });
  });

  it("vaut 0 sur 0 pour un événement sans poste", () => {
    expect(summarizeVendorSlots([])).toEqual({ booked: 0, required: 0 });
  });
});

describe("PRE-02 — Statut du poste déduit de ses prestataires (lot 28a, décision D3)", () => {
  it("« À trouver » sans prestataire, ou quand tous sont écartés", () => {
    expect(deriveSlotStatus(false, [])).toBe("to_find");
    expect(deriveSlotStatus(false, ["dismissed", "dismissed"])).toBe("to_find");
  });

  it("le statut le plus avancé de ses prestataires", () => {
    expect(deriveSlotStatus(false, ["shortlisted", "quote_received", "contacted"])).toBe("quote_received");
    expect(deriveSlotStatus(false, ["dismissed", "retained", "quote_received"])).toBe("retained");
    expect(deriveSlotStatus(false, ["contract_signed"])).toBe("contract_signed");
    expect(deriveSlotStatus(false, ["paid_off", "dismissed"])).toBe("paid_off");
  });

  it("« Non requis » l'emporte : c'est une case du poste", () => {
    expect(deriveSlotStatus(true, ["retained"])).toBe("not_required");
    expect(deriveSlotStatus(true, [])).toBe("not_required");
  });
});
