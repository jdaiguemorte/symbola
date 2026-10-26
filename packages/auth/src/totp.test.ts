import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTotpProvisioningUri, generateTotpSecret, verifyTotpToken } from "./totp";

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

  it("construit une URI de provisionnement incluant l'émetteur Symbola", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpProvisioningUri({ secret, email: "planner@example.test" });
    expect(uri).toContain("Symbola");
    expect(uri).toContain("planner%40example.test");
  });
});
