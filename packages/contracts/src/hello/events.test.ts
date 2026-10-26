// SOC-06 — étant donné une modification incompatible du schéma
// hello.greeting.created, ce test échoue : l'exemple figé représente une
// charge utile réellement publiée (ou publiable) avec la version actuelle
// du schéma. Le casser signale une rupture de contrat à corriger (nouvelle
// version) avant de fusionner.
import { describe, expect, it } from "vitest";
import {
  HELLO_GREETING_CREATED,
  HELLO_GREETING_CREATED_VERSION,
  helloGreetingCreatedPayloadSchema,
} from "./events";

const FROZEN_EXAMPLE_PAYLOAD = {
  greetingId: "6b1f7e2a-7e3a-4c9a-9a3a-6b1f7e2a7e3a",
  message: "Bonjour depuis Symbola",
};

describe("SOC-06 — Contrat de l'événement hello.greeting.created", () => {
  it("accepte l'exemple figé avec le schéma courant (non-régression de compatibilité)", () => {
    expect(() => helloGreetingCreatedPayloadSchema.parse(FROZEN_EXAMPLE_PAYLOAD)).not.toThrow();
  });

  it("garde le nom et la version attendus (convention <module>.<entité>.<action>)", () => {
    expect(HELLO_GREETING_CREATED).toBe("hello.greeting.created");
    expect(HELLO_GREETING_CREATED_VERSION).toBe(1);
  });

  it("refuse une charge utile sans message", () => {
    const invalid = { greetingId: FROZEN_EXAMPLE_PAYLOAD.greetingId };
    expect(() => helloGreetingCreatedPayloadSchema.parse(invalid)).toThrow();
  });

  it("refuse un greetingId qui n'est pas un UUID", () => {
    const invalid = { ...FROZEN_EXAMPLE_PAYLOAD, greetingId: "pas-un-uuid" };
    expect(() => helloGreetingCreatedPayloadSchema.parse(invalid)).toThrow();
  });
});
