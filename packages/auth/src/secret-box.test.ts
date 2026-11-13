// L16-SEC-01 (lot 16, ADR 0037) — secret de double authentification chiffré au
// repos : AES-256-GCM, clé d'environnement, rattaché au compte.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isSealedTotpSecret, MfaKeyError, openTotpSecret, readMfaEncryptionKey, sealTotpSecret } from "./secret-box";

const key = randomBytes(32);
// Généré à chaque exécution : aucun secret écrit dans le dépôt (Semgrep).
// Un secret quelconque (le lot 33 a retiré le TOTP maison ; le scellement sert aux liens magiques).
const SECRET = randomBytes(20).toString("base64");
const USER = "6f1c2b9e-0d3a-4c5e-8f71-2a9b4c6d8e01";
const OTHER_USER = "0a7d3e2f-5b1c-4d8e-9f60-1b2c3d4e5f60";

describe("L16-SEC-01 — Secret de double authentification chiffré au repos", () => {
  it("chiffre le secret : la valeur stockée ne contient pas le secret et se relit à l'identique", () => {
    const sealed = sealTotpSecret(SECRET, USER, key);
    expect(isSealedTotpSecret(sealed)).toBe(true);
    expect(sealed).not.toContain(SECRET);
    expect(openTotpSecret(sealed, USER, key)).toBe(SECRET);
  });

  it("deux chiffrements du même secret diffèrent (vecteur d'initialisation aléatoire)", () => {
    expect(sealTotpSecret(SECRET, USER, key)).not.toBe(sealTotpSecret(SECRET, USER, key));
  });

  it("refuse un secret recopié sur un autre compte", () => {
    const sealed = sealTotpSecret(SECRET, USER, key);
    expect(() => openTotpSecret(sealed, OTHER_USER, key)).toThrow();
  });

  it("refuse une valeur altérée ou une autre clé", () => {
    const sealed = sealTotpSecret(SECRET, USER, key);
    const body = Buffer.from(sealed.slice(3), "base64");
    body[body.length - 1] = (body[body.length - 1] ?? 0) ^ 0xff;
    expect(() => openTotpSecret(`v1:${body.toString("base64")}`, USER, key)).toThrow();
    expect(() => openTotpSecret(sealed, USER, randomBytes(32))).toThrow();
  });

  it("relit tel quel un secret enregistré en clair avant le lot 16", () => {
    expect(isSealedTotpSecret(SECRET)).toBe(false);
    expect(openTotpSecret(SECRET, USER, key)).toBe(SECRET);
  });

  it("exige une clé de 32 octets encodée en base64", () => {
    expect(readMfaEncryptionKey({ MFA_ENCRYPTION_KEY: key.toString("base64") })).toEqual(key);
    expect(() => readMfaEncryptionKey({})).toThrow(MfaKeyError);
    expect(() => readMfaEncryptionKey({ MFA_ENCRYPTION_KEY: randomBytes(16).toString("base64") })).toThrow(MfaKeyError);
    expect(() => readMfaEncryptionKey({ MFA_ENCRYPTION_KEY: "pas-du-base64-!!" })).toThrow(MfaKeyError);
  });
});
