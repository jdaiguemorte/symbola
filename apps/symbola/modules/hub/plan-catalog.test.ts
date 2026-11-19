// Lot 54 (HUB-27, ARC-06, HUB-20 ; D3 ; ADR 0101) — le catalogue de départ des offres : valable,
// l'essai et le forfait Pilote hors du libre-service, la suite complète couverte par l'essai et le
// Pilote, et aucun prix ni quota du catalogue écrit dans le code de l'abonnement (des données,
// modifiables par l'Exploitation sans code).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planCatalogSchema, starterPlanCatalog } from "@symbola/starter-templates";
import plansFile from "@symbola/starter-templates/src/plans.json";
import { MODULE_KEYS } from "./module-registry";
import { validateSelection } from "./subscription-rules";

const APP = join(import.meta.dirname, "..", "..");
const SUBSCRIPTION_SOURCES = [
  "modules/hub/subscription-rules.ts",
  "modules/hub/subscriptions.ts",
  "modules/hub/subscription-mails.ts",
  "modules/hub/plan-catalog.ts",
  "modules/hub/storage-quota.ts",
  "modules/hub/feature-flags.ts",
  "lib/subscriptions.ts",
  "lib/signup-trial.ts",
  "app/subscription-banner.tsx",
  "app/parametres/abonnement",
  "app/exploitation/offres",
  "app/exploitation/interrupteurs",
];

function files(path: string): string[] {
  const full = join(APP, path);
  if (!statSync(full).isDirectory()) return [full];
  return readdirSync(full).flatMap((name) => files(join(path, name)));
}

describe("HUB-27 — Catalogue des offres en données (plans.json)", () => {
  it("le catalogue de départ est valable : une offre d'essai, un forfait Pilote, des clés uniques", () => {
    expect(planCatalogSchema.safeParse(plansFile).success).toBe(true);
    const catalog = starterPlanCatalog();
    expect(catalog.plans.filter((plan) => plan.kind === "trial")).toHaveLength(1);
    expect(catalog.plans.filter((plan) => plan.kind === "pilot")).toHaveLength(1);
  });

  it("le forfait Pilote et l'essai n'apparaissent jamais en libre-service, et le catalogue les refuse en libre-service", () => {
    const catalog = starterPlanCatalog();
    for (const plan of catalog.plans.filter((entry) => entry.kind !== "plan")) {
      expect(plan.selfService, plan.key).toBe(false);
      expect(validateSelection(catalog, { planKey: plan.key, chosenModule: null, options: [], storageUnits: 0, billingPeriod: "monthly" })).toBe("not_self_service");
      const forced = structuredClone(catalog);
      forced.plans = forced.plans.map((entry) => (entry.key === plan.key ? { ...entry, selfService: true } : entry));
      expect(planCatalogSchema.safeParse(forced).success, plan.key).toBe(false);
    }
  });

  it("l'essai et le forfait Pilote ouvrent toute la suite connue de l'app", () => {
    const catalog = starterPlanCatalog();
    for (const plan of catalog.plans.filter((entry) => entry.kind !== "plan")) {
      for (const moduleKey of MODULE_KEYS) expect(plan.modules, `${plan.key} ${moduleKey}`).toContain(moduleKey);
    }
  });

  it("le préavis avant de refuser les dépôts ne descend jamais sous sept jours (DOC-06)", () => {
    const catalog = starterPlanCatalog();
    expect(planCatalogSchema.safeParse({ ...catalog, rules: { ...catalog.rules, quotaBlockNoticeDays: 3 } }).success).toBe(false);
  });

  it("HUB-20 — aucun prix ni quota du catalogue n'est écrit dans le code de l'abonnement", () => {
    const catalog = starterPlanCatalog();
    const values = new Set(
      [...catalog.plans.flatMap((plan) => [plan.monthlyPriceCents, plan.yearlyPriceCents, plan.storageQuotaBytes]), ...catalog.options.flatMap((option) => [option.monthlyPriceCents, option.storageUnitBytes])]
        .filter((value): value is number => typeof value === "number" && value > 0)
        .map(String),
    );
    const problems = SUBSCRIPTION_SOURCES.flatMap(files).flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) => [...line.replaceAll("_", "").matchAll(/\b\d{3,}\b/g)].filter((match) => values.has(match[0])).map((match) => `${file}:${index + 1} : ${match[0]}`)),
    );
    expect(problems).toEqual([]);
  });
});
