import { parseEnv } from "@symbola/env";
import { describe, expect, it } from "vitest";
import { buildTransportOptions } from "./mailer";

function envWith(overrides: Record<string, string>) {
  return parseEnv({
    POSTGRES_APP_PASSWORD: "x",
    S3_ACCESS_KEY: "x",
    S3_SECRET_KEY: "x",
    ...overrides,
  });
}

describe("@symbola/mail — buildTransportOptions", () => {
  it("active la connexion chiffrée dès l'ouverture sur le port 465", () => {
    const options = buildTransportOptions(envWith({ SMTP_PORT: "465" }));
    expect(options.secure).toBe(true);
  });

  it("n'active pas la connexion chiffrée dès l'ouverture sur un autre port (ex. 587, STARTTLS)", () => {
    const options = buildTransportOptions(envWith({ SMTP_PORT: "587" }));
    expect(options.secure).toBe(false);
  });

  it("n'envoie aucune authentification quand SMTP_USER est vide (Mailpit)", () => {
    const options = buildTransportOptions(envWith({}));
    expect(options.auth).toBeUndefined();
  });

  it("envoie l'authentification quand SMTP_USER est renseigné", () => {
    const options = buildTransportOptions(envWith({ SMTP_USER: "alertes@symbola.fr", SMTP_PASSWORD: "secret" }));
    expect(options.auth).toEqual({ user: "alertes@symbola.fr", pass: "secret" });
  });
});
