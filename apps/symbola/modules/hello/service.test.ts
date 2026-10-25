import { describe, expect, it } from "vitest";
import { getGreeting } from "./service";

describe("SOC-01 — Module hello (scaffold)", () => {
  it("expose un message de salutation via service.ts", () => {
    const greeting = getGreeting();

    expect(greeting.message).toBe("Bonjour depuis Symbola");
  });
});
