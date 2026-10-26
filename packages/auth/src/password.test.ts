import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("SOC-04 — Hachage des mots de passe (argon2id)", () => {
  it("vérifie un mot de passe correct contre son hash", async () => {
    const hash = await hashPassword("un-mot-de-passe-robuste");
    expect(await verifyPassword(hash, "un-mot-de-passe-robuste")).toBe(true);
  });

  it("refuse un mot de passe incorrect", async () => {
    const hash = await hashPassword("un-mot-de-passe-robuste");
    expect(await verifyPassword(hash, "autre-chose")).toBe(false);
  });

  it("ne stocke jamais le mot de passe en clair dans le hash", async () => {
    const hash = await hashPassword("secret-de-test");
    expect(hash).not.toContain("secret-de-test");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });
});
