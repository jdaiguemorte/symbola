// L16-PRE-15 — étant donné une modification incompatible du schéma de
// l'événement de fusion des types, ce test échoue : l'exemple figé est une
// charge utile réellement publiable avec la version actuelle.
import { describe, expect, it } from "vitest";
import { VENDORS_VENDOR_TYPE_MERGED, VENDORS_VENDOR_TYPE_MERGED_VERSION, vendorTypeMergedPayloadSchema } from "./events";

const FROZEN_MERGED_PAYLOAD = {
  sourceTypeId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
  targetTypeId: "0f9c2b1d-3a4e-4b5c-8d6e-7f8091a2b3c4",
  movedVendorCount: 3,
  movedFieldCount: 1,
};

describe("L16-PRE-15 — événement vendors.vendor_type.merged", () => {
  it("garde son nom, sa version et accepte la charge utile figée", () => {
    expect(VENDORS_VENDOR_TYPE_MERGED).toBe("vendors.vendor_type.merged");
    expect(VENDORS_VENDOR_TYPE_MERGED_VERSION).toBe(1);
    expect(vendorTypeMergedPayloadSchema.parse(FROZEN_MERGED_PAYLOAD)).toEqual(FROZEN_MERGED_PAYLOAD);
  });

  it("refuse un nombre de fiches négatif", () => {
    expect(() => vendorTypeMergedPayloadSchema.parse({ ...FROZEN_MERGED_PAYLOAD, movedVendorCount: -1 })).toThrow();
  });
});
