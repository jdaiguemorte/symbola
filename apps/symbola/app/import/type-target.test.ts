// Lot 16 (IMP-12) — lecture des choix de l'étape « Types » : seules les valeurs
// prévues passent, les autres sont refusées.
import { describe, expect, it } from "vitest";
import { parseTypeTarget, typeTargetValue } from "./type-target";

const ID = "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a";

describe("IMP-12 — Choix du type d'un libellé importé", () => {
  it("lit chaque sorte de choix et la réécrit à l'identique", () => {
    for (const target of [
      { kind: "existing", typeId: ID },
      { kind: "starter", starterKey: "hair_makeup" },
      { kind: "new", familyId: ID },
      { kind: "new", familyId: null },
      { kind: "none" },
    ] as const) {
      expect(parseTypeTarget(typeTargetValue(target))).toEqual(target);
    }
  });

  it("refuse une valeur inattendue", () => {
    for (const value of ["", "existing:12", "starter:Coiffure", "new:abc", "autre", "existing"]) expect(parseTypeTarget(value)).toBeNull();
  });
});
