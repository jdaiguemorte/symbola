import { describe, expect, it } from "vitest";
import { quoteIdentifier, quoteLiteral } from "./sql-quoting";

describe("SOC-05 — Échappement SQL pour le bootstrap des rôles", () => {
  it("entoure un identifiant simple de guillemets doubles", () => {
    expect(quoteIdentifier("symbola_app")).toBe('"symbola_app"');
  });

  it("échappe les guillemets doubles internes d'un identifiant", () => {
    expect(quoteIdentifier('weird"name')).toBe('"weird""name"');
  });

  it("entoure une valeur littérale de guillemets simples", () => {
    expect(quoteLiteral("dev-password")).toBe("'dev-password'");
  });

  it("échappe les guillemets simples internes d'un mot de passe (anti-injection)", () => {
    const maliciousPassword = "a' OR '1'='1";
    expect(quoteLiteral(maliciousPassword)).toBe("'a'' OR ''1''=''1'");
  });
});
