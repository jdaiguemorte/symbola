import { describe, expect, it } from "vitest";
import { parseEnv } from "./parse";
import { signatureProviderOf } from "./schema";

const validEnv = {
  POSTGRES_APP_PASSWORD: "dev-password",
  S3_ACCESS_KEY: "dev-access-key",
  S3_SECRET_KEY: "dev-secret-key",
};

describe("SOC-03 — Validation des variables d'environnement (Zod)", () => {
  it("accepte un environnement valide et applique les valeurs par défaut", () => {
    const env = parseEnv(validEnv);

    expect(env.NODE_ENV).toBe("development");
    expect(env.POSTGRES_HOST).toBe("localhost");
    expect(env.POSTGRES_PORT).toBe(5432);
    expect(env.POSTGRES_APP_USER).toBe("symbola_app");
    expect(env.POSTGRES_APP_PASSWORD).toBe("dev-password");
  });

  it("refuse un démarrage sans POSTGRES_APP_PASSWORD", () => {
    const { POSTGRES_APP_PASSWORD, ...rest } = validEnv;

    expect(() => parseEnv(rest)).toThrow(/POSTGRES_APP_PASSWORD/);
  });

  it("expose la version déployée, « dev » par défaut (SOC-11)", () => {
    expect(parseEnv(validEnv).APP_VERSION).toBe("dev");
    expect(parseEnv({ ...validEnv, APP_VERSION: "e451107" }).APP_VERSION).toBe("e451107");
  });

  it("refuse un NODE_ENV inconnu", () => {
    expect(() => parseEnv({ ...validEnv, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });

  it("convertit les ports fournis en chaîne (variables d'env) en nombres", () => {
    const env = parseEnv({ ...validEnv, POSTGRES_PORT: "5555" });

    expect(env.POSTGRES_PORT).toBe(5555);
  });

  it("traite S3_USE_SSL='false' comme faux (SOC-08, non-régression)", () => {
    // z.coerce.boolean() traiterait toute chaîne non vide comme vraie :
    // "false" devenait `true`. Vérifie que ce n'est plus le cas.
    expect(parseEnv({ ...validEnv, S3_USE_SSL: "false" }).S3_USE_SSL).toBe(false);
    expect(parseEnv({ ...validEnv, S3_USE_SSL: "true" }).S3_USE_SSL).toBe(true);
    expect(parseEnv(validEnv).S3_USE_SSL).toBe(false); // valeur par défaut
  });

  it("DEV-02 — signature : faux fournisseur hors production, « indisponible » en production par défaut", () => {
    expect(signatureProviderOf(parseEnv({ ...validEnv }))).toBe("fake");
    expect(signatureProviderOf(parseEnv({ ...validEnv, NODE_ENV: "production" }))).toBe("none");
    // Le compose transmet une valeur vide quand la variable n'est pas remplie.
    expect(signatureProviderOf(parseEnv({ ...validEnv, NODE_ENV: "production", SIGNATURE_PROVIDER: "" }))).toBe("none");
  });

  it("DEV-02 — refuse le faux fournisseur en production, et DocuSeal sans clé, URL ou secret suffisant", () => {
    expect(() => parseEnv({ ...validEnv, NODE_ENV: "production", SIGNATURE_PROVIDER: "fake" })).toThrow(/SIGNATURE_PROVIDER/);
    expect(() => parseEnv({ ...validEnv, SIGNATURE_PROVIDER: "docuseal" })).toThrow(/DOCUSEAL_API_KEY/);
    expect(() =>
      parseEnv({
        ...validEnv,
        SIGNATURE_PROVIDER: "docuseal",
        DOCUSEAL_API_URL: "http://docuseal:3000/api",
        DOCUSEAL_API_KEY: "cle",
        DOCUSEAL_PUBLIC_URL: "https://signature.exemple.fr",
        SIGNATURE_WEBHOOK_SECRET: "trop-court",
      }),
    ).toThrow(/32 caractères/);
    const env = parseEnv({
      ...validEnv,
      NODE_ENV: "production",
      SIGNATURE_PROVIDER: "docuseal",
      DOCUSEAL_API_URL: "http://docuseal:3000/api",
      DOCUSEAL_API_KEY: "cle",
      DOCUSEAL_PUBLIC_URL: "https://signature.exemple.fr",
      SIGNATURE_WEBHOOK_SECRET: "a".repeat(64),
    });
    expect(signatureProviderOf(env)).toBe("docuseal");
  });
});
