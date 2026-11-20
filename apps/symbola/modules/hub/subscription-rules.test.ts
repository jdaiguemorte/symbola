// Lot 54 (HUB-27, ARC-06, DOC-06 ; ADR 0101) — règles pures de l'abonnement, à l'horloge simulée :
// droits d'usage d'une offre, total et prorata, calendrier de l'essai (rappels à J-7 et J-1, passage
// à l'heure d'été), échéance de la résiliation, et paliers du quota de stockage (alertes à 80 et
// 95 %, dépôts refusés seulement après sept jours de préavis). Les montants viennent du catalogue de
// départ (plans.json), jamais d'une valeur écrite ici.
import { describe, expect, it } from "vitest";
import { starterPlanCatalog, type PlanCatalog } from "@symbola/starter-templates";
import {
  addBillingPeriod,
  cancellationEffectiveAt,
  entitledModules,
  initialQuotaState,
  nextQuotaState,
  prorataCents,
  quotaPercent,
  storageQuotaBytes,
  subscriptionPrice,
  trialEndsAt,
  trialReminderDue,
  uploadsBlocked,
  validateSelection,
  type SubscriptionRecord,
} from "./subscription-rules";

const KNOWN = ["events", "budget", "quotes", "vendors", "appointments", "guests"] as const;

function catalog(): PlanCatalog {
  return starterPlanCatalog();
}

function plan(key: string) {
  const found = catalog().plans.find((entry) => entry.key === key);
  if (!found) throw new Error(key);
  return found;
}

function option(key: string) {
  const found = catalog().options.find((entry) => entry.key === key);
  if (!found) throw new Error(key);
  return found;
}

function record(overrides: Partial<SubscriptionRecord>): SubscriptionRecord {
  return {
    planKey: "solo",
    chosenModule: null,
    options: [],
    storageUnits: 0,
    billingPeriod: "monthly",
    status: "active",
    trialEndsAt: null,
    currentPeriodStart: new Date("2026-11-19T10:00:00Z"),
    currentPeriodEnd: new Date("2026-12-18T23:00:00Z"),
    cancelEffectiveAt: null,
    ...overrides,
  };
}

describe("ARC-06 — Droits d'usage pilotés par l'abonnement (règles)", () => {
  it("la suite Solo ouvre ses quatre modules, et rien d'autre", () => {
    const modules = entitledModules(catalog(), record({ planKey: "solo" }), KNOWN);
    expect([...modules].sort()).toEqual([...plan("solo").modules].sort());
    expect(modules.has("guests")).toBe(false);
  });

  it("une option de module ajoutée à une suite ouvre son module", () => {
    const modules = entitledModules(catalog(), record({ planKey: "solo", options: ["guests"] }), KNOWN);
    expect(modules.has("guests")).toBe(true);
  });

  it("l'App seule n'ouvre que l'app choisie parmi celles qu'elle propose, et ignore les options", () => {
    const choice = plan("app").moduleChoice[0]!;
    const modules = entitledModules(catalog(), record({ planKey: "app", chosenModule: choice, options: ["guests"] }), KNOWN);
    expect([...modules]).toEqual([choice]);
    expect([...entitledModules(catalog(), record({ planKey: "app", chosenModule: "events" }), KNOWN)]).toEqual([]);
  });

  it("l'essai et le forfait Pilote ouvrent la suite complète connue de l'app ; une clé inconnue est ignorée (refus par défaut)", () => {
    for (const key of ["trial", "pilot"]) {
      const modules = entitledModules(catalog(), record({ planKey: key, status: key === "trial" ? "trial" : "active" }), KNOWN);
      expect([...modules].sort()).toEqual([...KNOWN].sort());
    }
    expect(entitledModules(catalog(), record({ planKey: "trial" }), ["events"]).has("floorplans" as never)).toBe(false);
  });

  it("une offre inconnue n'ouvre rien", () => {
    expect(entitledModules(catalog(), record({ planKey: "inconnue" }), KNOWN).size).toBe(0);
  });

  it("une offre fermée par l'Exploitation (inactive) n'est plus proposée, mais l'abonnement en cours garde ses droits", () => {
    const changed = catalog();
    changed.plans = changed.plans.map((entry) => (entry.key === "solo" ? { ...entry, selfService: false } : entry));
    expect(validateSelection(changed, { planKey: "solo", chosenModule: null, options: [], storageUnits: 0, billingPeriod: "monthly" })).toBe("not_self_service");
    expect(entitledModules(changed, record({ planKey: "solo" }), KNOWN).has("events")).toBe(true);
  });
});

describe("HUB-27 — Choix de l'offre et des options (règles)", () => {
  it("le choix d'une offre en libre-service est valable ; l'essai et le Pilote ne se choisissent pas", () => {
    const base = { chosenModule: null, options: [], storageUnits: 0, billingPeriod: "monthly" as const };
    expect(validateSelection(catalog(), { ...base, planKey: "solo" })).toBeNull();
    expect(validateSelection(catalog(), { ...base, planKey: "pilot" })).toBe("not_self_service");
    expect(validateSelection(catalog(), { ...base, planKey: "trial" })).toBe("not_self_service");
    expect(validateSelection(catalog(), { ...base, planKey: "inconnue" })).toBe("unknown_plan");
  });

  it("l'App seule demande une app parmi celles proposées", () => {
    const base = { planKey: "app", options: [], storageUnits: 0, billingPeriod: "monthly" as const };
    expect(validateSelection(catalog(), { ...base, chosenModule: null })).toBe("module_choice_required");
    expect(validateSelection(catalog(), { ...base, chosenModule: "events" })).toBe("invalid_module_choice");
    expect(validateSelection(catalog(), { ...base, chosenModule: plan("app").moduleChoice[0]! })).toBeNull();
  });

  it("les options ne s'ajoutent qu'à une suite, et seulement celles du catalogue", () => {
    const base = { chosenModule: plan("app").moduleChoice[0]!, storageUnits: 0, billingPeriod: "monthly" as const };
    expect(validateSelection(catalog(), { ...base, planKey: "app", options: ["guests"] })).toBe("options_not_allowed");
    expect(validateSelection(catalog(), { ...base, planKey: "solo", chosenModule: null, options: ["inconnue"] })).toBe("unknown_option");
    expect(validateSelection(catalog(), { ...base, planKey: "solo", chosenModule: null, options: ["storage"] })).toBe("unknown_option");
    expect(validateSelection(catalog(), { ...base, planKey: "solo", chosenModule: null, options: ["guests", "appointments"] })).toBeNull();
  });

  it("le stockage supplémentaire se compte en tranches, sur une suite seulement", () => {
    const base = { chosenModule: null, options: [], billingPeriod: "monthly" as const };
    expect(validateSelection(catalog(), { ...base, planKey: "solo", storageUnits: 2 })).toBeNull();
    expect(validateSelection(catalog(), { ...base, planKey: "solo", storageUnits: -1 })).toBe("invalid_storage_units");
    expect(validateSelection(catalog(), { ...base, planKey: "solo", storageUnits: 1.5 })).toBe("invalid_storage_units");
    expect(validateSelection(catalog(), { ...base, planKey: "app", chosenModule: plan("app").moduleChoice[0]!, storageUnits: 1 })).toBe("options_not_allowed");
  });

  it("la période annuelle n'existe que pour une offre qui a un prix annuel", () => {
    const base = { chosenModule: null, options: [], storageUnits: 0, billingPeriod: "yearly" as const };
    expect(validateSelection(catalog(), { ...base, planKey: "solo" })).toBeNull();
    expect(validateSelection(catalog(), { ...base, planKey: "agency" })).toBe("yearly_unavailable");
  });

  it("le total additionne l'offre, les options et les tranches, au mois ; à l'année, prix annuel et options sur douze mois", () => {
    const monthly = subscriptionPrice(catalog(), { planKey: "solo", options: ["guests"], storageUnits: 2, billingPeriod: "monthly" });
    expect(monthly.totalCents).toBe(plan("solo").monthlyPriceCents + option("guests").monthlyPriceCents + 2 * option("storage").monthlyPriceCents);
    expect(monthly.period).toBe("monthly");
    const yearly = subscriptionPrice(catalog(), { planKey: "solo", options: ["guests"], storageUnits: 0, billingPeriod: "yearly" });
    expect(yearly.totalCents).toBe(plan("solo").yearlyPriceCents! + 12 * option("guests").monthlyPriceCents);
  });

  it("un prix changé par l'Exploitation change le total, sans code", () => {
    const changed = catalog();
    changed.plans = changed.plans.map((entry) => (entry.key === "solo" ? { ...entry, monthlyPriceCents: entry.monthlyPriceCents + 100 } : entry));
    expect(subscriptionPrice(changed, { planKey: "solo", options: [], storageUnits: 0, billingPeriod: "monthly" }).totalCents).toBe(plan("solo").monthlyPriceCents + 100);
  });

  it("prorata : un changement à mi-période reporte la moitié de l'écart sur la facture suivante, arrondi au centime", () => {
    const start = new Date("2026-11-01T00:00:00Z");
    const end = new Date("2026-12-01T00:00:00Z");
    const middle = new Date("2026-11-16T00:00:00Z");
    expect(prorataCents({ fromCents: 4900, toCents: 9900, periodStart: start, periodEnd: end, now: middle })).toBe(2500);
    expect(prorataCents({ fromCents: 9900, toCents: 4900, periodStart: start, periodEnd: end, now: middle })).toBe(-2500);
    expect(prorataCents({ fromCents: 4900, toCents: 9900, periodStart: start, periodEnd: end, now: end })).toBe(0);
    expect(prorataCents({ fromCents: 1, toCents: 2, periodStart: start, periodEnd: end, now: new Date("2026-11-11T00:00:00Z") })).toBe(1);
  });
});

describe("HUB-27 — Essai de 30 jours et rappels (horloge simulée)", () => {
  const rules = catalog().rules;

  it("commencé le 19 novembre à 15 h, l'essai finit le 19 décembre à minuit (Paris)", () => {
    expect(trialEndsAt(new Date("2026-11-19T14:00:00Z"), rules).toISOString()).toBe("2026-12-18T23:00:00.000Z");
  });

  it("passage à l'heure d'été : commencé le 10 mars, l'essai finit le 9 avril à minuit d'été (22 h UTC)", () => {
    expect(trialEndsAt(new Date("2027-03-10T10:00:00Z"), rules).toISOString()).toBe("2027-04-08T22:00:00.000Z");
  });

  it("rappel à J-7 la semaine d'avant, puis à J-1 la veille ; rien avant J-7 ni après la fin", () => {
    const end = new Date("2026-12-18T23:00:00Z");
    expect(trialReminderDue(end, new Date("2026-12-11T22:59:59Z"), rules)).toBeNull();
    expect(trialReminderDue(end, new Date("2026-12-11T23:00:00Z"), rules)).toBe(7);
    expect(trialReminderDue(end, new Date("2026-12-17T22:59:59Z"), rules)).toBe(7);
    // La veille : J-1 seulement, même si J-7 n'est jamais parti (serveur arrêté).
    expect(trialReminderDue(end, new Date("2026-12-17T23:00:00Z"), rules)).toBe(1);
    expect(trialReminderDue(end, new Date("2026-12-18T22:59:59Z"), rules)).toBe(1);
    expect(trialReminderDue(end, end, rules)).toBeNull();
  });

  it("les jours de rappel viennent des données : un catalogue sans rappel n'en envoie aucun", () => {
    const end = new Date("2026-12-18T23:00:00Z");
    expect(trialReminderDue(end, new Date("2026-12-18T12:00:00Z"), { ...rules, trialReminderDays: [] })).toBeNull();
  });
});

describe("HUB-27 — Périodes et résiliation (horloge simulée)", () => {
  it("une période mensuelle finit le même jour du mois suivant, à minuit (Paris) ; le 31 janvier donne fin février", () => {
    expect(addBillingPeriod(new Date("2026-11-19T14:00:00Z"), "monthly").toISOString()).toBe("2026-12-18T23:00:00.000Z");
    expect(addBillingPeriod(new Date("2027-01-31T10:00:00Z"), "monthly").toISOString()).toBe("2027-02-27T23:00:00.000Z");
    expect(addBillingPeriod(new Date("2026-11-19T14:00:00Z"), "yearly").toISOString()).toBe("2027-11-18T23:00:00.000Z");
  });

  it("la résiliation prend effet à la fin de la période payée ; d'un essai, à sa fin ; en lecture seule, tout de suite", () => {
    const now = new Date("2026-11-25T10:00:00Z");
    expect(cancellationEffectiveAt(record({ status: "active" }), now)).toEqual(new Date("2026-12-18T23:00:00Z"));
    expect(cancellationEffectiveAt(record({ status: "trial", trialEndsAt: new Date("2026-12-01T23:00:00Z"), currentPeriodEnd: null }), now)).toEqual(new Date("2026-12-01T23:00:00Z"));
    expect(cancellationEffectiveAt(record({ status: "read_only" }), now)).toEqual(now);
    // Une période déjà passée (le passage de renouvellement n'est pas encore venu) : tout de suite.
    expect(cancellationEffectiveAt(record({ status: "active", currentPeriodEnd: new Date("2026-11-20T00:00:00Z") }), now)).toEqual(now);
  });
});

describe("DOC-06 — Quota de stockage par offre (horloge simulée)", () => {
  const rules = catalog().rules;
  const GB = 1024 ** 3;

  it("le quota de l'offre s'ajoute des tranches de stockage ; le forfait Pilote n'a pas de quota", () => {
    expect(storageQuotaBytes(catalog(), record({ planKey: "solo", storageUnits: 2 }))).toBe(plan("solo").storageQuotaBytes! + 2 * option("storage").storageUnitBytes!);
    expect(storageQuotaBytes(catalog(), record({ planKey: "pilot" }))).toBeNull();
    expect(quotaPercent(5 * GB, 10 * GB)).toBe(50);
    expect(quotaPercent(5 * GB, null)).toBeNull();
  });

  it("80 % puis 95 % préviennent chacun une fois ; redescendre sous un palier le réarme", () => {
    const t0 = new Date("2026-11-19T10:00:00Z");
    let step = nextQuotaState(initialQuotaState(), { usedBytes: 8 * GB, quotaBytes: 10 * GB, now: t0, rules });
    expect(step.alerts).toEqual([80]);
    step = nextQuotaState(step.state, { usedBytes: 8.1 * GB, quotaBytes: 10 * GB, now: t0, rules });
    expect(step.alerts).toEqual([]);
    step = nextQuotaState(step.state, { usedBytes: 9.6 * GB, quotaBytes: 10 * GB, now: t0, rules });
    expect(step.alerts).toEqual([95]);
    step = nextQuotaState(step.state, { usedBytes: 7 * GB, quotaBytes: 10 * GB, now: t0, rules });
    expect(step.alerts).toEqual([]);
    expect(step.state.alertedPercents).toEqual([]);
    step = nextQuotaState(step.state, { usedBytes: 9.7 * GB, quotaBytes: 10 * GB, now: t0, rules });
    // D'un coup au-dessus des deux paliers : une seule alerte, la plus haute.
    expect(step.alerts).toEqual([95]);
    expect(step.state.alertedPercents).toEqual([80, 95]);
  });

  it("à 100 %, le préavis de sept jours commence : aucun dépôt refusé avant, refusés à partir du huitième jour à minuit", () => {
    const full = new Date("2026-11-19T14:00:00Z");
    const step = nextQuotaState(initialQuotaState(), { usedBytes: 10 * GB, quotaBytes: 10 * GB, now: full, rules });
    expect(step.alerts).toEqual([100]);
    expect(step.state.fullSince).toEqual(full);
    expect(step.state.uploadsBlockedFrom?.toISOString()).toBe("2026-11-25T23:00:00.000Z");
    expect(uploadsBlocked(step.state, full)).toBe(false);
    expect(uploadsBlocked(step.state, new Date("2026-11-25T22:59:59Z"))).toBe(false);
    expect(uploadsBlocked(step.state, new Date("2026-11-25T23:00:00Z"))).toBe(true);
    // Le préavis ne repart pas à chaque mesure.
    const later = nextQuotaState(step.state, { usedBytes: 11 * GB, quotaBytes: 10 * GB, now: new Date("2026-11-22T10:00:00Z"), rules });
    expect(later.alerts).toEqual([]);
    expect(later.state.uploadsBlockedFrom?.toISOString()).toBe("2026-11-25T23:00:00.000Z");
  });

  it("repasser sous le quota (fichiers supprimés, tranche ajoutée) lève le blocage et le préavis", () => {
    const full = nextQuotaState(initialQuotaState(), { usedBytes: 10 * GB, quotaBytes: 10 * GB, now: new Date("2026-11-19T14:00:00Z"), rules });
    const freed = nextQuotaState(full.state, { usedBytes: 10 * GB, quotaBytes: 60 * GB, now: new Date("2026-11-30T10:00:00Z"), rules });
    expect(freed.state.fullSince).toBeNull();
    expect(freed.state.uploadsBlockedFrom).toBeNull();
    expect(uploadsBlocked(freed.state, new Date("2026-11-30T10:00:00Z"))).toBe(false);
  });

  it("sans quota (forfait Pilote), ni alerte ni blocage", () => {
    const step = nextQuotaState(initialQuotaState(), { usedBytes: 500 * GB, quotaBytes: null, now: new Date("2026-11-19T14:00:00Z"), rules });
    expect(step.alerts).toEqual([]);
    expect(uploadsBlocked(step.state, new Date("2027-01-01T00:00:00Z"))).toBe(false);
  });

  it("passage à l'heure d'été pendant le préavis : plein le 25 mars, refus à partir du 1er avril à minuit d'été", () => {
    const step = nextQuotaState(initialQuotaState(), { usedBytes: 10 * GB, quotaBytes: 10 * GB, now: new Date("2027-03-25T10:00:00Z"), rules });
    expect(step.state.uploadsBlockedFrom?.toISOString()).toBe("2027-03-31T22:00:00.000Z");
  });
});
