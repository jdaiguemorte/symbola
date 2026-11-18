// Lot 44 (CRM-02 ; D9, D11) — règles pures du pipeline : nom d'une étape, cartes (étape par défaut,
// date prise, ancienneté) et ordre dans une colonne.
import { describe, expect, it } from "vitest";
import { buildCards, cleanStageLabel, PipelineStageInvalidError, sortCards } from "./pipeline-rules";
import type { CardRow } from "./prospects-repository";

const FIRST = "00000000-0000-4000-8000-000000000001";
const SECOND = "00000000-0000-4000-8000-000000000002";

function row(id: string, overrides: Partial<CardRow["event"]> = {}, extra: Partial<Omit<CardRow, "event">> = {}): CardRow {
  return {
    event: { id, eventDate: null, pipelineStageId: null, guestsEstimated: null, wantedBudgetCents: null, isDemo: false, createdAt: new Date("2026-11-01T10:00:00Z"), updatedAt: new Date("2026-11-02T10:00:00Z"), ...overrides } as CardRow["event"],
    request: null,
    sourceLabel: null,
    stageSince: null,
    ...extra,
  };
}

describe("CRM-02 (D9) — Nom d'une étape", () => {
  it("espaces réduits ; vide ou plus de 60 caractères : refusé", () => {
    expect(cleanStageLabel("  Visite   du lieu ")).toBe("Visite du lieu");
    expect(() => cleanStageLabel("   ")).toThrow(PipelineStageInvalidError);
    expect(() => cleanStageLabel("x".repeat(61))).toThrow(PipelineStageInvalidError);
  });
});

describe("CRM-02 — Cartes du pipeline", () => {
  const stageIds = new Set([FIRST, SECOND]);

  it("une option sans étape, ou dont l'étape a disparu, est à la première ; la date prise par un autre évènement est signalée", () => {
    const cards = buildCards(
      [
        row("a", { eventDate: "2027-06-12" }),
        row("b", { pipelineStageId: SECOND, eventDate: "2027-07-01", guestsEstimated: 90, wantedBudgetCents: 100 }, { request: { period: "été", budgetRange: null, receivedAt: new Date() }, sourceLabel: "Salon", stageSince: new Date("2026-11-05T09:00:00Z") }),
        row("c", { pipelineStageId: "00000000-0000-4000-8000-00000000dead", eventDate: "2027-06-12", isDemo: true }),
      ],
      { firstStageId: FIRST, stageIds, names: new Map([["a", "Léa"]]), busy: [{ eventId: "a", eventDate: "2027-06-12" }, { eventId: "z", eventDate: "2027-06-12" }] },
    );
    expect(cards.map((card) => [card.eventId, card.stageId, card.dateTaken])).toEqual([
      ["a", FIRST, true],
      ["b", SECOND, false],
      ["c", FIRST, false],
    ]);
    expect(cards[0]).toMatchObject({ names: "Léa", stageSince: "2026-11-01T10:00:00.000Z", period: null });
    expect(cards[1]).toMatchObject({ names: "", period: "été", sourceLabel: "Salon", guestsEstimated: 90, wantedBudgetCents: 100, stageSince: "2026-11-05T09:00:00.000Z" });
  });

  it("D11 — la plus ancienne activité en haut, ordre stable à égalité", () => {
    const cards = buildCards(
      [row("b", { updatedAt: new Date("2026-11-03T00:00:00Z") }), row("c", { updatedAt: new Date("2026-11-01T00:00:00Z") }), row("a", { updatedAt: new Date("2026-11-03T00:00:00Z") })],
      { firstStageId: FIRST, stageIds, names: new Map(), busy: [] },
    );
    expect(sortCards(cards).map((card) => card.eventId)).toEqual(["c", "a", "b"]);
  });
});
