import { describe, expect, it } from "vitest";
import { findProgramOverlaps, normalizeTime, programForVariant, sortProgramItems } from "./program";

type Line = Parameters<typeof findProgramOverlaps>[0][number];

function line(id: string, startTime: string, endTime: string | null, participants: string[]): Line {
  return {
    id,
    startTime,
    endTime,
    participants: participants.map((label) => ({ vendorSlotId: null, label })),
  };
}

describe("EVT-05 — Heures du programme", () => {
  it("ramène l'heure de la base (« HH:MM:SS ») à « HH:MM » et refuse une heure invalide", () => {
    expect(normalizeTime("09:05:00")).toBe("09:05");
    expect(normalizeTime("23:59")).toBe("23:59");
    expect(() => normalizeTime("24:00")).toThrow(RangeError);
    expect(() => normalizeTime("9h30")).toThrow(RangeError);
  });

  it("trie les lignes par heure de début", () => {
    const sorted = sortProgramItems([line("b", "16:00", null, []), line("a", "14:30", "15:00", [])]);
    expect(sorted.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("EVT-05 — Chevauchements d'un même intervenant", () => {
  it("étant donné deux lignes qui se chevauchent pour un même intervenant, alors l'app le signale", () => {
    const overlaps = findProgramOverlaps([
      line("ceremony", "15:00", "16:00", ["Photographe", "Officiant"]),
      line("cocktail", "15:45", "18:00", ["photographe ", "Traiteur"]),
    ]);
    expect(overlaps).toEqual([{ participant: "Photographe", itemIds: ["ceremony", "cocktail"] }]);
  });

  it("deux lignes qui se suivent sans se recouvrir ne sont pas signalées", () => {
    expect(
      findProgramOverlaps([line("a", "15:00", "16:00", ["DJ"]), line("b", "16:00", "17:00", ["DJ"])]),
    ).toEqual([]);
  });

  it("une ligne sans heure de fin compte comme un instant", () => {
    expect(findProgramOverlaps([line("a", "15:00", "16:00", ["DJ"]), line("b", "15:30", null, ["DJ"])])).toHaveLength(1);
    expect(findProgramOverlaps([line("a", "15:00", null, ["DJ"]), line("b", "15:00", null, ["DJ"])])).toHaveLength(1);
    expect(findProgramOverlaps([line("a", "15:00", null, ["DJ"]), line("b", "16:00", null, ["DJ"])])).toEqual([]);
  });

  it("une ligne qui finit après minuit chevauche la suivante du même intervenant", () => {
    expect(
      findProgramOverlaps([line("party", "22:00", "02:00", ["DJ"]), line("late", "23:30", "23:45", ["DJ"])]),
    ).toHaveLength(1);
  });

  it("un poste prestataire est reconnu par son identifiant, même si son libellé change", () => {
    const slot = (label: string) => ({ vendorSlotId: "slot-1", label });
    expect(
      findProgramOverlaps([
        { id: "a", startTime: "15:00", endTime: "16:00", participants: [slot("Photographe")] },
        { id: "b", startTime: "15:30", endTime: "16:30", participants: [slot("Photo & vidéo")] },
      ]),
    ).toEqual([{ participant: "Photographe", itemIds: ["a", "b"] }]);
  });
});

describe("EVT-05 — Variantes du programme exporté", () => {
  it("la variante « mariés » retire les notes internes, la variante « prestataires » les garde", () => {
    const items = [{ id: "a", internalNote: "Prévoir les alliances" }];
    expect(programForVariant(items, "couple")).toEqual([{ id: "a", internalNote: null }]);
    expect(programForVariant(items, "vendors")).toEqual(items);
  });
});
