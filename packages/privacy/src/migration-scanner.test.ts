import { describe, expect, it } from "vitest";
import { extractColumns } from "./migration-scanner";

describe("SOC-07 — Extraction des colonnes d'une migration SQL", () => {
  it("extrait les colonnes d'un CREATE TABLE", () => {
    const sql = `
CREATE TABLE "hub"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL
);
`;
    expect(extractColumns(sql)).toEqual([
      { schema: "hub", table: "users", field: "id" },
      { schema: "hub", table: "users", field: "email" },
      { schema: "hub", table: "users", field: "password_hash" },
    ]);
  });

  it("extrait une colonne ajoutée par ALTER TABLE ... ADD COLUMN", () => {
    const sql = `ALTER TABLE "events"."client" ADD COLUMN "phone" text;`;
    expect(extractColumns(sql)).toEqual([{ schema: "events", table: "client", field: "phone" }]);
  });

  it("distingue correctement deux tables dans la même migration", () => {
    const sql = `
CREATE TABLE "hub"."organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL
);
`;
    expect(extractColumns(sql)).toEqual([
      { schema: "hub", table: "organizations", field: "id" },
      { schema: "hub", table: "organizations", field: "name" },
      { schema: "hub", table: "users", field: "id" },
      { schema: "hub", table: "users", field: "email" },
    ]);
  });

  it("ignore les lignes hors d'un bloc CREATE TABLE", () => {
    const sql = `CREATE TYPE "hub"."role" AS ENUM('owner', 'member');`;
    expect(extractColumns(sql)).toEqual([]);
  });
});
