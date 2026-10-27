import { describe, expect, it } from "vitest";
import retroplanningFile from "./retroplanning.json";
import vendorSlotsFile from "./vendor-slots.json";
import programFile from "./program.json";
import { starterDemoEvent, starterProgram, starterRetroplanning, starterVendorSlots } from "./index";

describe("EVT-03 — Modèle de départ des postes prestataires", () => {
  it("existe en français et en anglais, avec le même nombre de postes", () => {
    const fr = starterVendorSlots("fr");
    const en = starterVendorSlots("en");
    expect(fr.length).toBeGreaterThan(0);
    expect(en).toHaveLength(fr.length);
    expect(fr).toContain("Traiteur");
    expect(en).toContain("Caterer");
  });

  it("n'a ni clé ni libellé en double", () => {
    const keys = vendorSlotsFile.items.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const locale of ["fr", "en"] as const) {
      const labels = starterVendorSlots(locale);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe("EVT-04 — Modèle de départ du rétroplanning", () => {
  it("existe en français et en anglais, avec les mêmes tâches et décalages", () => {
    const fr = starterRetroplanning("fr");
    const en = starterRetroplanning("en");
    expect(fr.name).not.toBe(en.name);
    expect(en.items).toHaveLength(fr.items.length);
    expect(en.items.map((item) => item.offsetDays)).toEqual(fr.items.map((item) => item.offsetDays));
    expect(fr.items.some((item) => item.responsible === "clients")).toBe(true);
  });

  it("a des clés uniques et des tâches triées de la plus lointaine à la plus proche", () => {
    const keys = retroplanningFile.items.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    const offsets = retroplanningFile.items.map((item) => item.offsetDays);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });
});

describe("EVT-05 — Modèle de départ du programme du jour J", () => {
  it("existe en français et en anglais, avec les mêmes lignes et heures", () => {
    const fr = starterProgram("fr");
    const en = starterProgram("en");
    expect(fr.items.length).toBeGreaterThan(0);
    expect(en.items.map((item) => [item.startTime, item.endTime])).toEqual(
      fr.items.map((item) => [item.startTime, item.endTime]),
    );
    expect(fr.items.map((item) => item.label)).toContain("Cérémonie");
    expect(en.items.map((item) => item.label)).toContain("Ceremony");
  });

  it("ses intervenants sont des postes du modèle de départ, dans la même langue", () => {
    const fr = starterProgram("fr");
    const slots = new Set(starterVendorSlots("fr"));
    for (const item of fr.items) for (const label of item.participantLabels) expect(slots).toContain(label);
    expect(fr.items.find((item) => item.label === "Cérémonie")?.participantLabels).toContain("Photographe");
  });

  it("n'a pas de clé en double", () => {
    const keys = programFile.items.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("AIDE-02 — Données fictives de l'essai guidé des événements", () => {
  it("existent en français et en anglais, et se signalent comme fictives", () => {
    const fr = starterDemoEvent("fr");
    const en = starterDemoEvent("en");
    expect(fr.clients).toHaveLength(en.clients.length);
    expect(fr.daysFromToday).toBeGreaterThan(0);
    expect(fr.clients.every((client) => client.lastName.includes("démo"))).toBe(true);
    expect(en.clients.every((client) => client.lastName.includes("demo"))).toBe(true);
    expect(fr.venueName).toContain("fictif");
  });
});
