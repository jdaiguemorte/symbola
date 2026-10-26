import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken } from "./session-token";

describe("SOC-04 — Jeton de session opaque", () => {
  it("génère des jetons différents à chaque appel", () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });

  it("produit un hash stable et déterministe pour le même jeton", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("produit des hashs différents pour des jetons différents", () => {
    expect(hashSessionToken("a")).not.toBe(hashSessionToken("b"));
  });

  it("ne renvoie jamais le jeton en clair dans son hash", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).not.toContain(token);
  });
});
