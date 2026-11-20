// Lot 54 (HUB-27, ARC-06, DOC-06 ; décision D3 de Julien du 19/11/2026 ; ADR 0101) — catalogue des
// offres et des options. Tant que l'Exploitation n'a rien changé, c'est le catalogue de départ
// (plans.json) ; à sa première modification, il est copié dans hub.plans et hub.plan_modules, puis
// lu de là. Toute modification est validée en entier (une seule offre d'essai, un seul forfait Pilote,
// jamais en libre-service) avant d'être écrite. Prix, quotas et règles : des données, jamais du code.
import { asc, eq } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { planModules, plans, platformSettings } from "@symbola/db/schema/hub";
import { withActorContext } from "@symbola/db/with-organization";
import { planCatalogSchema, planRulesSchema, starterPlanCatalog, type OptionEntry, type PlanCatalog, type PlanEntry, type PlanRules } from "@symbola/starter-templates";

export class InvalidPlanCatalogError extends Error {}

export type PlanCatalogSource = "starter" | "admin";

function rowsToCatalog(rows: (typeof plans.$inferSelect)[], moduleRows: (typeof planModules.$inferSelect)[], rules: PlanRules): PlanCatalog {
  const modulesOf = (key: string, role: string) => moduleRows.filter((row) => row.planKey === key && row.role === role).map((row) => row.moduleKey).sort();
  const catalog: PlanCatalog = { version: 1, currency: "EUR", rules, plans: [], options: [] };
  for (const row of rows) {
    const labels = { fr: row.labelFr, en: row.labelEn };
    const descriptions = { fr: row.descriptionFr, en: row.descriptionEn };
    if (row.kind === "module_option" || row.kind === "storage_option") {
      const option: OptionEntry = {
        key: row.key,
        kind: row.kind === "module_option" ? "module" : "storage",
        labels,
        descriptions,
        module: row.kind === "module_option" ? (modulesOf(row.key, "option")[0] ?? null) : null,
        monthlyPriceCents: row.monthlyPriceCents,
        storageUnitBytes: row.storageUnitBytes,
        selfService: row.selfService,
      };
      catalog.options.push(option);
    } else {
      const plan: PlanEntry = {
        key: row.key,
        kind: row.kind,
        labels,
        descriptions,
        modules: modulesOf(row.key, "included"),
        moduleChoice: modulesOf(row.key, "choice"),
        monthlyPriceCents: row.monthlyPriceCents,
        yearlyPriceCents: row.yearlyPriceCents,
        maxUsers: row.maxUsers,
        storageQuotaBytes: row.storageQuotaBytes,
        optionsAllowed: row.optionsAllowed,
        selfService: row.selfService,
      };
      catalog.plans.push(plan);
    }
  }
  return catalog;
}

async function readRules(db: AppDatabase): Promise<{ rules: PlanRules; source: PlanCatalogSource }> {
  const [settings] = await db.select({ rules: platformSettings.subscriptionRules }).from(platformSettings).where(eq(platformSettings.id, 1));
  const parsed = settings?.rules ? planRulesSchema.safeParse(settings.rules) : null;
  return parsed?.success ? { rules: parsed.data, source: "admin" } : { rules: starterPlanCatalog().rules, source: "starter" };
}

// Le catalogue en vigueur et sa provenance (départ, ou réglé par l'Exploitation).
export async function getPlanCatalogWithSource(db: AppDatabase): Promise<{ catalog: PlanCatalog; source: PlanCatalogSource }> {
  const [rows, moduleRows, { rules, source: rulesSource }] = await Promise.all([db.select().from(plans).orderBy(asc(plans.position), asc(plans.key)), db.select().from(planModules), readRules(db)]);
  if (rows.length === 0) {
    const catalog = starterPlanCatalog();
    return { catalog: { ...catalog, rules }, source: rulesSource };
  }
  const parsed = planCatalogSchema.safeParse(rowsToCatalog(rows, moduleRows, rules));
  if (!parsed.success) {
    // Un catalogue en base illisible ne doit jamais ouvrir ni fermer de module : le départ fait foi,
    // et l'Exploitation est prévenue par le journal (motif technique seulement).
    console.error("catalogue des offres illisible : catalogue de départ utilisé", parsed.error.issues.length);
    return { catalog: { ...starterPlanCatalog(), rules }, source: "starter" };
  }
  return { catalog: parsed.data, source: "admin" };
}

export async function getPlanCatalog(db: AppDatabase): Promise<PlanCatalog> {
  return (await getPlanCatalogWithSource(db)).catalog;
}

// Écrit le catalogue entier (offres, options, modules), validé d'abord. Les offres et options ne se
// suppriment pas : une offre qu'on ne veut plus proposer sort du libre-service.
export async function savePlanCatalog(db: AppDatabase, input: { adminUserId: string; catalog: PlanCatalog }): Promise<void> {
  const parsed = planCatalogSchema.safeParse(input.catalog);
  if (!parsed.success) throw new InvalidPlanCatalogError(parsed.error.issues.map((issue) => issue.message).join(" ; "));
  const catalog = parsed.data;
  const current = await getPlanCatalog(db);
  const missing = [...current.plans, ...current.options].filter((entry) => ![...catalog.plans, ...catalog.options].some((next) => next.key === entry.key));
  if (missing.length > 0) throw new InvalidPlanCatalogError("une offre ou une option ne se supprime pas");
  await withActorContext(db, async (tx) => {
    let position = 0;
    for (const plan of catalog.plans) {
      const values = {
        kind: plan.kind,
        position: position++,
        labelFr: plan.labels.fr,
        labelEn: plan.labels.en,
        descriptionFr: plan.descriptions.fr,
        descriptionEn: plan.descriptions.en,
        monthlyPriceCents: plan.monthlyPriceCents,
        yearlyPriceCents: plan.yearlyPriceCents,
        maxUsers: plan.maxUsers,
        storageQuotaBytes: plan.storageQuotaBytes,
        storageUnitBytes: null,
        optionsAllowed: plan.optionsAllowed,
        selfService: plan.selfService,
      };
      await tx.insert(plans).values({ key: plan.key, ...values }).onConflictDoUpdate({ target: plans.key, set: values });
      await tx.delete(planModules).where(eq(planModules.planKey, plan.key));
      const moduleRows = [...plan.modules.map((moduleKey) => ({ moduleKey, role: "included" as const })), ...plan.moduleChoice.map((moduleKey) => ({ moduleKey, role: "choice" as const }))];
      if (moduleRows.length > 0) await tx.insert(planModules).values(moduleRows.map((row) => ({ planKey: plan.key, ...row })));
    }
    for (const option of catalog.options) {
      const values = {
        kind: option.kind === "module" ? ("module_option" as const) : ("storage_option" as const),
        position: position++,
        labelFr: option.labels.fr,
        labelEn: option.labels.en,
        descriptionFr: option.descriptions.fr,
        descriptionEn: option.descriptions.en,
        monthlyPriceCents: option.monthlyPriceCents,
        yearlyPriceCents: null,
        maxUsers: null,
        storageQuotaBytes: null,
        storageUnitBytes: option.storageUnitBytes,
        optionsAllowed: false,
        selfService: option.selfService,
      };
      await tx.insert(plans).values({ key: option.key, ...values }).onConflictDoUpdate({ target: plans.key, set: values });
      await tx.delete(planModules).where(eq(planModules.planKey, option.key));
      if (option.module) await tx.insert(planModules).values({ planKey: option.key, moduleKey: option.module, role: "option" });
    }
    await tx.insert(platformSettings).values({ id: 1, subscriptionRules: catalog.rules }).onConflictDoUpdate({ target: platformSettings.id, set: { subscriptionRules: catalog.rules } });
  });
  await recordAudit(db, { organizationId: null, action: "hub.plan_catalog.updated", actor: { kind: "admin", id: input.adminUserId } });
}

// D1 (ADR 0087, 0101) : la facturation des abonnements par l'éditeur reste éteinte tant que la
// société n'est pas créée. Aucune facture n'est émise ni envoyée tant que ce réglage est faux.
export async function isSubscriptionBillingEnabled(db: AppDatabase): Promise<boolean> {
  const [settings] = await db.select({ enabled: platformSettings.subscriptionBillingEnabled }).from(platformSettings).where(eq(platformSettings.id, 1));
  return settings?.enabled ?? false;
}
