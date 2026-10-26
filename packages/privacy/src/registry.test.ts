import { describe, expect, it } from "vitest";
import { findRegistryEntry, parseRegistry } from "./registry";

const validYaml = `
version: 1
fields:
  - schema: hub
    table: users
    field: email
    category: identifiant
    retention: "Tant que le compte existe"
    anonymization: "Valeur générée non réversible"
`;

describe("SOC-07 — Chargement du registre privacy.registry.yaml", () => {
  it("parse un registre valide", () => {
    const registry = parseRegistry(validYaml);
    expect(registry.fields).toHaveLength(1);
    expect(registry.fields[0]?.field).toBe("email");
  });

  it("refuse une catégorie inconnue", () => {
    const invalid = validYaml.replace("identifiant", "inconnu");
    expect(() => parseRegistry(invalid)).toThrow();
  });

  it("refuse une version différente de 1", () => {
    const invalid = validYaml.replace("version: 1", "version: 2");
    expect(() => parseRegistry(invalid)).toThrow();
  });

  it("retrouve une entrée par schéma/table/champ", () => {
    const registry = parseRegistry(validYaml);
    const entry = findRegistryEntry(registry, { schema: "hub", table: "users", field: "email" });
    expect(entry?.category).toBe("identifiant");
  });

  it("ne retrouve rien pour une colonne non déclarée", () => {
    const registry = parseRegistry(validYaml);
    const entry = findRegistryEntry(registry, { schema: "hub", table: "users", field: "phone" });
    expect(entry).toBeUndefined();
  });
});
