// Lot 43 (GC-01, JUR-07, FAC-08 ; ADR 0087, ADR 0089) — l'écran « Régler l'acompte » selon le canal de
// conclusion (règles du lot 31b) : horloge simulée, cas limites (veille, jour même).
import { describe, expect, it } from "vitest";
import { settlementState } from "./settlement";

const base = { paid: false, declared: false, completedOn: "2027-01-10" as string | null, noPaymentDays: null as number | null, channel: "on_premises" as "on_premises" | "distance" | "off_premises" | null, withdrawalApplies: false };

describe("JUR-07 / GC-01 — Régler l'acompte selon le canal de conclusion", () => {
  it("tant que tous n'ont pas signé, le règlement n'est pas ouvert", () => {
    expect(settlementState({ ...base, completedOn: null }, "2027-01-10")).toEqual({ kind: "awaiting_signatures" });
  });

  it("en établissement : le RIB s'affiche dès la signature", () => {
    expect(settlementState(base, "2027-01-10")).toEqual({ kind: "open", notice: null });
  });

  it("à distance : le RIB s'affiche avec le rappel du délai de rétractation", () => {
    expect(settlementState({ ...base, channel: "distance", withdrawalApplies: true }, "2027-01-10")).toEqual({ kind: "open", notice: "distance" });
  });

  it("hors établissement : ni RIB ni déclaration avant le 8e jour ; la veille, toujours rien ; le jour même, ouvert", () => {
    const offPremises = { ...base, channel: "off_premises" as const, withdrawalApplies: true, noPaymentDays: 7 };
    expect(settlementState(offPremises, "2027-01-10")).toEqual({ kind: "not_before", date: "2027-01-17" });
    expect(settlementState(offPremises, "2027-01-16")).toEqual({ kind: "not_before", date: "2027-01-17" });
    expect(settlementState(offPremises, "2027-01-17")).toEqual({ kind: "open", notice: "off_premises" });
  });

  it("hors établissement sans droit de rétractation (professionnel) : rien n'attend", () => {
    expect(settlementState({ ...base, channel: "off_premises", withdrawalApplies: false, noPaymentDays: null }, "2027-01-10")).toEqual({ kind: "open", notice: null });
  });

  it("déclarée, puis confirmée : l'écran le dit, sans RIB à recopier", () => {
    expect(settlementState({ ...base, declared: true }, "2027-01-11")).toEqual({ kind: "declared" });
    expect(settlementState({ ...base, declared: true, paid: true }, "2027-01-12")).toEqual({ kind: "paid" });
  });

  it("un devis signé seul, sans contrat (canal inconnu) : le RIB s'affiche, comme avant le lot", () => {
    expect(settlementState({ ...base, channel: null }, "2027-01-10")).toEqual({ kind: "open", notice: null });
  });
});
