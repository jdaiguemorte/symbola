#!/usr/bin/env -S tsx
// CLI (SOC-07) : fait échouer la CI si une migration ajoute une colonne
// nommée comme personnelle (email, phone, first_name…) sans déclaration
// dans privacy.registry.yaml. Usage : tsx scripts/check-registry.ts
// (détecte seul la racine du monorepo via pnpm-workspace.yaml).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkMigrationAgainstRegistry } from "../src/check-migrations";
import { loadRegistry } from "../src/registry";

function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error("pnpm-workspace.yaml introuvable (racine du monorepo)");
    dir = parent;
  }
  return dir;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const monorepoRoot = findMonorepoRoot(here);
  const registry = loadRegistry(join(monorepoRoot, "privacy.registry.yaml"));
  const migrationsDir = join(monorepoRoot, "packages", "db", "drizzle");

  const migrationFiles = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"));

  let hasViolation = false;

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const violations = checkMigrationAgainstRegistry(sql, registry);

    for (const violation of violations) {
      hasViolation = true;
      console.error(
        `${file} : colonne "${violation.schema}.${violation.table}.${violation.field}" ` +
          "ressemble à un champ personnel mais n'est pas déclarée dans privacy.registry.yaml",
      );
    }
  }

  if (hasViolation) {
    console.error("\nDéclarez ces champs dans privacy.registry.yaml avant de fusionner (SOC-07).");
    process.exit(1);
  }

  console.log("Registre RGPD à jour : aucune colonne personnelle non déclarée.");
}

main();
