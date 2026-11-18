// Lot 43 (BUD-06, D8) — parts des payeurs sur une ligne : pourcentage ou montant, totaux exacts au
// centime, le reste aux mariés.
import { describe, expect, it } from "vitest";
import { lineReferenceAmount, splitAmongPayers, validateShares } from "./payers";

const COUPLE = "couple";

describe("BUD-06 — Répartition par payeur, au centime", () => {
  it("sans part, tout revient aux mariés (100 % par défaut)", () => {
    expect(Object.fromEntries(splitAmongPayers(960000, [], COUPLE))).toEqual({ couple: 960000 });
  });

  it("en pourcentage : la moitié du traiteur à la famille de Léa ; la somme des parts égale le total", () => {
    const split = splitAmongPayers(960001, [{ payerId: "famille-lea", percentageBasisPoints: 5000, amountCents: null }], COUPLE);
    expect(split.get("famille-lea")).toBe(480001);
    expect(split.get(COUPLE)).toBe(480000);
    expect([...split.values()].reduce((a, b) => a + b, 0)).toBe(960001);
  });

  it("trois tiers d'un montant impair : arrondis répartis, aucun centime perdu ni créé", () => {
    const shares = [
      { payerId: "a", percentageBasisPoints: 3333, amountCents: null },
      { payerId: "b", percentageBasisPoints: 3333, amountCents: null },
      { payerId: "c", percentageBasisPoints: 3334, amountCents: null },
    ];
    const split = splitAmongPayers(100, shares, COUPLE);
    expect([...split.values()].reduce((a, b) => a + b, 0)).toBe(100);
    expect(split.get(COUPLE) ?? 0).toBe(0);
  });

  it("en montant : l'entreprise prend 1 500 €, le reste aux mariés ; les montants passent avant les pourcentages", () => {
    const split = splitAmongPayers(500000, [
      { payerId: "entreprise", percentageBasisPoints: null, amountCents: 150000 },
      { payerId: "famille-maxime", percentageBasisPoints: 5000, amountCents: null },
    ], COUPLE);
    expect(split.get("entreprise")).toBe(150000);
    expect(split.get("famille-maxime")).toBe(175000);
    expect(split.get(COUPLE)).toBe(175000);
  });

  it("un montant qui dépasse la ligne (après une baisse de l'engagé) est plafonné au total", () => {
    const split = splitAmongPayers(100000, [{ payerId: "entreprise", percentageBasisPoints: null, amountCents: 150000 }], COUPLE);
    expect(split.get("entreprise")).toBe(100000);
    expect(split.get(COUPLE) ?? 0).toBe(0);
  });

  it("le montant de référence d'une ligne est l'engagé, sinon le devisé, sinon le prévu", () => {
    expect(lineReferenceAmount({ committedAmountCents: 10, quotedAmountCents: 20, estimatedAmountCents: 30 })).toBe(10);
    expect(lineReferenceAmount({ committedAmountCents: null, quotedAmountCents: 20, estimatedAmountCents: 30 })).toBe(20);
    expect(lineReferenceAmount({ committedAmountCents: null, quotedAmountCents: null, estimatedAmountCents: null })).toBe(0);
  });
});

describe("BUD-06 — Contrôle des parts saisies", () => {
  it("refuse plus de 100 % au total, un pourcentage nul, et un même payeur deux fois", () => {
    expect(validateShares([{ payerId: "a", percentageBasisPoints: 6000, amountCents: null }, { payerId: "b", percentageBasisPoints: 5000, amountCents: null }])).toBe("over_100");
    expect(validateShares([{ payerId: "a", percentageBasisPoints: 0, amountCents: null }])).toBe("invalid");
    expect(validateShares([{ payerId: "a", percentageBasisPoints: 1000, amountCents: null }, { payerId: "a", percentageBasisPoints: null, amountCents: 100 }])).toBe("duplicate");
    expect(validateShares([{ payerId: "a", percentageBasisPoints: 5000, amountCents: null }, { payerId: "b", percentageBasisPoints: null, amountCents: 150000 }])).toBeNull();
  });
});
