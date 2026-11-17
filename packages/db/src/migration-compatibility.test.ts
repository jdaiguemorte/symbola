// Lot 40a (ARC-14, décision D5, ADR 0075) — les migrations restent compatibles avec la version
// précédente du code, sauf marqueur « arrêt requis » justifié et décrit dans le runbook.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { breakingChanges, LAST_MIGRATION_BEFORE_RULE, pendingEntries, requiresStop, stopReason, stripSqlComments, type JournalEntry } from "./migration-compatibility";

const packageRoot = resolve(import.meta.dirname, "..");
const migrationsFolder = resolve(packageRoot, "drizzle");
const runbook = readFileSync(resolve(packageRoot, "../../docs/runbooks/deploiement.md"), "utf8");
const journal = JSON.parse(readFileSync(resolve(migrationsFolder, "meta/_journal.json"), "utf8")) as { entries: JournalEntry[] };
const migrationSql = (tag: string) => readFileSync(resolve(migrationsFolder, `${tag}.sql`), "utf8");

describe("ARC-14 — Les migrations restent compatibles avec la version précédente du code", () => {
  it("chaque migration livrée depuis la règle n'ajoute que, ou porte le marqueur « arrêt requis » et son paragraphe du runbook", () => {
    const problems: string[] = [];
    for (const entry of journal.entries.filter((candidate) => candidate.idx > LAST_MIGRATION_BEFORE_RULE)) {
      const sql = migrationSql(entry.tag);
      const changes = breakingChanges(sql);
      const reason = stopReason(sql);
      if (changes.length > 0 && reason === null) {
        problems.push(`${entry.tag} : ${changes.join(", ")} sans « -- symbola: arret-requis <raison> »`);
      }
      if (reason !== null && !runbook.includes(entry.tag)) {
        problems.push(`${entry.tag} : arrêt requis, mais aucun paragraphe de docs/runbooks/deploiement.md ne la cite`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("chaque entrée du journal a son fichier SQL", () => {
    for (const entry of journal.entries) expect(existsSync(resolve(migrationsFolder, `${entry.tag}.sql`)), entry.tag).toBe(true);
  });

  it("reconnaît les changements cassants des trois migrations livrées qui demandaient l'arrêt de l'app", () => {
    expect(breakingChanges(migrationSql("0132_lot34a_events_lifecycle"))).toEqual(expect.arrayContaining(["renommage", "changement de type", "suppression de type"]));
    expect(breakingChanges(migrationSql("0133_lot34b_events_fiche_tasks"))).toContain("suppression de colonne");
    // 0135 supprime aussi sa table de travail (créée par elle-même) : seule la colonne compte.
    expect(breakingChanges(migrationSql("0135_lot36a_contacts"))).toEqual(["suppression de colonne"]);
    for (const entry of journal.entries.filter((candidate) => ["0132", "0133", "0135"].includes(candidate.tag.slice(0, 4)))) {
      expect(requiresStop(entry, migrationSql(entry.tag)), entry.tag).toBe(true);
    }
  });

  it("une migration livrée avant la règle demande l'arrêt si elle porte un changement cassant, pas sinon", () => {
    const byPrefix = (prefix: string) => journal.entries.find((entry) => entry.tag.startsWith(prefix))!;
    expect(requiresStop(byPrefix("0103_"), migrationSql(byPrefix("0103_").tag))).toBe(true);
    expect(requiresStop(byPrefix("0148_"), migrationSql(byPrefix("0148_").tag))).toBe(false);
    // Après la règle, seul le marqueur compte (le contrôle de la CI exige qu'il soit là).
    expect(requiresStop({ idx: LAST_MIGRATION_BEFORE_RULE + 1 }, `ALTER TABLE x DROP COLUMN y;`)).toBe(false);
  });

  it("signale suppression, renommage, changement de type et colonne rendue obligatoire", () => {
    expect(breakingChanges(`ALTER TABLE "hub"."contacts" DROP COLUMN "phone";`)).toEqual(["suppression de colonne"]);
    expect(breakingChanges(`ALTER TABLE "hub"."contacts" RENAME COLUMN "phone" TO "mobile";`)).toEqual(["renommage"]);
    expect(breakingChanges(`ALTER TABLE hub.contacts RENAME TO people;`)).toEqual(["renommage"]);
    expect(breakingChanges(`ALTER TYPE "events"."event_status" RENAME VALUE 'done' TO 'closed';`)).toEqual(["renommage"]);
    expect(breakingChanges(`ALTER TABLE "hub"."contacts" ALTER COLUMN "kind" SET DATA TYPE text;`)).toEqual(["changement de type"]);
    expect(breakingChanges(`ALTER TABLE "hub"."contacts" ALTER COLUMN "kind" TYPE text;`)).toEqual(["changement de type"]);
    expect(breakingChanges(`ALTER TABLE "hub"."contacts" ALTER COLUMN "kind" SET NOT NULL;`)).toEqual(["colonne rendue obligatoire"]);
    expect(breakingChanges(`ALTER TABLE "hub"."contacts" ADD COLUMN "kind" text NOT NULL;`)).toEqual(["colonne obligatoire ajoutée sans valeur par défaut"]);
    expect(breakingChanges(`DROP TABLE "hub"."contacts";`)).toEqual(["suppression de table"]);
    expect(breakingChanges(`DROP TYPE "events"."old_status";`)).toEqual(["suppression de type"]);
    expect(breakingChanges(`DROP SCHEMA "hello" CASCADE;`)).toEqual(["suppression de schéma"]);
  });

  it("laisse passer les ajouts : table, colonne facultative ou avec valeur par défaut, index, valeur, politique", () => {
    const additions = [
      `CREATE TABLE "hub"."jobs" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "kind" text NOT NULL);`,
      `ALTER TABLE "hub"."contacts" ADD COLUMN "nickname" text;`,
      `ALTER TABLE "hub"."contacts" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;`,
      `ALTER TABLE "hub"."contacts" ADD COLUMN "search" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "name")) STORED NOT NULL;`,
      `CREATE INDEX "contacts_name_idx" ON "hub"."contacts" ("name");`,
      `ALTER TYPE "events"."task_responsible" ADD VALUE 'vendor';`,
      `DROP POLICY IF EXISTS "contacts_isolation" ON "hub"."contacts"; CREATE POLICY "contacts_isolation" ON "hub"."contacts" USING (true);`,
      `CREATE TEMPORARY TABLE "work_copy" AS SELECT 1; DROP TABLE "work_copy";`,
      `ALTER TABLE "hub"."contacts" ALTER COLUMN "kind" SET DEFAULT 'person';`,
    ];
    for (const sql of additions) expect(breakingChanges(sql), sql).toEqual([]);
  });

  it("ignore les commentaires, mais pas le texte entre apostrophes", () => {
    expect(breakingChanges(`-- DROP COLUMN "phone" viendra plus tard\n/* RENAME TO x */\nALTER TABLE "hub"."contacts" ADD COLUMN "x" text;`)).toEqual([]);
    expect(stripSqlComments(`SELECT '--pas un commentaire'; -- commentaire`)).toBe(`SELECT '--pas un commentaire'; `);
  });

  it("lit la raison du marqueur, et une migration marquée demande l'arrêt", () => {
    const sql = `-- symbola: arret-requis le statut « réalisé » devient « clôturé »\nALTER TYPE "events"."event_status" RENAME VALUE 'done' TO 'closed';`;
    expect(stopReason(sql)).toBe("le statut « réalisé » devient « clôturé »");
    expect(requiresStop({ idx: 200 }, sql)).toBe(true);
    expect(stopReason(`-- symbola: arret-requis\nALTER TABLE x DROP COLUMN y;`)).toBeNull();
    expect(requiresStop({ idx: 200 }, `CREATE TABLE "hub"."x" ("id" uuid);`)).toBe(false);
  });
});

describe("ARC-14 — Migrations en attente (deploy.sh)", () => {
  const entries: JournalEntry[] = [
    { idx: 1, tag: "0001_a", when: 1_000 },
    { idx: 0, tag: "0000_z", when: 500 },
    { idx: 2, tag: "0002_b", when: 2_000 },
  ];

  it("toutes sur une base neuve, dans l'ordre du journal", () => {
    expect(pendingEntries(entries, null).map((entry) => entry.tag)).toEqual(["0000_z", "0001_a", "0002_b"]);
  });

  it("seulement celles qui suivent la dernière appliquée", () => {
    expect(pendingEntries(entries, 1_000).map((entry) => entry.tag)).toEqual(["0002_b"]);
    expect(pendingEntries(entries, 2_000)).toEqual([]);
  });
});
