// Lot 16 (ARC-01, ADR 0043) — le code de l'app emprunte la réserve de
// connexions partagée, et le module témoin hello est retiré.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// Code exécuté par le serveur de l'app (pages, actions, routes, modules,
// traitements de fond). Les tests, les e2e et les scripts gardent leur propre
// connexion, qu'ils ferment eux-mêmes.
const RUNTIME_DIRS = ["app", "lib", "modules"];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

const runtime = RUNTIME_DIRS.flatMap((dir) => sources(join(ROOT, dir)));

describe("ARC-01 — Une connexion partagée et une garde d'accès unique", () => {
  it("le code de l'app n'ouvre ni ne ferme plus de connexion à lui : il emprunte la réserve partagée", () => {
    const opening = runtime.filter((file) => /\bcreateAppConnection\s*\(|\bsql\.end\s*\(|\bpg\.end\s*\(/.test(readFileSync(file, "utf8")));
    expect(opening.map((file) => relative(ROOT, file))).toEqual([]);
  });

  it("le module témoin hello est retiré (code, entrée de module, appel sur l'accueil)", () => {
    expect(existsSync(join(ROOT, "modules/hello"))).toBe(false);
    const importers = runtime.filter((file) => readFileSync(file, "utf8").includes("@/modules/hello"));
    expect(importers.map((file) => relative(ROOT, file))).toEqual([]);
    expect(readFileSync(join(ROOT, "modules/hub/service.ts"), "utf8")).not.toMatch(/MODULE_KEYS = \[[^\]]*"hello"/);
  });
});
