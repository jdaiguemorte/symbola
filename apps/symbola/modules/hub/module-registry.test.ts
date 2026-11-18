// Socle des lots 46 et 49 (ADR 0079 ; RGP-05, ARC-07) — registre des modules : les
// quatre modules du pilote restent ouverts par défaut, les nouveaux sont fermés.
import { describe, expect, it } from "vitest";
import { isModuleKey, MODULE_ENABLED_BY_DEFAULT, MODULE_KEYS, moduleEnabledByDefault } from "./module-registry";

describe("RGP-05 — Modules fermés par défaut tant que l'Admin ne les ouvre pas", () => {
  it("rendez-vous et invités sont au registre, fermés sans réglage ; les modules du pilote restent ouverts", () => {
    expect(MODULE_KEYS).toEqual(["events", "budget", "quotes", "vendors", "appointments", "guests"]);
    expect(Object.keys(MODULE_ENABLED_BY_DEFAULT).sort()).toEqual([...MODULE_KEYS].sort());
    expect(moduleEnabledByDefault("appointments")).toBe(false);
    expect(moduleEnabledByDefault("guests")).toBe(false);
    for (const moduleKey of ["events", "budget", "quotes", "vendors"]) expect(moduleEnabledByDefault(moduleKey)).toBe(true);
  });

  it("une clé inconnue n'est pas un module et reste fermée (refus par défaut)", () => {
    expect(isModuleKey("guests")).toBe(true);
    expect(isModuleKey("billing")).toBe(false);
    expect(isModuleKey("")).toBe(false);
    expect(moduleEnabledByDefault("billing")).toBe(false);
  });
});
