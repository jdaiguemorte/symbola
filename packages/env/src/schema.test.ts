import { describe, expect, it } from "vitest";
import { parseEnv } from "./parse";
import { geocoderOf, signatureProviderOf } from "./schema";

const validEnv = {
  POSTGRES_APP_PASSWORD: "dev-password",
  S3_ACCESS_KEY: "dev-access-key",
  S3_SECRET_KEY: "dev-secret-key",
  MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  LOGTO_M2M_SECRET: "s".repeat(64),
  LOGTO_ENDPOINT: "https://connexion.symbola.test",
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

  it("DEV-02 — refuse le faux fournisseur en production, et Documenso sans URL, clé ou secret suffisant (ADR 0026)", () => {
    expect(() => parseEnv({ ...validEnv, NODE_ENV: "production", SIGNATURE_PROVIDER: "fake" })).toThrow(/SIGNATURE_PROVIDER/);
    expect(() => parseEnv({ ...validEnv, SIGNATURE_PROVIDER: "documenso" })).toThrow(/DOCUMENSO_API_KEY/);
    expect(() =>
      parseEnv({
        ...validEnv,
        SIGNATURE_PROVIDER: "documenso",
        DOCUMENSO_API_URL: "http://documenso:3000/api/v2",
        DOCUMENSO_API_KEY: "api_cle",
        SIGNATURE_WEBHOOK_SECRET: "trop-court",
      }),
    ).toThrow(/32 caractères/);
    // DocuSeal n'est plus un fournisseur accepté (ADR 0026).
    expect(() => parseEnv({ ...validEnv, SIGNATURE_PROVIDER: "docuseal" })).toThrow(/SIGNATURE_PROVIDER/);
    const env = parseEnv({
      ...validEnv,
      NODE_ENV: "production",
      SIGNATURE_PROVIDER: "documenso",
      DOCUMENSO_API_URL: "http://documenso:3000/api/v2",
      DOCUMENSO_API_KEY: "api_cle",
      SIGNATURE_WEBHOOK_SECRET: "a".repeat(64),
    });
    expect(signatureProviderOf(env)).toBe("documenso");
    // En-tête fixe envoyé par Documenso avec le secret du webhook.
    expect(env.SIGNATURE_WEBHOOK_HEADER).toBe("X-Documenso-Secret");
  });

  it("lot 11 — géocodeur : IGN par défaut en production, simulé ailleurs, simulé interdit en production (ADR 0031)", () => {
    expect(geocoderOf(parseEnv({ ...validEnv, NODE_ENV: "production" }))).toBe("ign");
    expect(geocoderOf(parseEnv({ ...validEnv, GEOCODER: "" }))).toBe("fake");
    expect(geocoderOf(parseEnv({ ...validEnv, GEOCODER: "none" }))).toBe("none");
    expect(() => parseEnv({ ...validEnv, NODE_ENV: "production", GEOCODER: "fake" })).toThrow(/GEOCODER/);
    expect(parseEnv(validEnv).MAP_TILES_DIR).toBe("");
  });
});

describe("L16-SEC-01 — Clé de chiffrement de la double authentification", () => {
  it("refuse un démarrage sans clé, ou avec une clé qui ne fait pas 32 octets en base64", () => {
    const { MFA_ENCRYPTION_KEY, ...rest } = validEnv;
    expect(MFA_ENCRYPTION_KEY).toBeTruthy();
    expect(() => parseEnv(rest)).toThrow(/MFA_ENCRYPTION_KEY/);
    expect(() => parseEnv({ ...validEnv, MFA_ENCRYPTION_KEY: Buffer.alloc(16, 7).toString("base64") })).toThrow(/MFA_ENCRYPTION_KEY/);
    expect(() => parseEnv({ ...validEnv, MFA_ENCRYPTION_KEY: "pas-une-clé" })).toThrow(/MFA_ENCRYPTION_KEY/);
  });
  it("lot 33 (SEC-01, ADR 0067) — fournisseur d'identité : secret machine à machine requis, https en production", () => {
    const { LOGTO_M2M_SECRET, ...rest } = validEnv;
    expect(LOGTO_M2M_SECRET).toBeTruthy();
    expect(() => parseEnv(rest)).toThrow(/LOGTO_M2M_SECRET/);
    expect(() => parseEnv({ ...validEnv, LOGTO_M2M_SECRET: "court" })).toThrow(/LOGTO_M2M_SECRET/);
    const { LOGTO_ENDPOINT, ...withoutEndpoint } = validEnv;
    expect(LOGTO_ENDPOINT).toBeTruthy();
    expect(parseEnv(withoutEndpoint).LOGTO_ENDPOINT).toBe("http://localhost:3001");
    expect(() => parseEnv({ ...withoutEndpoint, NODE_ENV: "production" })).toThrow(/LOGTO_ENDPOINT/);
    expect(parseEnv({ ...validEnv, NODE_ENV: "production", LOGTO_ENDPOINT: "https://connexion.symbola.test" }).LOGTO_ENDPOINT).toBe("https://connexion.symbola.test");
  });
});
