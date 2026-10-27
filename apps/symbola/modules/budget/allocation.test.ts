import { describe, expect, it } from "vitest";
import {
  allocateFromModel,
  computeVariance,
  costPerGuestCents,
  isModelTotalValid,
  remainingToAllocateCents,
  sumAmountCents,
  sumBasisPoints,
} from "./allocation";

describe("BUD-01 — Validité du total d'un modèle de répartition", () => {
  it("accepte un modèle dont le total fait exactement 100 % (10000 points de base)", () => {
    expect(isModelTotalValid([{ percentageBasisPoints: 6000 }, { percentageBasisPoints: 4000 }])).toBe(true);
  });

  it("refuse un modèle dont le total ne fait pas 100 %", () => {
    expect(isModelTotalValid([{ percentageBasisPoints: 6000 }, { percentageBasisPoints: 3000 }])).toBe(false);
    expect(sumBasisPoints([{ percentageBasisPoints: 6000 }, { percentageBasisPoints: 3000 }])).toBe(9000);
  });

  it("un modèle vide n'est pas valide (total à 0)", () => {
    expect(isModelTotalValid([])).toBe(false);
  });
});

describe("BUD-01 — Répartition d'un montant total par poste", () => {
  it("répartit exactement selon les pourcentages quand la division tombe juste", () => {
    const items = allocateFromModel(100000, [
      { defaultVendorSlotId: "a", percentageBasisPoints: 6000 },
      { defaultVendorSlotId: "b", percentageBasisPoints: 4000 },
    ]);
    expect(items).toEqual([
      { defaultVendorSlotId: "a", amountCents: 60000 },
      { defaultVendorSlotId: "b", amountCents: 40000 },
    ]);
  });

  it("n'arrondit jamais au détriment du total : le reliquat va au dernier poste", () => {
    const items = allocateFromModel(10000, [
      { defaultVendorSlotId: "a", percentageBasisPoints: 3334 },
      { defaultVendorSlotId: "b", percentageBasisPoints: 3333 },
      { defaultVendorSlotId: "c", percentageBasisPoints: 3333 },
    ]);
    expect(sumAmountCents(items)).toBe(10000);
  });

  it("une liste de postes vide renvoie une liste vide", () => {
    expect(allocateFromModel(100000, [])).toEqual([]);
  });
});

describe("BUD-01 — Reste à répartir", () => {
  it("se recalcule après un ajustement manuel d'un poste", () => {
    const items = [
      { defaultVendorSlotId: "a", amountCents: 60000 },
      { defaultVendorSlotId: "b", amountCents: 30000 },
    ];
    expect(remainingToAllocateCents(100000, items)).toBe(10000);
  });

  it("est négatif si les postes dépassent le total (sur-répartition signalée, pas bloquée)", () => {
    const items = [{ defaultVendorSlotId: "a", amountCents: 120000 }];
    expect(remainingToAllocateCents(100000, items)).toBe(-20000);
  });
});

describe("BUD-02 — Écart (réel moins prévu)", () => {
  it("vaut null tant qu'aucun montant réel n'est renseigné", () => {
    expect(computeVariance(100000, null)).toEqual({ varianceCents: null, variancePercent: null });
  });

  it("un dépassement est positif, en centimes et en pourcentage du prévu", () => {
    expect(computeVariance(100000, 120000)).toEqual({ varianceCents: 20000, variancePercent: 20 });
  });

  it("une économie est négative", () => {
    expect(computeVariance(100000, 80000)).toEqual({ varianceCents: -20000, variancePercent: -20 });
  });

  it("vaut exactement 0 quand réel égale prévu", () => {
    expect(computeVariance(100000, 100000)).toEqual({ varianceCents: 0, variancePercent: 0 });
  });

  it("le pourcentage vaut 0 si le prévu est à 0 (jamais de division par zéro affichée)", () => {
    expect(computeVariance(0, 5000)).toEqual({ varianceCents: 5000, variancePercent: 0 });
  });
});

describe("BUD-01 — Coût par invité", () => {
  it("divise le total par le nombre d'invités, arrondi au centime", () => {
    expect(costPerGuestCents(100000, 40)).toBe(2500);
    expect(costPerGuestCents(100001, 3)).toBe(33334);
  });

  it("vaut 0 si le nombre d'invités est 0 (jamais de division par zéro affichée)", () => {
    expect(costPerGuestCents(100000, 0)).toBe(0);
  });
});
