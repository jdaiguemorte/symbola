import { describe, expect, it } from "vitest";
import { parseEnv } from "./parse";

const validEnv = {
  POSTGRES_PASSWORD: "dev-password",
  MINIO_ACCESS_KEY: "dev-access-key",
  MINIO_SECRET_KEY: "dev-secret-key",
};

describe("SOC-03 — Validation des variables d'environnement (Zod)", () => {
  it("accepte un environnement valide et applique les valeurs par défaut", () => {
    const env = parseEnv(validEnv);

    expect(env.NODE_ENV).toBe("development");
    expect(env.POSTGRES_HOST).toBe("localhost");
    expect(env.POSTGRES_PORT).toBe(5432);
    expect(env.POSTGRES_PASSWORD).toBe("dev-password");
  });

  it("refuse un démarrage sans POSTGRES_PASSWORD", () => {
    const { POSTGRES_PASSWORD, ...rest } = validEnv;

    expect(() => parseEnv(rest)).toThrow(/POSTGRES_PASSWORD/);
  });

  it("refuse un NODE_ENV inconnu", () => {
    expect(() => parseEnv({ ...validEnv, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });

  it("convertit les ports fournis en chaîne (variables d'env) en nombres", () => {
    const env = parseEnv({ ...validEnv, POSTGRES_PORT: "5555" });

    expect(env.POSTGRES_PORT).toBe(5555);
  });
});
