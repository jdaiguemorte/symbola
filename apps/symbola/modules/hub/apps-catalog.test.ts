// Lot 63g (HUB-06, HUB-27, ARC-06, ARC-07, HUB-20 ; ADR 0108) — l'écran « Apps » : chaque module du
// catalogue a sa présentation en données (plans.json), en français et en anglais ; et, libre-service
// ouvert, « Ajouter à mon abonnement » annonce le prix, le prorata et le nouveau total, calculés par
// les règles du lot 54. Les montants viennent du catalogue de départ, jamais d'une valeur écrite ici.
import { describe, expect, it } from "vitest";
import { appCatalogSchema, starterAppCatalog, starterPlanCatalog } from "@symbola/starter-templates";
import plansFile from "@symbola/starter-templates/src/plans.json";
import { MODULE_KEYS } from "./module-registry";
import { addBillingPeriod, appOffer, prorataCents, subscriptionPrice, type SubscriptionRecord } from "./subscription-rules";

const catalog = starterPlanCatalog();
const option = (key: string) => catalog.options.find((entry) => entry.key === key)!;

function record(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  const start = new Date("2026-11-01T00:00:00Z");
  return {
    planKey: "solo",
    chosenModule: null,
    options: [],
    storageUnits: 0,
    billingPeriod: "monthly",
    status: "active",
    trialEndsAt: null,
    currentPeriodStart: start,
    currentPeriodEnd: addBillingPeriod(start, "monthly"),
    cancelEffectiveAt: null,
    ...overrides,
  };
}

describe("HUB-06 — Présentation des apps en données (plans.json)", () => {
  it("chaque module du registre a sa présentation : nom, ce qu'il apporte et où le trouver, en français et en anglais", () => {
    expect(appCatalogSchema.safeParse(plansFile).success).toBe(true);
    const apps = starterAppCatalog();
    expect(apps.map((app) => app.key).sort()).toEqual([...MODULE_KEYS].sort());
    for (const app of apps) {
      for (const locale of ["fr", "en"] as const) {
        expect(app.labels[locale].length, `${app.key} ${locale}`).toBeGreaterThan(0);
        expect(app.benefits[locale].length, `${app.key} ${locale}`).toBeGreaterThan(0);
        expect(app.whereToFind[locale].length, `${app.key} ${locale}`).toBeGreaterThan(0);
      }
    }
  });

  it("l'adresse d'une app activée est un chemin interne de l'app, jamais une adresse extérieure", () => {
    for (const app of starterAppCatalog()) expect(app.href, app.key).toMatch(/^\/[a-z]/);
  });

  it("le plan de table est décrit dans « Invités », les plans des lieux dans « Plans de salle »", () => {
    const apps = starterAppCatalog();
    const guests = apps.find((app) => app.key === "guests")!;
    const floorplans = apps.find((app) => app.key === "floorplans")!;
    expect(guests.benefits.fr).toContain("plan de table");
    expect(guests.benefits.en).toContain("seating plan");
    expect(floorplans.benefits.fr).toContain("plans des lieux");
    expect(floorplans.benefits.fr).not.toContain("plan de table");
    expect(floorplans.benefits.fr).not.toMatch(/des tables\b/);
    // Les options du catalogue des offres disent la même chose.
    expect(option("guests").descriptions.fr).toContain("plan de table");
    expect(option("floorplans").descriptions.fr).toContain("plans des lieux");
    expect(option("floorplans").descriptions.fr).not.toMatch(/des tables\b/);
    expect(option("floorplans").descriptions.en).not.toMatch(/table plans/i);
  });
});

describe("HUB-27 — « Ajouter à mon abonnement » : prix, prorata et nouveau total", () => {
  it("une option de module en libre-service, sur une offre qui admet des options : son prix, le prorata jusqu'à la fin de la période et le nouveau total", () => {
    const subscription = record();
    const now = new Date("2026-11-16T00:00:00Z");
    const offer = appOffer(catalog, subscription, "floorplans", now);
    expect(offer.kind).toBe("option");
    if (offer.kind !== "option") return;
    const before = subscriptionPrice(catalog, subscription).totalCents;
    expect(offer.optionKey).toBe("floorplans");
    expect(offer.priceCents).toBe(option("floorplans").monthlyPriceCents);
    expect(offer.currentTotalCents).toBe(before);
    expect(offer.newTotalCents).toBe(before + option("floorplans").monthlyPriceCents);
    expect(offer.prorataCents).toBe(
      prorataCents({ fromCents: before, toCents: offer.newTotalCents, periodStart: subscription.currentPeriodStart!, periodEnd: subscription.currentPeriodEnd!, now }),
    );
    expect(offer.prorataCents).toBeGreaterThan(0);
    expect(offer.prorataCents).toBeLessThan(offer.priceCents);
    expect(offer.periodEnd).toEqual(subscription.currentPeriodEnd);
    expect(offer.selection.options).toEqual(["floorplans"]);
  });

  it("période annuelle : le prix de l'option est compté sur douze mois", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    const offer = appOffer(catalog, record({ billingPeriod: "yearly", currentPeriodStart: start, currentPeriodEnd: addBillingPeriod(start, "yearly") }), "guests", new Date("2026-11-01T00:00:00Z"));
    expect(offer.kind).toBe("option");
    if (offer.kind === "option") expect(offer.priceCents).toBe(option("guests").monthlyPriceCents * 12);
  });

  it("les options déjà prises restent, et la sélection est rangée", () => {
    const offer = appOffer(catalog, record({ options: ["guests"] }), "appointments", new Date("2026-11-16T00:00:00Z"));
    expect(offer.kind === "option" && offer.selection.options).toEqual(["appointments", "guests"]);
  });

  it("une offre sans options (App seule) ou sans abonnement : passer par « Mon abonnement » pour changer d'offre", () => {
    expect(appOffer(catalog, record({ planKey: "app", chosenModule: "quotes" }), "floorplans", new Date()).kind).toBe("change_plan");
    expect(appOffer(catalog, null, "floorplans", new Date()).kind).toBe("change_plan");
  });

  it("un module inclus dans une autre offre, pas vendu en option : changer d'offre", () => {
    expect(appOffer(catalog, record({ planKey: "app", chosenModule: "appointments" }), "budget", new Date()).kind).toBe("change_plan");
  });

  it("le forfait Pilote ne se change pas ici : rien à ajouter", () => {
    expect(appOffer(catalog, record({ planKey: "pilot", currentPeriodEnd: null }), "floorplans", new Date()).kind).toBe("none");
  });

  it("hors d'une période en cours (essai, lecture seule), aucun prorata", () => {
    const offer = appOffer(catalog, record({ status: "trial", trialEndsAt: new Date("2026-12-01T00:00:00Z"), currentPeriodStart: null, currentPeriodEnd: null }), "floorplans", new Date("2026-11-16T00:00:00Z"));
    expect(offer.kind).toBe("change_plan");
    const ended = appOffer(catalog, record({ currentPeriodEnd: new Date("2026-11-10T00:00:00Z") }), "floorplans", new Date("2026-11-16T00:00:00Z"));
    expect(ended.kind === "option" && ended.prorataCents).toBe(0);
  });
});
