import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkModuleBoundaries } from "./check-module-boundaries.mjs";

describe("SOC-01 — Frontière entre modules (ADR 0011)", () => {
  let appRoot;

  beforeEach(() => {
    appRoot = mkdtempSync(join(tmpdir(), "symbola-boundaries-"));
    for (const name of ["alpha", "beta"]) {
      mkdirSync(join(appRoot, "modules", name), { recursive: true });
      writeFileSync(join(appRoot, "modules", name, "service.ts"), "export const ok = true;\n");
      writeFileSync(join(appRoot, "modules", name, "repository.ts"), "export const data = [];\n");
    }
  });

  afterEach(() => {
    rmSync(appRoot, { recursive: true, force: true });
  });

  it("autorise un module à importer le service.ts d'un autre module", () => {
    writeFileSync(
      join(appRoot, "modules", "alpha", "service.ts"),
      `import { ok } from "../beta/service";\nexport { ok };\n`,
    );

    expect(checkModuleBoundaries(appRoot)).toEqual([]);
  });

  it("refuse qu'un module importe le repository.ts d'un autre module", () => {
    writeFileSync(
      join(appRoot, "modules", "alpha", "service.ts"),
      `import { data } from "../beta/repository";\nexport { data };\n`,
    );

    const violations = checkModuleBoundaries(appRoot);

    expect(violations).toHaveLength(1);
    expect(violations[0].file).toContain("alpha");
    expect(violations[0].import).toContain("beta/repository");
  });

  it("refuse l'import via l'alias @/modules/<x>/repository", () => {
    writeFileSync(
      join(appRoot, "modules", "alpha", "service.ts"),
      `import { data } from "@/modules/beta/repository";\nexport { data };\n`,
    );

    const violations = checkModuleBoundaries(appRoot);

    expect(violations).toHaveLength(1);
  });

  it("autorise les imports internes à un même module (service -> repository)", () => {
    writeFileSync(
      join(appRoot, "modules", "alpha", "service.ts"),
      `import { data } from "./repository";\nexport { data };\n`,
    );

    expect(checkModuleBoundaries(appRoot)).toEqual([]);
  });

  it("renvoie un tableau vide quand le dossier modules/ n'existe pas", () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "symbola-boundaries-empty-"));
    expect(checkModuleBoundaries(emptyRoot)).toEqual([]);
    rmSync(emptyRoot, { recursive: true, force: true });
  });
});
