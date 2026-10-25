#!/usr/bin/env node
// Contrôle de dépendances (ADR 0011) : un module de apps/symbola/modules/<x>/
// ne doit jamais importer un fichier interne d'un autre module (repository.ts,
// composants internes…) — seulement son service.ts. Équivalent "ESLint
// boundaries" prévu par SOC-01, implémenté ici sans dépendance supplémentaire.
//
// Usage : node tools/boundaries/check-module-boundaries.mjs [racine du monorepo]

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const IMPORT_PATTERN = /\b(?:from|require)\s*\(?\s*["']([^"']+)["']/g;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

export function listModuleRoots(appRoot) {
  const modulesDir = join(appRoot, "modules");
  try {
    return readdirSync(modulesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function walkSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

function moduleOf(appRoot, filePath) {
  const rel = relative(join(appRoot, "modules"), filePath);
  if (rel.startsWith("..")) return null;
  return rel.split(sep)[0];
}

function resolveImportTarget(appRoot, filePath, importPath) {
  if (importPath.startsWith(".")) {
    return resolve(dirname(filePath), importPath);
  }
  if (importPath.startsWith("@/")) {
    return resolve(appRoot, importPath.slice(2));
  }
  return null; // dépendance externe ou alias non concerné par la règle
}

/**
 * @param {string} appRoot dossier contenant `modules/` (ex. apps/symbola)
 * @returns {{file: string, import: string, reason: string}[]} violations
 */
export function checkModuleBoundaries(appRoot) {
  const modules = listModuleRoots(appRoot);
  if (modules.length === 0) return [];

  const violations = [];
  const modulesDir = join(appRoot, "modules");

  for (const moduleName of modules) {
    const moduleDir = join(modulesDir, moduleName);
    if (!statSync(moduleDir).isDirectory()) continue;

    for (const file of walkSourceFiles(moduleDir)) {
      const ownerModule = moduleOf(appRoot, file);
      const content = readFileSync(file, "utf8");

      for (const match of content.matchAll(IMPORT_PATTERN)) {
        const importPath = match[1];
        const targetPath = resolveImportTarget(appRoot, file, importPath);
        if (!targetPath) continue;

        const targetModule = moduleOf(appRoot, targetPath);
        if (!targetModule || targetModule === ownerModule) continue;
        if (!modules.includes(targetModule)) continue;

        const targetWithoutExt = targetPath.replace(/\.(ts|tsx)$/, "");
        const allowedEntryPoint = join(modulesDir, targetModule, "service");

        if (targetWithoutExt !== allowedEntryPoint) {
          violations.push({
            file: relative(appRoot, file),
            import: importPath,
            reason: `seul service.ts du module "${targetModule}" peut être importé (ADR 0011)`,
          });
        }
      }
    }
  }

  return violations;
}

function main() {
  const monorepoRoot = process.argv[2] ?? process.cwd();
  const appRoot = join(monorepoRoot, "apps", "symbola");

  const violations = checkModuleBoundaries(appRoot);

  if (violations.length > 0) {
    console.error("Frontières de modules violées (ADR 0011) :\n");
    for (const v of violations) {
      console.error(`  ${v.file} importe "${v.import}" — ${v.reason}`);
    }
    console.error(`\n${violations.length} violation(s).`);
    process.exit(1);
  }

  console.log("Frontières de modules respectées (ADR 0011).");
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
