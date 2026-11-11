import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTotpProvisioningUri, generateTotpSecret, matchTotpStep, verifyTotpToken } from "./totp";

function currentCodeFor(secret: string): string {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });
  return totp.generate();
}

describe("SOC-04 — Double authentification TOTP", () => {
  it("accepte le code courant généré à partir du même secret", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken({ secret, token: currentCodeFor(secret) })).toBe(true);
  });

  it("refuse un code arbitraire", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken({ secret, token: "000000" })).toBe(false);
  });

  it("L16-SEC-01 — donne le pas de temps du code reconnu, pour refuser qu'il serve deux fois", () => {
    const secret = generateTotpSecret();
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) });
    const now = Date.UTC(2026, 10, 8, 9, 0, 15);
    const step = totp.counter({ timestamp: now });
    expect(matchTotpStep({ secret, token: totp.generate({ timestamp: now }), timestamp: now })).toBe(step);
    // Code de la période précédente, encore toléré (horloge du téléphone).
    expect(matchTotpStep({ secret, token: totp.generate({ timestamp: now - 30_000 }), timestamp: now })).toBe(step - 1);
    // Deux périodes plus tôt : refusé.
    expect(matchTotpStep({ secret, token: totp.generate({ timestamp: now - 60_000 }), timestamp: now })).toBeNull();
  });

  it("construit une URI de provisionnement incluant l'émetteur Symbola", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpProvisioningUri({ secret, email: "planner@example.test" });
    expect(uri).toContain("Symbola");
    expect(uri).toContain("planner%40example.test");
  });
});
