import { describe, expect, it } from "vitest";
import retroplanningFile from "./retroplanning.json";
import vendorSlotsFile from "./vendor-slots.json";
import { starterRetroplanning, starterVendorSlots } from "./index";

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
