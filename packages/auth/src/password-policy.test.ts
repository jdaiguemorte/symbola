import { describe, expect, it } from "vitest";
import { checkPassword, isCompromisedPassword, PASSWORD_MIN_LENGTH } from "./password-policy";

describe("SEC-03 — Mots de passe de douze caractères, contrôlés contre les mots de passe compromis", () => {
  it("refuse un mot de passe de moins de douze caractères, sans autre règle de composition", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(checkPassword("court-11car")).toBe("too_short");
    expect(checkPassword("tout en minuscules sans chiffre")).toBe("ok");
  });

  it("refuse un mot de passe connu comme compromis", () => {
    expect(checkPassword("123456789012")).toBe("compromised");
    expect(checkPassword("qwerty123456")).toBe("compromised");
    expect(checkPassword("1qaz2wsx3edc")).toBe("compromised");
  });

  it("refuse un mot de passe compromis déguisé : majuscules, chiffres ou symboles autour, substitutions, répétition", () => {
    for (const password of ["Password1234!", "p@ssw0rd2027", "2027Sunshine!!", "AZERTYAZERTY", "iloveyou2027!", "Dragon-12345"]) {
      expect(isCompromisedPassword(password), password).toBe(true);
    }
  });

  it("accepte une phrase de passe ou un mot de passe aléatoire", () => {
    for (const password of ["mot-de-passe-e2e-de-test", "Le chat de Léa dort au soleil", "tq7-Vr2m-pX9s-Lk4n", "mariée-à-Bordeaux-2027"]) {
      expect(checkPassword(password), password).toBe("ok");
    }
  });
});
