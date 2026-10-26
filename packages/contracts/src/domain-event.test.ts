import { describe, expect, it } from "vitest";
import { domainEventEnvelopeSchema } from "./domain-event";

describe("SOC-06 — Enveloppe commune des événements internes", () => {
  it("accepte une enveloppe valide", () => {
    const envelope = {
      id: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
      organizationId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3b",
      name: "hello.greeting.created",
      version: 1,
      occurredAt: new Date().toISOString(),
      payload: { greetingId: "x", message: "y" },
    };
    expect(() => domainEventEnvelopeSchema.parse(envelope)).not.toThrow();
  });

  it("refuse un nom vide", () => {
    expect(() =>
      domainEventEnvelopeSchema.parse({
        id: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
        organizationId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3b",
        name: "",
        version: 1,
        occurredAt: new Date().toISOString(),
        payload: {},
      }),
    ).toThrow();
  });

  it("refuse une version négative ou nulle", () => {
    expect(() =>
      domainEventEnvelopeSchema.parse({
        id: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
        organizationId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3b",
        name: "hello.greeting.created",
        version: 0,
        occurredAt: new Date().toISOString(),
        payload: {},
      }),
    ).toThrow();
  });
});
