import { describe, expect, it } from "vitest";
import { contactMergedPayloadSchema, HUB_CONTACT_MERGED, HUB_CONTACT_MERGED_VERSION } from "./contact-events";

describe("CRM-07 — Évènement interne hub.contact.merged (D5)", () => {
  const payload = {
    mergeId: "6f1f7f0e-5d3c-4a8b-9a51-1f4d2a6c7b10",
    keptContactId: "0b6a3d8e-2c1f-4e5a-8b7d-9c0e1f2a3b4c",
    absorbedContactId: "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
  };

  it("porte le nom <module>.<entité>.<action> au passé, en version 1", () => {
    expect(HUB_CONTACT_MERGED).toBe("hub.contact.merged");
    expect(HUB_CONTACT_MERGED_VERSION).toBe(1);
  });

  it("n'accepte que des identifiants, jamais de nom ni d'adresse e-mail", () => {
    expect(contactMergedPayloadSchema.parse(payload)).toEqual(payload);
    expect(Object.keys(contactMergedPayloadSchema.parse({ ...payload, email: "lea@example.test" }))).not.toContain("email");
    expect(contactMergedPayloadSchema.safeParse({ ...payload, keptContactId: "lea@example.test" }).success).toBe(false);
  });

  it("refuse une fusion d'une fiche avec elle-même", () => {
    expect(contactMergedPayloadSchema.safeParse({ ...payload, absorbedContactId: payload.keptContactId }).success).toBe(false);
  });
});
