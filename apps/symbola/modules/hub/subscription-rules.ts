// Lot 54 (HUB-27, ARC-06, DOC-06 ; ADR 0101) — règles pures de l'abonnement : droits d'usage d'une
// offre (modules ouverts), validation d'un choix, total et prorata, calendrier de l'essai et des
// périodes, échéance d'une résiliation, paliers du quota de stockage. Aucune valeur métier ici : les
// prix, quotas, jours de rappel et paliers viennent du catalogue (plans.json, puis l'Exploitation).
// Les dates suivent les minuits de Paris, changement d'heure compris.
import type { OptionEntry, PlanCatalog, PlanEntry, PlanRules } from "@symbola/starter-templates";
import { parisCalendarDate, parisMidnight } from "./closure-schedule";

export const SUBSCRIPTION_STATUSES = ["trial", "active", "read_only", "cancelled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const BILLING_PERIODS = ["monthly", "yearly"] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export type SubscriptionSelection = {
  planKey: string;
  chosenModule: string | null;
  options: string[];
  storageUnits: number;
  billingPeriod: BillingPeriod;
};

export type SubscriptionRecord = SubscriptionSelection & {
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelEffectiveAt: Date | null;
};

export type SelectionProblem =
  | "unknown_plan"
  | "not_self_service"
  | "module_choice_required"
  | "invalid_module_choice"
  | "options_not_allowed"
  | "unknown_option"
  | "invalid_storage_units"
  | "yearly_unavailable";

export function findPlan(catalog: PlanCatalog, key: string): PlanEntry | null {
  return catalog.plans.find((plan) => plan.key === key) ?? null;
}

export function findOption(catalog: PlanCatalog, key: string): OptionEntry | null {
  return catalog.options.find((option) => option.key === key) ?? null;
}

export function storageOption(catalog: PlanCatalog): OptionEntry | null {
  return catalog.options.find((option) => option.kind === "storage") ?? null;
}

// Les modules ouverts par l'offre : ses modules, l'app choisie (App seule), les options de module
// d'une suite. Seules les clés connues de l'app comptent (refus par défaut).
export function entitledModules<K extends string>(catalog: PlanCatalog, subscription: SubscriptionSelection, knownModules: readonly K[]): Set<K> {
  const plan = findPlan(catalog, subscription.planKey);
  const modules = new Set<string>();
  if (plan) {
    for (const moduleKey of plan.modules) modules.add(moduleKey);
    if (subscription.chosenModule && plan.moduleChoice.includes(subscription.chosenModule)) modules.add(subscription.chosenModule);
    if (plan.optionsAllowed) {
      for (const optionKey of subscription.options) {
        const option = findOption(catalog, optionKey);
        if (option?.kind === "module" && option.module) modules.add(option.module);
      }
    }
  }
  return new Set(knownModules.filter((moduleKey) => modules.has(moduleKey)));
}

// Un choix fait en libre-service (« Mon abonnement ») : l'offre et ses options doivent être proposées.
export function validateSelection(catalog: PlanCatalog, selection: SubscriptionSelection): SelectionProblem | null {
  const plan = findPlan(catalog, selection.planKey);
  if (!plan) return "unknown_plan";
  if (plan.kind !== "plan" || !plan.selfService) return "not_self_service";
  if (plan.moduleChoice.length > 0) {
    if (!selection.chosenModule) return "module_choice_required";
    if (!plan.moduleChoice.includes(selection.chosenModule)) return "invalid_module_choice";
  }
  if (!Number.isInteger(selection.storageUnits) || selection.storageUnits < 0 || selection.storageUnits > 1000) return "invalid_storage_units";
  if (!plan.optionsAllowed && (selection.options.length > 0 || selection.storageUnits > 0)) return "options_not_allowed";
  for (const optionKey of selection.options) {
    const option = findOption(catalog, optionKey);
    if (!option || option.kind !== "module" || !option.selfService) return "unknown_option";
  }
  if (selection.storageUnits > 0 && !storageOption(catalog)?.selfService) return "unknown_option";
  if (selection.billingPeriod === "yearly" && plan.yearlyPriceCents === null) return "yearly_unavailable";
  return null;
}

export type SubscriptionPrice = { period: BillingPeriod; planCents: number; optionsCents: number; storageCents: number; totalCents: number };

// Le prix d'une période : l'offre (au mois, ou son prix annuel), les options et les tranches de
// stockage au mois, sur douze mois pour une période annuelle. Centimes HT, en EUR.
export function subscriptionPrice(catalog: PlanCatalog, selection: Omit<SubscriptionSelection, "chosenModule">): SubscriptionPrice {
  const plan = findPlan(catalog, selection.planKey);
  const months = selection.billingPeriod === "yearly" ? 12 : 1;
  const planCents = !plan ? 0 : selection.billingPeriod === "yearly" && plan.yearlyPriceCents !== null ? plan.yearlyPriceCents : plan.monthlyPriceCents * months;
  const optionsCents = selection.options.reduce((sum, key) => {
    const option = findOption(catalog, key);
    return option?.kind === "module" ? sum + option.monthlyPriceCents * months : sum;
  }, 0);
  const storageCents = (storageOption(catalog)?.monthlyPriceCents ?? 0) * selection.storageUnits * months;
  return { period: selection.billingPeriod, planCents, optionsCents, storageCents, totalCents: planCents + optionsCents + storageCents };
}

// Écart au prorata du temps qui reste dans la période, reporté sur la facture suivante (positif : à
// payer en plus ; négatif : à déduire). Arrondi au centime le plus proche.
export function prorataCents(input: { fromCents: number; toCents: number; periodStart: Date; periodEnd: Date; now: Date }): number {
  const total = input.periodEnd.getTime() - input.periodStart.getTime();
  if (total <= 0) return 0;
  const remaining = Math.min(Math.max(input.periodEnd.getTime() - input.now.getTime(), 0), total);
  const value = Math.round(((input.toCents - input.fromCents) * remaining) / total);
  return value === 0 ? 0 : value;
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function addCalendarMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

// Fin de l'essai : minuit (Paris) du jour de début + la durée de l'essai.
export function trialEndsAt(startedAt: Date, rules: PlanRules): Date {
  return parisMidnight(addCalendarDays(parisCalendarDate(startedAt), rules.trialDays));
}

// Le rappel à envoyer maintenant (nombre de jours avant la fin), ou null : le plus proche de la fin
// parmi ceux dont le jour est venu, pour ne jamais envoyer J-7 après J-1.
export function trialReminderDue(endsAt: Date, now: Date, rules: PlanRules): number | null {
  if (now >= endsAt) return null;
  const endDay = parisCalendarDate(endsAt);
  const due = rules.trialReminderDays.filter((days) => now >= parisMidnight(addCalendarDays(endDay, -days)));
  return due.length === 0 ? null : Math.min(...due);
}

// Fin d'une période commencée à `start` : minuit (Paris) du même jour le mois (ou l'an) suivant,
// ramené au dernier jour d'un mois plus court.
export function addBillingPeriod(start: Date, period: BillingPeriod): Date {
  return parisMidnight(addCalendarMonths(parisCalendarDate(start), period === "yearly" ? 12 : 1));
}

// L'accès reste jusqu'à la fin de la période payée (ou de l'essai) ; en lecture seule, plus rien
// n'est payé : la fermeture commence tout de suite.
export function cancellationEffectiveAt(subscription: Pick<SubscriptionRecord, "status" | "trialEndsAt" | "currentPeriodEnd">, now: Date): Date {
  const end = subscription.status === "trial" ? subscription.trialEndsAt : subscription.status === "active" ? subscription.currentPeriodEnd : null;
  return end && end > now ? end : now;
}

// Quota de l'offre, plus les tranches de stockage ; null : pas de quota (forfait Pilote).
export function storageQuotaBytes(catalog: PlanCatalog, subscription: Pick<SubscriptionSelection, "planKey" | "storageUnits">): number | null {
  const plan = findPlan(catalog, subscription.planKey);
  if (!plan || plan.storageQuotaBytes === null) return null;
  return plan.storageQuotaBytes + subscription.storageUnits * (storageOption(catalog)?.storageUnitBytes ?? 0);
}

export function quotaPercent(usedBytes: number, quotaBytes: number | null): number | null {
  if (quotaBytes === null) return null;
  if (quotaBytes <= 0) return 100;
  return Math.floor((usedBytes / quotaBytes) * 100);
}

export type QuotaState = { alertedPercents: number[]; fullSince: Date | null; uploadsBlockedFrom: Date | null };

export function initialQuotaState(): QuotaState {
  return { alertedPercents: [], fullSince: null, uploadsBlockedFrom: null };
}

// Une mesure : les paliers franchis à la hausse (une alerte, la plus haute), et à 100 % le début du
// préavis (dépôts refusés à minuit, Paris, au bout des jours de préavis). Repasser sous un palier le
// réarme ; sous 100 %, le préavis tombe.
export function nextQuotaState(previous: QuotaState, input: { usedBytes: number; quotaBytes: number | null; now: Date; rules: PlanRules }): { state: QuotaState; alerts: number[] } {
  const percent = quotaPercent(input.usedBytes, input.quotaBytes);
  if (percent === null) return { state: initialQuotaState(), alerts: [] };
  const thresholds = [...input.rules.quotaAlertPercents].sort((a, b) => a - b);
  const reached = thresholds.filter((threshold) => percent >= threshold);
  const fresh = reached.filter((threshold) => !previous.alertedPercents.includes(threshold));
  const alerts: number[] = [];
  let fullSince: Date | null = null;
  let uploadsBlockedFrom: Date | null = null;
  if (percent >= 100) {
    fullSince = previous.fullSince ?? input.now;
    uploadsBlockedFrom = previous.fullSince && previous.uploadsBlockedFrom ? previous.uploadsBlockedFrom : parisMidnight(addCalendarDays(parisCalendarDate(fullSince), input.rules.quotaBlockNoticeDays));
    if (!previous.fullSince) alerts.push(100);
  } else if (fresh.length > 0) {
    alerts.push(Math.max(...fresh));
  }
  return { state: { alertedPercents: reached, fullSince, uploadsBlockedFrom }, alerts };
}

export function uploadsBlocked(state: Pick<QuotaState, "uploadsBlockedFrom">, now: Date): boolean {
  return state.uploadsBlockedFrom !== null && now >= state.uploadsBlockedFrom;
}
