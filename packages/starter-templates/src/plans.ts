// Lot 54 (HUB-27, ARC-06, DOC-06 ; ADR 0101) — catalogue de départ des offres et des modules en
// option : modules inclus, nombre d'utilisateurs, quota de stockage et prix (centimes HT, EUR), et les
// règles de l'essai et du quota. Des hypothèses de travail validées par Julien le 19/11/2026,
// modifiables par l'Exploitation sans code : aucun prix, quota ni libellé d'offre n'est écrit dans
// le code (HUB-20). Les clés de modules inconnues du registre de l'app (un module pas encore livré)
// sont ignorées par l'app : refus par défaut.
import { z } from "zod";
import plansFile from "./plans.json";

const localized = z.object({ fr: z.string().min(1).max(200), en: z.string().min(1).max(200) });
const localizedText = z.object({ fr: z.string().min(1).max(1000), en: z.string().min(1).max(1000) });
const cents = z.number().int().min(0).max(100_000_000);
const bytes = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const key = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);

export const PLAN_KINDS = ["trial", "plan", "pilot"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
export const OPTION_KINDS = ["module", "storage"] as const;
export type OptionKind = (typeof OPTION_KINDS)[number];

export const planEntrySchema = z.object({
  key,
  kind: z.enum(PLAN_KINDS),
  labels: localized,
  descriptions: localizedText,
  modules: z.array(key).max(30),
  moduleChoice: z.array(key).max(30),
  monthlyPriceCents: cents,
  yearlyPriceCents: cents.nullable(),
  maxUsers: z.number().int().min(1).max(10_000).nullable(),
  storageQuotaBytes: bytes.nullable(),
  optionsAllowed: z.boolean(),
  selfService: z.boolean(),
});
export type PlanEntry = z.infer<typeof planEntrySchema>;

export const optionEntrySchema = z
  .object({
    key,
    kind: z.enum(OPTION_KINDS),
    labels: localized,
    descriptions: localizedText,
    module: key.nullable(),
    monthlyPriceCents: cents,
    storageUnitBytes: bytes.min(1).nullable(),
    selfService: z.boolean(),
  })
  .refine((option) => (option.kind === "module" ? option.module !== null && option.storageUnitBytes === null : option.module === null && option.storageUnitBytes !== null), {
    message: "une option de module nomme son module ; une option de stockage, sa tranche",
  });
export type OptionEntry = z.infer<typeof optionEntrySchema>;

export const planRulesSchema = z.object({
  trialDays: z.number().int().min(1).max(365),
  trialReminderDays: z.array(z.number().int().min(1).max(60)).max(5),
  quotaAlertPercents: z.array(z.number().int().min(1).max(99)).max(5),
  quotaBlockNoticeDays: z.number().int().min(7).max(60),
});
export type PlanRules = z.infer<typeof planRulesSchema>;

export const planCatalogSchema = z
  .object({
    version: z.literal(1),
    currency: z.literal("EUR"),
    rules: planRulesSchema,
    plans: z.array(planEntrySchema).min(1).max(50),
    options: z.array(optionEntrySchema).max(50),
  })
  .refine((catalog) => new Set([...catalog.plans, ...catalog.options].map((entry) => entry.key)).size === catalog.plans.length + catalog.options.length, { message: "clés en double" })
  .refine((catalog) => catalog.plans.filter((plan) => plan.kind === "trial").length === 1, { message: "une seule offre d'essai" })
  .refine((catalog) => catalog.plans.filter((plan) => plan.kind === "pilot").length === 1, { message: "un seul forfait Pilote" })
  .refine((catalog) => catalog.plans.every((plan) => plan.kind === "plan" || !plan.selfService), { message: "l'essai et le forfait Pilote ne sont jamais en libre-service" });
export type PlanCatalog = z.infer<typeof planCatalogSchema>;

const starter = planCatalogSchema.parse(plansFile);

// Une copie : l'appelant peut la modifier sans toucher au modèle de départ.
export function starterPlanCatalog(): PlanCatalog {
  return structuredClone(starter);
}
