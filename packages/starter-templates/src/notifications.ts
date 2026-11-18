// Lot 53 (HUB-15, UX-16, HUB-28, GC-02, CHR-05, HUB-24 ; D1, D2, D5, D7, D8 ; ADR 0095) — données de
// départ des notifications, des automatismes, du radar des risques, de la santé du planning et des
// termes proposés pour désigner les clients. Aucune de ces valeurs n'est écrite dans le code
// (CLAUDE.md § 2.6) ; l'organisation ou la personne les règle ensuite.
import { z } from "zod";
import automationsFile from "./automations.json";
import clientTermsFile from "./client-terms.json";
import notificationsFile from "./notifications.json";
import planningHealthFile from "./planning-health.json";
import riskRadarFile from "./risk-radar.json";

const channels = z.object({ app: z.boolean(), email: z.boolean(), push: z.boolean() });
const notificationsSchema = z.object({
  version: z.literal(1),
  types: z.record(z.string().regex(/^[a-z_]+$/), z.object({ immediate: z.boolean(), dayOf: z.boolean(), channels })),
  settings: z.object({
    digestEnabled: z.boolean(),
    digestHour: z.number().int().min(0).max(23),
    quietEnabled: z.boolean(),
    quietStartMinute: z.number().int().min(0).max(1439),
    quietEndMinute: z.number().int().min(0).max(1439),
    quietSundays: z.boolean(),
    dayOfOverride: z.boolean(),
    timeZone: z.string().min(1),
  }),
  retention: z.object({ notificationDays: z.number().int().min(1), pushSubscriptionIdleDays: z.number().int().min(1), automationRunDays: z.number().int().min(1) }),
});
export type StarterNotifications = z.infer<typeof notificationsSchema>;
const notifications = notificationsSchema.parse(notificationsFile);

export function starterNotifications(): StarterNotifications {
  return structuredClone(notifications);
}

const automationsSchema = z.object({
  version: z.literal(1),
  automations: z.record(z.string().regex(/^[a-z_]+$/), z.object({ enabled: z.boolean(), days: z.number().int().min(1).max(60).nullable() })),
});
const automations = automationsSchema.parse(automationsFile);

export function starterAutomations(): Record<string, { enabled: boolean; days: number | null }> {
  return structuredClone(automations.automations);
}

const riskRadarSchema = z.object({
  version: z.literal(1),
  runHour: z.number().int().min(0).max(23),
  rules: z.record(z.string().regex(/^[a-z_]+$/), z.object({ enabled: z.boolean(), thresholdDays: z.number().int().min(0).max(365) })),
});
const riskRadar = riskRadarSchema.parse(riskRadarFile);

export function starterRiskRules(): Record<string, { enabled: boolean; thresholdDays: number }> {
  return structuredClone(riskRadar.rules);
}

// Heure (Paris) à partir de laquelle le radar passe chaque matin.
export function starterRiskRadarHour(): number {
  return riskRadar.runHour;
}

const planningHealthSchema = z.object({
  version: z.literal(1),
  watchPoints: z.number().int().min(1).max(100),
  latePoints: z.number().int().min(1).max(100),
  milestoneWeight: z.number().int().min(1).max(10),
});
const planningHealth = planningHealthSchema.parse(planningHealthFile);

export function starterPlanningHealth(): { watchPoints: number; latePoints: number; milestoneWeight: number } {
  return { watchPoints: planningHealth.watchPoints, latePoints: planningHealth.latePoints, milestoneWeight: planningHealth.milestoneWeight };
}

const termSchema = z.object({ term: z.string().min(1).max(40), gender: z.enum(["masculine", "feminine", "neuter"]), number: z.enum(["singular", "plural"]) });
const clientTermsSchema = z.object({
  version: z.literal(1),
  terms: z.array(z.object({ key: z.string().regex(/^[a-z_]+$/), fr: termSchema, en: termSchema })).min(1),
});
const clientTerms = clientTermsSchema.parse(clientTermsFile);

export type StarterClientTerm = z.infer<typeof termSchema>;

export function starterClientTerms(locale: "fr" | "en"): (StarterClientTerm & { key: string })[] {
  return clientTerms.terms.map((entry) => ({ key: entry.key, ...entry[locale] }));
}
