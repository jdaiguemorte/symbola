// Lot 53 (HUB-28, GC-02 ; D5, D7 ; ADR 0095) — automatismes prêts à activer et règles du radar des
// risques, dans le hub. Exposé seulement par service.ts (ADR 0011).
//
// - Chaque automatisme s'active, se coupe et laisse une trace (HUB-28). Couper arrête les envois à
//   venir ; à la remise en route, rien n'est rattrapé (D5) : la date de remise en route (resumed_at)
//   borne ce que l'automatisme peut encore faire (automationCovers). La purge RGPD et le contrôle de la
//   chaîne des pièces ne se coupent pas (ALWAYS_ON_AUTOMATIONS).
// - Les règles du radar ont un seuil réglable (GC-02) ; sans réglage, la valeur de départ
//   (risk-radar.json).
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { automationRuns, automations, riskRules } from "@symbola/db/schema/hub";
import { AUTOMATION_KEYS, RISK_RULES, automationDaysSchema, riskThresholdSchema, type AutomationKey, type AutomationResult, type AutomationRunView, type RiskRuleKey } from "@symbola/contracts";
import { starterAutomations, starterRiskRules } from "@symbola/starter-templates";
import { notificationRetentionDays } from "./notification-rules";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
const RUNS_SHOWN = 10;

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export class AutomationInputError extends Error {
  constructor(readonly reason: "key" | "days" | "rule" | "threshold") {
    super("réglage d'automatisme refusé");
    this.name = "AutomationInputError";
  }
}

function assertKey(key: string): asserts key is AutomationKey {
  if (!(AUTOMATION_KEYS as readonly string[]).includes(key)) throw new AutomationInputError("key");
}

export type AutomationGate = { key: AutomationKey; enabled: boolean; days: number | null; resumedAt: Date | null };

export async function getAutomationGate(organizationId: string, key: AutomationKey): Promise<AutomationGate> {
  assertKey(key);
  const starter = starterAutomations()[key] ?? { enabled: true, days: null };
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(automations).where(and(eq(automations.organizationId, organizationId), eq(automations.key, key))));
  return { key, enabled: row?.enabled ?? starter.enabled, days: row?.days ?? starter.days, resumedAt: row?.resumedAt ?? null };
}

export async function listAutomationGates(organizationId: string): Promise<AutomationGate[]> {
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(automations).where(eq(automations.organizationId, organizationId)));
  const starter = starterAutomations();
  return AUTOMATION_KEYS.map((key) => {
    const row = rows.find((candidate) => candidate.key === key);
    return { key, enabled: row?.enabled ?? starter[key]?.enabled ?? true, days: row?.days ?? starter[key]?.days ?? null, resumedAt: row?.resumedAt ?? null };
  });
}

// D5 : un fait dû avant la remise en route n'est jamais rattrapé. dueAt : quand l'automatisme aurait dû
// agir (jour d'envoi d'un rappel, signature d'un devis).
export function automationCovers(gate: AutomationGate, dueAt: Date | string): boolean {
  if (!gate.enabled) return false;
  if (!gate.resumedAt) return true;
  const due = typeof dueAt === "string" ? new Date(dueAt.length === 10 ? `${dueAt}T23:59:59Z` : dueAt) : dueAt;
  return due.getTime() >= gate.resumedAt.getTime();
}

export async function setAutomationEnabled(organizationId: string, key: string, enabled: boolean, now: Date = new Date()): Promise<AutomationGate> {
  assertKey(key);
  const current = await getAutomationGate(organizationId, key);
  // Remise en route : la date borne ce que l'automatisme peut faire ; rester actif ne la change pas.
  const resumedAt = enabled && !current.enabled ? now : current.resumedAt;
  await inOrganization(organizationId, async (tx) => {
    await tx
      .insert(automations)
      .values({ organizationId, key, enabled, days: current.days, resumedAt })
      .onConflictDoUpdate({ target: [automations.organizationId, automations.key], set: { enabled, resumedAt, updatedAt: now } });
  });
  return { ...current, enabled, resumedAt };
}

export async function setAutomationDays(organizationId: string, key: string, days: number): Promise<AutomationGate> {
  assertKey(key);
  const current = await getAutomationGate(organizationId, key);
  if (current.days === null || !automationDaysSchema.safeParse(days).success) throw new AutomationInputError("days");
  await inOrganization(organizationId, async (tx) => {
    await tx
      .insert(automations)
      .values({ organizationId, key, enabled: current.enabled, days, resumedAt: current.resumedAt })
      .onConflictDoUpdate({ target: [automations.organizationId, automations.key], set: { days, updatedAt: new Date() } });
  });
  return { ...current, days };
}

// Le radar passe une fois par matin : true si ce passage est le premier du jour.
export async function claimDailyAutomationRun(organizationId: string, key: AutomationKey, today: string): Promise<boolean> {
  assertKey(key);
  const gate = await getAutomationGate(organizationId, key);
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .insert(automations)
      .values({ organizationId, key, enabled: gate.enabled, days: gate.days, resumedAt: gate.resumedAt, lastRunOn: today })
      .onConflictDoUpdate({ target: [automations.organizationId, automations.key], set: { lastRunOn: today, updatedAt: new Date() }, setWhere: sqlNotRunOn(today) })
      .returning({ id: automations.id });
    return Boolean(row);
  });
}

// Ligne existante : seulement si le dernier passage n'est pas d'aujourd'hui.
function sqlNotRunOn(today: string) {
  return or(isNull(automations.lastRunOn), lt(automations.lastRunOn, today))!;
}

export type AutomationRunInput = { objectKey?: string | null; objectLabel?: string | null; href?: string | null; result: AutomationResult; ranAt?: Date };

export async function recordAutomationRun(organizationId: string, key: AutomationKey, input: AutomationRunInput): Promise<void> {
  assertKey(key);
  const href = input.href && /^\/[^/\\]/.test(input.href) && input.href.length <= 500 ? input.href : null;
  await inOrganization(organizationId, (tx) =>
    tx.insert(automationRuns).values({
      organizationId,
      key,
      objectKey: input.objectKey ?? null,
      objectLabel: input.objectLabel ? input.objectLabel.slice(0, 200) : null,
      href,
      result: input.result,
      ranAt: input.ranAt ?? new Date(),
    }),
  );
}

export async function listAutomationRuns(organizationId: string, key: AutomationKey): Promise<AutomationRunView[]> {
  assertKey(key);
  const rows = await inOrganization(organizationId, (tx) =>
    tx.select().from(automationRuns).where(and(eq(automationRuns.organizationId, organizationId), eq(automationRuns.key, key))).orderBy(desc(automationRuns.ranAt)).limit(RUNS_SHOWN),
  );
  return rows.map((row) => ({ id: row.id, ranAt: row.ranAt.toISOString(), result: row.result, objectLabel: row.objectLabel, href: row.href }));
}

export async function purgeAutomationRuns(organizationId: string, now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - notificationRetentionDays().automationRunDays * 24 * 60 * 60 * 1000);
  const rows = await inOrganization(organizationId, (tx) => tx.delete(automationRuns).where(and(eq(automationRuns.organizationId, organizationId), lt(automationRuns.ranAt, before))).returning({ id: automationRuns.id }));
  return rows.length;
}

// --- Règles du radar (GC-02, D7) ---

export type RiskRuleSetting = { rule: RiskRuleKey; enabled: boolean; thresholdDays: number };

export async function getRiskRules(organizationId: string): Promise<RiskRuleSetting[]> {
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(riskRules).where(eq(riskRules.organizationId, organizationId)));
  const starter = starterRiskRules();
  return RISK_RULES.map((rule) => {
    const row = rows.find((candidate) => candidate.rule === rule);
    return { rule, enabled: row?.enabled ?? starter[rule]?.enabled ?? true, thresholdDays: row?.thresholdDays ?? starter[rule]?.thresholdDays ?? 0 };
  });
}

export async function setRiskRule(organizationId: string, input: { rule: string; enabled: boolean; thresholdDays: number }): Promise<RiskRuleSetting> {
  if (!(RISK_RULES as readonly string[]).includes(input.rule)) throw new AutomationInputError("rule");
  if (!riskThresholdSchema.safeParse(input.thresholdDays).success) throw new AutomationInputError("threshold");
  const rule = input.rule as RiskRuleKey;
  await inOrganization(organizationId, async (tx) => {
    await tx
      .insert(riskRules)
      .values({ organizationId, rule, enabled: input.enabled, thresholdDays: input.thresholdDays })
      .onConflictDoUpdate({ target: [riskRules.organizationId, riskRules.rule], set: { enabled: input.enabled, thresholdDays: input.thresholdDays, updatedAt: new Date() } });
  });
  return { rule, enabled: input.enabled, thresholdDays: input.thresholdDays };
}
