// Lot 27b (POR-03, BUD-07, EVT-09 ; décisions D9 et D10) — règles pures des
// décisions : qui peut répondre, ce qu'une réponse contient, programme modifié.
import { describe, expect, it } from "vitest";
import type { DecisionSnapshot, EventLinkRights } from "@symbola/contracts";
import { answerProblem, decisionOpenTo, programChangedSince } from "./decisions";

const SLOT_CATERER = "7ec37e00-0000-4000-8000-0000000000c1";
const SLOT_VENUE = "7ec37e00-0000-4000-8000-0000000000c2";
const rights = (value: Partial<EventLinkRights>): EventLinkRights => ({ rubrics: [], budgetScope: "all", sharedSlotIds: [], ...value });
const client = (value: Partial<EventLinkRights>) => ({ audience: "client" as const, rights: rights(value) });
const option: DecisionSnapshot = { kind: "option", slotLabel: "Traiteur", options: [{ candidateId: "a", vendorName: "Maison Haddad", quoteAmountCents: 960000 }, { candidateId: "b", vendorName: "Saveurs du Sud", quoteAmountCents: null }] };

describe("POR-03, D10 — Qui répond à une décision", () => {
  it("la rubrique concernée l'ouvre : Options, Programme, Budget (avec la catégorie pour un payeur)", () => {
    expect(decisionOpenTo({ kind: "option", slotId: SLOT_CATERER }, client({ rubrics: ["vendor_options"] }))).toBe(true);
    expect(decisionOpenTo({ kind: "option", slotId: SLOT_CATERER }, client({ rubrics: ["budget"] }))).toBe(false);
    expect(decisionOpenTo({ kind: "program", slotId: null }, client({ rubrics: ["program"] }))).toBe(true);
    expect(decisionOpenTo({ kind: "expense", slotId: SLOT_CATERER }, client({ rubrics: ["budget"] }))).toBe(true);
    expect(decisionOpenTo({ kind: "expense", slotId: SLOT_CATERER }, client({ rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [SLOT_CATERER] }))).toBe(true);
    expect(decisionOpenTo({ kind: "expense", slotId: SLOT_VENUE }, client({ rubrics: ["budget"], budgetScope: "selected", sharedSlotIds: [SLOT_CATERER] }))).toBe(false);
  });

  it("jamais le lien d'un prestataire", () => {
    expect(decisionOpenTo({ kind: "program", slotId: null }, { audience: "vendor", rights: rights({ rubrics: ["program"] }) })).toBe(false);
  });
});

describe("BUD-07, EVT-09 — Ce qu'une réponse contient", () => {
  it("une option se choisit parmi celles figées à la demande ; « aucune ne me convient » sans choix", () => {
    expect(answerProblem(option, { answer: "approved", choiceId: "a", comment: null })).toBeNull();
    expect(answerProblem(option, { answer: "approved", choiceId: "z", comment: null })).toBe("choice");
    expect(answerProblem(option, { answer: "approved", choiceId: null, comment: null })).toBe("choice");
    expect(answerProblem(option, { answer: "declined", choiceId: null, comment: "Trop cher" })).toBeNull();
    expect(answerProblem(option, { answer: "declined", choiceId: "a", comment: null })).toBe("choice");
  });

  it("une dépense ou le programme se valide sans choix ; commentaire de 500 caractères au plus", () => {
    const expense: DecisionSnapshot = { kind: "expense", slotLabel: "Traiteur", label: "Acompte", vendorName: null, amountCents: 288000 };
    expect(answerProblem(expense, { answer: "approved", choiceId: null, comment: "x".repeat(500) })).toBeNull();
    expect(answerProblem(expense, { answer: "approved", choiceId: null, comment: "x".repeat(501) })).toBe("comment");
    expect(answerProblem(expense, { answer: "approved", choiceId: "a", comment: null })).toBe("choice");
  });

  it("le programme approuvé est signalé dès qu'il change", () => {
    const program: DecisionSnapshot = { kind: "program", programUpdatedAt: "2027-03-03T10:00:00.000Z", itemCount: 8 };
    expect(programChangedSince(program, "2027-03-03T10:00:00.000Z")).toBe(false);
    expect(programChangedSince(program, "2027-03-05T09:00:00.000Z")).toBe(true);
    expect(programChangedSince(option, "2027-03-05T09:00:00.000Z")).toBe(false);
  });
});
