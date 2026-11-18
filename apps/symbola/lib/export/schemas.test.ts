// Lot 35a (DAT-13, HUB-13, ADR 0068) — format documenté et stable de l'export complet :
// - chaque entité a son schéma publié dans docs/schemas/export/v1, identique à celui que tire le
//   code des colonnes de sa table (une migration qui change une table exportée fait échouer ce
//   test : il faut alors décider de la version du format, puis régénérer) ;
// - chaque table de la base est exportée, ou exclue avec sa raison écrite ;
// - le schéma d'une ligne refuse un champ inconnu, une date mal formée, une valeur hors liste.
// Régénérer : pnpm --filter @symbola/app export:schemas (EXPORT_SCHEMAS_UPDATE=1).
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { ORGANIZATION_EXPORT_FORMAT, ORGANIZATION_EXPORT_MODULES } from "@symbola/contracts";
import * as budgetSchema from "@symbola/db/schema/budget";
import * as coreSchema from "@symbola/db/schema/core";
import * as eventsSchema from "@symbola/db/schema/events";
import * as hubSchema from "@symbola/db/schema/hub";
import * as quotesSchema from "@symbola/db/schema/quotes";
import * as vendorsSchema from "@symbola/db/schema/vendors";
import * as guestsSchema from "@symbola/db/schema/guests";
import { BUDGET_EXPORT_EXCLUSIONS } from "@/modules/budget/service";
import { EVENTS_EXPORT_EXCLUSIONS } from "@/modules/events/service";
import { HUB_EXPORT_EXCLUSIONS } from "@/modules/hub/service";
import { QUOTES_EXPORT_EXCLUSIONS } from "@/modules/quotes/service";
import { VENDORS_EXPORT_EXCLUSIONS } from "@/modules/vendors/service";
import { GUESTS_EXPORT_EXCLUSIONS } from "@/modules/guests/service";
import { entityJsonSchemaText, exportEntitySchemas } from "./schemas";

const PUBLISHED = fileURLToPath(new URL("../../../../docs/schemas/export/v1", import.meta.url));
const UPDATE = process.env.EXPORT_SCHEMAS_UPDATE === "1";

// Entités qui ne portent pas le nom de leur table, ou qui n'en sont pas une.
const ENTITY_TABLES: Record<string, string | null> = { "hub/activity_journal": "audit_entries", "hub/team_members": null };

const EXCLUSIONS: Record<string, Readonly<Record<string, string>>> = {
  hub: HUB_EXPORT_EXCLUSIONS,
  events: EVENTS_EXPORT_EXCLUSIONS,
  budget: BUDGET_EXPORT_EXCLUSIONS,
  quotes: QUOTES_EXPORT_EXCLUSIONS,
  vendors: VENDORS_EXPORT_EXCLUSIONS,
  guests: GUESTS_EXPORT_EXCLUSIONS,
};

function publishedFiles(dir: string): string[] {
  try {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? publishedFiles(path) : [relative(PUBLISHED, path)];
    });
  } catch {
    return [];
  }
}

// Index des entités et des exclusions, publié avec les schémas.
function indexText(): string {
  const entities = exportEntitySchemas();
  const lines = [
    `# Format ${ORGANIZATION_EXPORT_FORMAT} — entités et exclusions`,
    "",
    "Fichier généré (`pnpm --filter @symbola/app export:schemas`) : ne pas le modifier à la main.",
    "Le format est décrit dans `docs/export/format-v1.md`.",
    "",
  ];
  for (const module of ORGANIZATION_EXPORT_MODULES) {
    lines.push(`## Module \`${module}\``, "", "| Entité | Champs | Schéma |", "| --- | --- | --- |");
    for (const entity of entities.filter((candidate) => candidate.module === module)) {
      const fields = Object.keys(entity.schema.shape).map((field) => `\`${field}\``).join(", ");
      lines.push(`| \`${entity.name}\` | ${fields} | [${entity.name}.schema.json](${module}/${entity.name}.schema.json) |`);
    }
    const excluded = Object.entries(EXCLUSIONS[module] ?? {});
    lines.push("", excluded.length > 0 ? "Tables non exportées :" : "Toutes les tables du module sont exportées.", "");
    for (const [table, reason] of excluded) lines.push(`- \`${table}\` — ${reason}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function expectedFiles(): Map<string, string> {
  const files = new Map<string, string>([["README.md", indexText()]]);
  for (const entity of exportEntitySchemas()) files.set(join(entity.module, `${entity.name}.schema.json`), entityJsonSchemaText(entity));
  return files;
}

describe("DAT-13 — Chaque entité a un format d'export stable et documenté", () => {
  it("les schémas publiés dans docs/schemas/export/v1 sont ceux du code, sans fichier en trop", () => {
    const expected = expectedFiles();
    if (UPDATE) {
      rmSync(PUBLISHED, { recursive: true, force: true });
      for (const [file, content] of expected) {
        mkdirSync(dirname(join(PUBLISHED, file)), { recursive: true });
        writeFileSync(join(PUBLISHED, file), content);
      }
    }
    expect(publishedFiles(PUBLISHED).sort()).toEqual([...expected.keys()].sort());
    for (const [file, content] of expected) expect(readFileSync(join(PUBLISHED, file), "utf8"), file).toBe(content);
  });

  it("chaque table de la base est exportée, ou exclue avec sa raison écrite", () => {
    const tables = [hubSchema, coreSchema, eventsSchema, budgetSchema, quotesSchema, vendorsSchema, guestsSchema].flatMap((schema) =>
      Object.values(schema).filter((value): value is PgTable => value instanceof PgTable).map((table) => getTableName(table)),
    );
    const exported = exportEntitySchemas().map((entity) => {
      const key = `${entity.module}/${entity.name}`;
      return key in ENTITY_TABLES ? (ENTITY_TABLES[key] ?? null) : entity.name;
    });
    const excluded = Object.values(EXCLUSIONS).flatMap((reasons) => Object.keys(reasons));
    const covered = new Set([...exported.filter((name): name is string => name !== null), ...excluded]);
    expect(tables.filter((table) => !covered.has(table)).sort()).toEqual([]);
    // Une table n'est jamais à la fois exportée et exclue, et chaque exclusion a sa raison.
    expect(exported.filter((name) => name !== null && excluded.includes(name))).toEqual([]);
    for (const reasons of Object.values(EXCLUSIONS)) for (const reason of Object.values(reasons)) expect(reason.length).toBeGreaterThan(10);
  });

  it("les noms d'entités sont uniques par module, et chaque module de l'archive a les siennes", () => {
    const keys = exportEntitySchemas().map((entity) => `${entity.module}/${entity.name}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const module of ORGANIZATION_EXPORT_MODULES) expect(keys.some((key) => key.startsWith(`${module}/`)), module).toBe(true);
  });

  it("le schéma d'une ligne refuse un champ inconnu, une date mal formée et une valeur hors liste ; un fichier y est un chemin", () => {
    const schemas = new Map(exportEntitySchemas().map((entity) => [`${entity.module}/${entity.name}`, entity.schema]));
    const tasks = schemas.get("events/event_tasks")!;
    const task = {
      id: "6f1c2d3e-4b5a-4c6d-8e7f-001122334455",
      eventId: "6f1c2d3e-4b5a-4c6d-8e7f-001122334466",
      label: "Livrer les fleurs",
      dueDate: "2027-06-11",
      offsetDays: -1,
      fixedAt: null,
      responsible: "vendor",
      vendorCandidateId: null,
      // Lot 47 (D6) : tâche de suivi d'un prestataire retenu (nul ici).
      followUpCandidateId: null,
      doneAt: null,
      position: 0,
      importedFields: null,
      createdAt: "2026-11-15T10:00:00.000Z",
      updatedAt: "2026-11-15T10:00:00.000Z",
      createdBy: null,
      updatedBy: null,
      // Lot 39a (ADR 0073) : une ligne à la corbeille porte sa date de suppression et son auteur.
      deletedAt: null,
      deletedBy: null,
    };
    expect(tasks.safeParse(task).success).toBe(true);
    expect(tasks.safeParse({ ...task, deletedAt: "2026-11-16T10:00:00.000Z", deletedBy: task.eventId }).success).toBe(true);
    expect(tasks.safeParse({ ...task, organizationId: task.id }).success).toBe(false);
    expect(tasks.safeParse({ ...task, dueDate: "11/06/2027" }).success).toBe(false);
    expect(tasks.safeParse({ ...task, responsible: "anyone" }).success).toBe(false);
    // Les secrets ne font pas partie du format : le jeton haché d'un lien n'a pas de champ.
    expect(Object.keys(schemas.get("events/event_links")!.shape)).not.toContain("tokenHash");
    expect(Object.keys(schemas.get("quotes/quote_signers")!.shape)).not.toContain("signingUrl");
    // Un fichier est un chemin dans l'archive (fichiers/…), jamais une clé du stockage.
    const documents = schemas.get("events/event_documents")!;
    expect(documents.shape.fileKey!.safeParse("fichiers/events/event_documents/x-file.pdf").success).toBe(true);
  });
});
