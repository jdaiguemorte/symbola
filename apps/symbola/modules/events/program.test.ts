import { describe, expect, it } from "vitest";
import type { ProgramItem, PublishedProgramItem } from "@symbola/contracts";
import { findProgramOverlaps, normalizeTime, programChanges, programForVariant, proposeProgramShift, publishedProgramItems, shiftedTimes, sortProgramItems, startShift, vendorProgramOf } from "./program";

type Line = Parameters<typeof findProgramOverlaps>[0][number];

function line(id: string, startTime: string, endTime: string | null, participants: string[]): Line {
  return {
    id,
    startTime,
    endTime,
    participants: participants.map((label) => ({ vendorSlotId: null, label })),
  };
}

describe("PRD-EVT-05 — Heures du programme", () => {
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

describe("PRD-EVT-05 — Chevauchements d'un même intervenant", () => {
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

describe("PRD-EVT-05 — Variantes du programme exporté", () => {
  it("la variante « mariés » retire les notes internes, la variante « prestataires » les garde", () => {
    const items = [{ id: "a", internalNote: "Prévoir les alliances" }];
    expect(programForVariant(items, "couple")).toEqual([{ id: "a", internalNote: null }]);
    expect(programForVariant(items, "vendors")).toEqual(items);
  });
});

describe("CHR-06 — Décaler une séquence propose de décaler les suivantes (lot 30b, D8)", () => {
  const items = [
    { id: "ceremonie", startTime: "15:30", endTime: "16:15" },
    { id: "photos", startTime: "16:30", endTime: null },
    { id: "cocktail", startTime: "17:00", endTime: "19:00" },
    { id: "bal", startTime: "23:15", endTime: "02:00" },
    { id: "preparatifs", startTime: "10:00", endTime: "12:00" },
  ];

  it("l'écart est signé et ramené au plus court : 23:50 → 00:10 avance de 20 min", () => {
    expect(startShift("15:30", "15:50")).toBe(20);
    expect(startShift("15:30", "15:10")).toBe(-20);
    expect(startShift("23:50", "00:10")).toBe(20);
    expect(startShift("00:10", "23:50")).toBe(-20);
    expect(startShift("16:00", "16:00")).toBe(0);
  });

  it("début et fin bougent d'autant ; une fin après minuit le reste", () => {
    expect(shiftedTimes({ startTime: "17:00", endTime: "19:00" }, 20)).toEqual({ startTime: "17:20", endTime: "19:20" });
    expect(shiftedTimes({ startTime: "16:30", endTime: null }, -15)).toEqual({ startTime: "16:15", endTime: null });
    expect(shiftedTimes({ startTime: "23:15", endTime: "02:00" }, 30)).toEqual({ startTime: "23:45", endTime: "02:30" });
    expect(shiftedTimes({ startTime: "22:00", endTime: "23:50" }, 20)).toEqual({ startTime: "22:20", endTime: "00:10" });
  });

  it("un début qui sortirait du jour J (après minuit, avant 00:00) est refusé", () => {
    expect(shiftedTimes({ startTime: "23:50", endTime: null }, 20)).toBeNull();
    expect(shiftedTimes({ startTime: "00:10", endTime: "01:00" }, -20)).toBeNull();
  });

  it("seules les séquences suivantes sont proposées, dans l'ordre du programme", () => {
    expect(proposeProgramShift(items, "ceremonie", "15:30", "15:50")).toEqual({ minutes: 20, itemIds: ["photos", "cocktail", "bal"], outOfDay: false });
    expect(proposeProgramShift(items, "cocktail", "17:00", "16:45")).toEqual({ minutes: -15, itemIds: ["bal"], outOfDay: false });
  });

  it("rien à proposer : même heure, ou aucune séquence après", () => {
    expect(proposeProgramShift(items, "ceremonie", "15:30", "15:30")).toBeNull();
    expect(proposeProgramShift(items, "bal", "23:15", "23:30")).toBeNull();
  });

  it("une séquence suivante sortirait du jour J : la proposition le dit", () => {
    expect(proposeProgramShift(items, "cocktail", "17:00", "17:50")).toEqual({ minutes: 50, itemIds: ["bal"], outOfDay: true });
  });

  it("décaler puis annuler rend les mêmes heures", () => {
    for (const item of items) {
      const there = shiftedTimes(item, 40);
      if (!there) continue;
      expect(shiftedTimes(there, -40)).toEqual({ startTime: item.startTime, endTime: item.endTime });
    }
  });
});

// Lot 37b (CHR-07, DAT-14 ; D8, D9) — règles pures de la diffusion du programme.
function item(id: string, startTime: string, label: string, extra: Partial<ProgramItem> = {}): ProgramItem {
  return { id, eventId: "evt", startTime, endTime: null, label, location: null, internalNote: null, responsible: null, participants: [], ...extra };
}

describe("CHR-07 — Diffusion du chrono par destinataire, par lien et en PDF ; versions numérotées", () => {
  const traiteur = { vendorSlotId: "slot-traiteur", label: "Traiteur" };
  const photographe = { vendorSlotId: "slot-photo", label: "Photographe" };
  const program = [
    item("a", "15:00", "Cérémonie", { endTime: "16:30", location: "Jardin", responsible: "Camille", internalNote: "Ne pas oublier les alliances", participants: [photographe, { vendorSlotId: null, label: "Officiant" }] }),
    item("b", "17:00", "Vin d'honneur", { location: "Terrasse", internalNote: "Marge 2 400 € sur le traiteur", participants: [traiteur, photographe] }),
    item("c", "20:00", "Dîner", { location: "Orangerie", participants: [traiteur] }),
  ];

  it("la copie diffusée ne garde jamais la note interne", () => {
    const published = publishedProgramItems(program);
    expect(published).toHaveLength(3);
    expect(JSON.stringify(published)).not.toMatch(/alliances|Marge|€/);
    expect(published[0]).toEqual({ id: "a", startTime: "15:00", endTime: "16:30", label: "Cérémonie", location: "Jardin", responsible: "Camille", participants: [photographe, { vendorSlotId: null, label: "Officiant" }] });
  });

  it("dit ce qui a changé depuis la dernière diffusion : ajouts, modifications, retraits ; une note interne ne compte pas", () => {
    const published = publishedProgramItems(program);
    expect(programChanges(published, publishedProgramItems(program))).toEqual({ added: [], changed: [], removed: [] });
    const noteOnly = program.map((line) => ({ ...line, internalNote: "autre note" }));
    expect(programChanges(published, publishedProgramItems(noteOnly))).toEqual({ added: [], changed: [], removed: [] });
    const edited = [
      { ...program[0]!, startTime: "15:20", endTime: "16:50" },
      { ...program[1]!, participants: [traiteur] },
      item("d", "23:00", "Pièce montée"),
    ];
    expect(programChanges(published, publishedProgramItems(edited))).toEqual({ added: ["Pièce montée"], changed: ["Cérémonie", "Vin d'honneur"], removed: ["Dîner"] });
  });

  it("avant toute diffusion, toutes les séquences sont nouvelles", () => {
    expect(programChanges(null, publishedProgramItems(program))).toEqual({ added: ["Cérémonie", "Vin d'honneur", "Dîner"], changed: [], removed: [] });
  });

  it("un prestataire voit ses séquences en entier, sans autre intervenant, et le déroulé du jour en titres et horaires seulement (D9)", () => {
    const view = vendorProgramOf(publishedProgramItems(program), "slot-traiteur");
    expect(view.ownItems).toEqual([
      { id: "b", startTime: "17:00", endTime: null, label: "Vin d'honneur", location: "Terrasse", responsible: null },
      { id: "c", startTime: "20:00", endTime: null, label: "Dîner", location: "Orangerie", responsible: null },
    ]);
    expect(view.outline).toEqual([
      { id: "a", startTime: "15:00", endTime: "16:30", label: "Cérémonie", own: false },
      { id: "b", startTime: "17:00", endTime: null, label: "Vin d'honneur", own: true },
      { id: "c", startTime: "20:00", endTime: null, label: "Dîner", own: true },
    ]);
    const text = JSON.stringify(view);
    expect(text).not.toMatch(/Photographe|Officiant|Jardin|Camille|alliances|Marge|€/);
  });

  it("un prestataire sans séquence voit seulement le déroulé du jour", () => {
    const view = vendorProgramOf(publishedProgramItems(program), "slot-fleuriste");
    expect(view.ownItems).toEqual([]);
    expect(view.outline.map((line) => line.own)).toEqual([false, false, false]);
  });

  it("une copie relue garde son ordre par heure de début", () => {
    const published: PublishedProgramItem[] = publishedProgramItems([program[2]!, program[0]!]);
    expect(published.map((line) => line.id)).toEqual(["a", "c"]);
  });
});
