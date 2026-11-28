import { describe, expect, it } from "vitest";
import { FAST_LANE, FULL_SUITE, planParcours } from "./plan-parcours.mjs";

describe("ARC-20, SEC-36 — CI en deux vitesses : quels parcours jouer (lot 76, ADR 0124)", () => {
  it("sur main, la nuit et à la demande : la suite complète (Chromium en quatre parts, Firefox et WebKit, mesures à part)", () => {
    for (const event of ["push", "schedule", "workflow_dispatch"]) {
      const plan = planParcours({ event });
      expect(plan.complete).toBe(true);
      expect(plan.matrix).toBe(FULL_SUITE);
    }
    expect(FULL_SUITE.map((entry) => entry.projets)).toEqual([
      "--project=desktop --project=mobile-375 --shard=1/4",
      "--project=desktop --project=mobile-375 --shard=2/4",
      "--project=desktop --project=mobile-375 --shard=3/4",
      "--project=desktop --project=mobile-375 --shard=4/4",
      "--project=firefox --project=webkit --project=mobile-360 --project=desktop-1920 --project=zoom-150",
      "--project=desktop",
    ]);
    expect(FULL_SUITE.filter((entry) => entry.mode === "mesures")).toHaveLength(1);
  });

  it("sur une PR étiquetée « suite-complete » : la suite complète", () => {
    expect(planParcours({ event: "pull_request", labels: ["documentation", "suite-complete"] }).complete).toBe(true);
  });

  it("sur une PR : la voie rapide, avec les fichiers de parcours modifiés ou ajoutés", () => {
    const plan = planParcours({
      event: "pull_request",
      labels: ["documentation"],
      changedFiles: ["apps/symbola/e2e/lot-72b-aujourdhui.spec.ts", "apps/symbola/app/page.tsx", "apps/symbola/e2e/dev-01-devis.spec.ts", "docs/lots/x.md"],
    });
    expect(plan.complete).toBe(false);
    expect(plan.matrix).toEqual([FAST_LANE]);
    expect(plan.fichiers).toEqual(["dev-01-devis.spec.ts", "lot-72b-aujourdhui.spec.ts"]);
    expect(plan.avertissements).toEqual([]);
  });

  it("garde les mesures hors de la voie rapide (serveur froid), et le dit", () => {
    const plan = planParcours({ event: "pull_request", changedFiles: ["apps/symbola/e2e/nfr-01-02-mesures.spec.ts"] });
    expect(plan.fichiers).toEqual([]);
    expect(plan.avertissements.join(" ")).toMatch(/suite-complete/);
  });

  it("signale les outils communs des parcours modifiés (aides, configuration de Playwright)", () => {
    const plan = planParcours({ event: "pull_request", changedFiles: ["apps/symbola/e2e/helpers.ts", "apps/symbola/playwright.config.ts"] });
    expect(plan.fichiers).toEqual([]);
    expect(plan.avertissements).toHaveLength(1);
    expect(plan.avertissements[0]).toMatch(/helpers\.ts, apps\/symbola\/playwright\.config\.ts/);
  });

  it("la voie rapide tient dans sa limite : 25 min pour les parcours, 40 pour le job", () => {
    expect(FAST_LANE).toMatchObject({ mode: "rapide", projets: "--project=desktop --project=mobile-375", limite: 25, limite_job: 40 });
    for (const entry of FULL_SUITE) expect(entry.limite).toBeLessThan(entry.limite_job);
  });
});
