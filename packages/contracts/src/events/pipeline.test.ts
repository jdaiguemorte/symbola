// CRM-01 (lot 44) — contrat de l'événement events.prospect.received : l'exemple figé reste publiable,
// et la charge utile ne porte aucune donnée personnelle (SEC-20).
import { describe, expect, it } from "vitest";
import { EVT_PROSPECT_RECEIVED, EVT_PROSPECT_RECEIVED_VERSION, prospectReceivedPayloadSchema } from "./pipeline";

const FROZEN_PAYLOAD = { requestId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a", eventId: "9a3a6b1f-7e2a-4c9a-9a3a-6b1f7e2a7e3a", state: "received" };

describe("CRM-01 — Contrat de l'événement events.prospect.received", () => {
  it("accepte l'exemple figé avec le schéma courant", () => {
    expect(() => prospectReceivedPayloadSchema.parse(FROZEN_PAYLOAD)).not.toThrow();
    expect(() => prospectReceivedPayloadSchema.parse({ ...FROZEN_PAYLOAD, eventId: null, state: "to_review" })).not.toThrow();
  });

  it("garde le nom et la version attendus", () => {
    expect(EVT_PROSPECT_RECEIVED).toBe("events.prospect.received");
    expect(EVT_PROSPECT_RECEIVED_VERSION).toBe(1);
  });

  it("ne transporte que des identifiants et l'état (aucune donnée personnelle)", () => {
    expect(Object.keys(prospectReceivedPayloadSchema.shape).sort()).toEqual(["eventId", "requestId", "state"]);
    const parsed = prospectReceivedPayloadSchema.parse({ ...FROZEN_PAYLOAD, email: "lea@example.test" } as unknown);
    expect(parsed).not.toHaveProperty("email");
  });
});
