import { describe, expect, it } from "vitest";
import { checkMigrationAgainstRegistry } from "./check-migrations";
import { parseRegistry } from "./registry";

const registryWithEmail = parseRegistry(`
version: 1
fields:
  - schema: hub
    table: users
    field: email
    category: identifiant
    retention: "Tant que le compte existe"
    anonymization: "Valeur générée non réversible"
`);

const emptyRegistry = parseRegistry("version: 1\nfields: []\n");

describe("SOC-07 — Migration vs registre RGPD (critère d'acceptation)", () => {
  it("signale une colonne email non déclarée", () => {
    const sql = `CREATE TABLE "hub"."users" (\n\t"id" uuid NOT NULL,\n\t"email" text NOT NULL\n);`;
    const violations = checkMigrationAgainstRegistry(sql, emptyRegistry);
    expect(violations).toEqual([{ schema: "hub", table: "users", field: "email" }]);
  });

  it("ne signale pas une colonne email déjà déclarée", () => {
    const sql = `CREATE TABLE "hub"."users" (\n\t"id" uuid NOT NULL,\n\t"email" text NOT NULL\n);`;
    const violations = checkMigrationAgainstRegistry(sql, registryWithEmail);
    expect(violations).toEqual([]);
  });

  it("ne signale pas une colonne qui ne ressemble pas à un champ personnel", () => {
    const sql = `CREATE TABLE "hub"."organizations" (\n\t"id" uuid NOT NULL,\n\t"name" text NOT NULL\n);`;
    expect(checkMigrationAgainstRegistry(sql, emptyRegistry)).toEqual([]);
  });

  it("signale un champ phone ajouté par ALTER TABLE sans déclaration", () => {
    const sql = `ALTER TABLE "events"."client" ADD COLUMN "phone" text;`;
    expect(checkMigrationAgainstRegistry(sql, emptyRegistry)).toEqual([
      { schema: "events", table: "client", field: "phone" },
    ]);
  });
});
