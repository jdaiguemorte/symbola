// Lot 33 (HUB-01, SEC-03, ADR 0067) — réglages appliqués au fournisseur d'identité.
import { describe, expect, it } from "vitest";
import { accountCenter, forbiddenPasswordWords, signInExperience, smtpConnector, webApplication } from "./settings";

describe("HUB-01 — Expérience de connexion du fournisseur d'identité", () => {
  const settings = signInExperience(["azerty"]);

  it("l'inscription ne demande que l'adresse e-mail, vérifiée ; aucun mot de passe à l'inscription", () => {
    expect(settings.signUp).toEqual({ identifiers: ["email"], password: false, verify: true });
  });

  it("la connexion accepte le code par e-mail, le mot de passe et la clé d'accès", () => {
    expect(settings.signIn.methods).toEqual([{ identifier: "email", password: true, verificationCode: true, isPasswordPrimary: false }]);
    expect(settings.passkeySignIn.enabled).toBe(true);
  });

  it("D4 — le fournisseur ne propose jamais la double authentification de lui-même ; Symbola l'exige", () => {
    expect(settings.mfa).toEqual({ factors: ["Totp", "WebAuthn", "BackupCode"], policy: "NoPrompt" });
  });

  it("pages en français par défaut", () => {
    expect(settings.languageInfo).toEqual({ autoDetect: true, fallbackLanguage: "fr" });
  });
});

describe("SEC-03 — Mots de passe compromis chez le fournisseur (ADR 0063, 0067)", () => {
  it("SEC-04 — cinq essais manqués bloquent la connexion quinze minutes, chez le fournisseur", () => {
    expect(signInExperience([]).sentinelPolicy).toEqual({ maxAttempts: 5, lockoutDuration: 15 });
  });

  it("douze caractères au moins, répétitions et suites refusées, aucun appel sortant", () => {
    const { passwordPolicy } = signInExperience([]);
    expect(passwordPolicy.length.min).toBe(12);
    expect(passwordPolicy.rejects.pwned).toBe(false);
    expect(passwordPolicy.rejects.repetitionAndSequence).toBe(true);
  });

  it("la liste locale (mots de passe répandus) et les années sont des mots interdits", () => {
    const words = forbiddenPasswordWords();
    expect(words.length).toBeGreaterThan(49_000);
    for (const word of ["password", "azerty", "motdepasse", "2027", "1985"]) expect(words).toContain(word);
    expect(new Set(words).size).toBe(words.length);
  });
});

describe("SEC-01 — Application web et e-mails du fournisseur", () => {
  it("le retour et la sortie visent l'adresse publique de l'app", () => {
    expect(webApplication("https://app.symbola.test/").oidcClientMetadata).toEqual({
      redirectUris: ["https://app.symbola.test/auth/callback"],
      postLogoutRedirectUris: ["https://app.symbola.test/login"],
    });
  });

  it("les e-mails passent par le serveur d'envoi de Symbola, en TLS en production, sans TLS vers Mailpit", () => {
    const production = smtpConnector({ host: "smtp.ionos.test", port: 465, user: "notifications", password: "x", from: "Symbola <notifications@symbola.test>", secure: true });
    expect(production).toMatchObject({ host: "smtp.ionos.test", port: 465, secure: true, fromEmail: "Symbola <notifications@symbola.test>" });
    const dev = smtpConnector({ host: "mailpit", port: 1025, from: "Symbola <no-reply@symbola.test>", secure: false });
    expect(dev).toMatchObject({ ignoreTLS: true });
    expect(dev.templates.map((template) => template.usageType)).toEqual(["SignIn", "Register", "ForgotPassword", "Generic"]);
    for (const template of dev.templates) expect(template.content).toContain("{{code}}");
  });
});

describe("SEC-01 — Centre de compte du fournisseur (D4)", () => {
  it("mot de passe, clé d'accès et double authentification modifiables ; adresse en lecture seule ; le reste coupé", () => {
    const { enabled, fields } = accountCenter();
    expect(enabled).toBe(true);
    expect(fields).toMatchObject({ password: "Edit", mfa: "Edit", passkey: "Edit", email: "ReadOnly" });
    const others = Object.entries(fields).filter(([key]) => !["password", "mfa", "passkey", "email"].includes(key));
    for (const [, value] of others) expect(value).toBe("Off");
  });
});
