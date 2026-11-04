// SOC-06 — étant donné une modification incompatible de l'interface
// service.ts de vendors, ce fichier cesse de compiler (_contractCheck dans
// service.ts) : le vrai module respecte le contrat VendorsServiceContract.
import { describe, expect, it } from "vitest";
import * as vendorsService from "./service";

describe("SOC-06 — Contrat du service.ts de vendors", () => {
  it("expose les fonctions du contrat VendorsServiceContract", () => {
    for (const name of ["listVendorTypes", "createVendor", "updateVendor", "findVendors", "getVendorHistory", "attachVendorFile", "searchVendorBook"] as const) {
      expect(typeof vendorsService[name]).toBe("function");
    }
  });
});
