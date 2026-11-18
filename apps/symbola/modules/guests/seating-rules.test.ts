// Lot 50 — règles pures du plan de table (INV-05 ; D1 à D5) : qui se place, type de repas par
// défaut, noms des tables ajoutées en série, alertes signalées sans jamais bloquer.
import { describe, expect, it } from "vitest";
import { defaultMealTypeKey, resolveMealType, seatEligibility, seatingAlerts, seriesNames } from "./seating-rules";

describe("INV-05 — Qui se place à un temps fort", () => {
  it("présent : placé ; sans réponse : placé à part, marqué « en attente » ; décliné ou non invité : absent", () => {
    expect(seatEligibility({ invited: true, attending: true })).toBe("present");
    expect(seatEligibility({ invited: true, attending: undefined })).toBe("pending");
    expect(seatEligibility({ invited: true, attending: false })).toBeNull();
    expect(seatEligibility({ invited: false, attending: true })).toBeNull();
  });
});

describe("INV-05 — Tables ajoutées en série (« 12 tables rondes de 10 »)", () => {
  it("numérote à la suite des tables déjà nommées ainsi, sans doublon", () => {
    expect(seriesNames([], 3, "Table")).toEqual(["Table 1", "Table 2", "Table 3"]);
    expect(seriesNames(["Table 1", "Table 2", "Honneur", "table 7"], 2, "Table")).toEqual(["Table 8", "Table 9"]);
    expect(seriesNames(["Table 12"], 1, "Table")).toEqual(["Table 13"]);
  });

  it("un préfixe vide ou des caractères spéciaux ne cassent rien", () => {
    expect(seriesNames(["T (1)"], 1, "T (1)")).toEqual(["T (1) 1"]);
  });
});

describe("INV-05 — Contraintes « ensemble » et « séparés », capacité : signalées, jamais bloquantes (D4)", () => {
  const tables = [
    { id: "t1", name: "Table 1", capacity: 2 },
    { id: "t2", name: "Table 2", capacity: 10 },
  ];
  const names = new Map([
    ["a", "Alice"],
    ["b", "Bruno"],
    ["c", "Chloé"],
    ["d", "David"],
  ]);

  it("« ensemble » tenu quand tous les placés sont à la même table ; signalé dès qu'ils sont à deux tables", () => {
    const constraints = [{ id: "k1", kind: "together" as const, guestIds: ["a", "b", "c"] }];
    expect(seatingAlerts({ tables, seats: [{ guestId: "a", tableId: "t2" }, { guestId: "b", tableId: "t2" }], constraints, names })).toEqual([]);
    const alerts = seatingAlerts({ tables, seats: [{ guestId: "a", tableId: "t2" }, { guestId: "b", tableId: "t1" }], constraints, names });
    expect(alerts).toEqual([{ kind: "together", constraintId: "k1", tableIds: ["t1", "t2"], guestNames: ["Alice", "Bruno", "Chloé"] }]);
  });

  it("« séparés » signalé sur la table qui réunit deux de ses membres", () => {
    const constraints = [{ id: "k2", kind: "apart" as const, guestIds: ["c", "d"] }];
    expect(seatingAlerts({ tables, seats: [{ guestId: "c", tableId: "t1" }, { guestId: "d", tableId: "t2" }], constraints, names })).toEqual([]);
    expect(seatingAlerts({ tables, seats: [{ guestId: "c", tableId: "t2" }, { guestId: "d", tableId: "t2" }], constraints, names })).toEqual([
      { kind: "apart", constraintId: "k2", tableId: "t2", guestNames: ["Chloé", "David"] },
    ]);
  });

  it("une table au-delà de sa capacité est signalée, pas refusée (une chaise de plus se trouve toujours)", () => {
    const seats = ["a", "b", "c"].map((guestId) => ({ guestId, tableId: "t1" }));
    expect(seatingAlerts({ tables, seats, constraints: [], names })).toEqual([{ kind: "capacity", tableId: "t1", occupied: 3, capacity: 2 }]);
  });
});

describe("INV-06 — Type de repas par défaut, tiré de l'âge (D5)", () => {
  const types = [
    { id: "m-adult", starterKey: "adult" },
    { id: "m-child", starterKey: "child" },
    { id: "m-baby", starterKey: "baby" },
    { id: "m-teen", starterKey: null },
  ];

  it("adulte → Adulte ; enfant → Enfant ; tranche 0-2 ans → Bébé", () => {
    expect(defaultMealTypeKey({ kind: "adult", ageRange: null })).toBe("adult");
    expect(defaultMealTypeKey({ kind: "child", ageRange: "3-5" })).toBe("child");
    expect(defaultMealTypeKey({ kind: "child", ageRange: "0-2" })).toBe("baby");
    expect(defaultMealTypeKey({ kind: "child", ageRange: null })).toBe("child");
  });

  it("le type choisi par la planner l'emporte (adolescent servi en adulte) ; un type disparu revient à la valeur par défaut", () => {
    expect(resolveMealType({ kind: "child", ageRange: "12-17", mealTypeId: "m-adult" }, types)).toEqual({ id: "m-adult", chosen: true });
    expect(resolveMealType({ kind: "child", ageRange: "0-2", mealTypeId: null }, types)).toEqual({ id: "m-baby", chosen: false });
    expect(resolveMealType({ kind: "adult", ageRange: null, mealTypeId: "m-inconnu" }, types)).toEqual({ id: "m-adult", chosen: false });
  });
});
