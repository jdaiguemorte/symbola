import { describe, expect, it } from "vitest";
import { AccountCliError, generatePassword, parseAccountArgs } from "./account-cli";

describe("Création d'un compte en ligne de commande (opérateur)", () => {
  it("compte Admin : rôle et e-mail (normalisé)", () => {
    expect(parseAccountArgs(["--", "--role", "admin", "--email", " Julien@Symbola.fr "])).toEqual({ role: "admin", email: "julien@symbola.fr" });
  });

  it("titulaire : le nom de l'organisation est obligatoire", () => {
    expect(parseAccountArgs(["--role", "owner", "--email", "planner@example.org", "--organization", "Maison Lilas"])).toEqual({
      role: "owner",
      email: "planner@example.org",
      organization: "Maison Lilas",
    });
    expect(() => parseAccountArgs(["--role", "owner", "--email", "planner@example.org"])).toThrow(AccountCliError);
  });

  it("refuse un rôle inconnu, un e-mail invalide, un argument sans valeur ou un mot de passe en argument", () => {
    expect(() => parseAccountArgs(["--role", "client", "--email", "a@b.fr"])).toThrow(AccountCliError);
    expect(() => parseAccountArgs(["--role", "admin", "--email", "pas-un-email"])).toThrow(AccountCliError);
    expect(() => parseAccountArgs(["--role", "admin", "--email"])).toThrow(AccountCliError);
    // Jamais de mot de passe en argument (il resterait dans l'historique du shell).
    expect(() => parseAccountArgs(["--role", "admin", "--email", "a@b.fr", "--password", "x"])).toThrow(AccountCliError);
  });

  it("mot de passe généré : 24 caractères, différent à chaque fois", () => {
    const password = generatePassword();
    expect(password).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(generatePassword()).not.toBe(password);
  });
});
