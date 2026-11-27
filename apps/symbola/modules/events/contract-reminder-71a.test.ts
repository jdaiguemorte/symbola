// Lot 71a (HUB-14, HUB-08, C-53 ; décisions I1 et I2 de Julien du 27/11/2026) — un prestataire retenu par
// une reprise, signé, non signé ou non renseigné, ne paraît jamais d'office dans « Contrat de … à faire
// signer » ; il y revient seulement à la date d'une relance que la planner a notée elle-même (lot 65d).
// Un prestataire retenu à la main y paraît (règle d'avant). Règle pure de findUncontractedVendors.
import { describe, expect, it } from "vitest";
import { needsContractReminder } from "./today-rules";

const TODAY = "2026-11-25";
const base = { status: "retained" as const, takeoverContract: null, eventDate: "2027-03-20", eventStatus: "confirmed" as const, isDemo: false, reminderRecallOn: null };

describe("HUB-14 — Un import ne crée ni relance : contrats des prestataires repris (lot 71a)", () => {
  it("retenu par une reprise (signé, non signé, non renseigné) : jamais « à faire signer » d'office", () => {
    for (const takeoverContract of ["signed", "unsigned", "unknown"] as const) {
      expect(needsContractReminder({ ...base, takeoverContract }, TODAY)).toBe(false);
    }
  });

  it("retenu à la main, ensuite : « à faire signer » comme avant", () => {
    expect(needsContractReminder(base, TODAY)).toBe(true);
  });

  it("une relance notée par la planner ramène un prestataire repris non signé le jour de son rappel, pas la veille", () => {
    expect(needsContractReminder({ ...base, takeoverContract: "unsigned", reminderRecallOn: "2026-11-26" }, TODAY)).toBe(false);
    expect(needsContractReminder({ ...base, takeoverContract: "unsigned", reminderRecallOn: "2026-11-25" }, TODAY)).toBe(true);
    expect(needsContractReminder({ ...base, takeoverContract: "unsigned", reminderRecallOn: "2026-11-24" }, TODAY)).toBe(true);
  });

  it("règles d'avant gardées : un essai, un évènement clos ou passé, un contrat signé ne demandent rien ; une relance à venir le retire", () => {
    expect(needsContractReminder({ ...base, isDemo: true }, TODAY)).toBe(false);
    expect(needsContractReminder({ ...base, eventStatus: "closed" }, TODAY)).toBe(false);
    expect(needsContractReminder({ ...base, eventDate: "2026-11-24" }, TODAY)).toBe(false);
    expect(needsContractReminder({ ...base, eventDate: null }, TODAY)).toBe(true);
    expect(needsContractReminder({ ...base, status: "contract_signed" }, TODAY)).toBe(false);
    expect(needsContractReminder({ ...base, reminderRecallOn: "2026-12-01" }, TODAY)).toBe(false);
  });
});
