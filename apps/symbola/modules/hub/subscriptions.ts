// Lot 54 (HUB-27, ARC-06 ; décisions D1 à D3 de Julien du 19/11/2026 ; ADR 0101) — l'abonnement d'une
// organisation. Ses droits pilotent hub.organization_modules : un changement d'offre ou d'option ouvre
// ou ferme les modules à la requête suivante, sans redéploiement (ARC-06). L'essai dure 30 jours sans
// carte, avec des rappels à J-7 et J-1 ; à la fin, l'organisation passe en lecture seule, sans rien
// effacer, l'export toujours possible (D2). « Mon abonnement » : seule la Propriétaire change l'offre,
// avec effet immédiat, ou résilie ; l'accès reste jusqu'à la fin de la période payée, puis la
// fermeture du lot 35c s'applique (export pendant 30 jours, puis effacement). Paiement (D1) : facture
// de l'éditeur réglée par virement, éteinte tant que la société n'est pas créée (aucune facture
// envoyée). Une organisation sans abonnement reste réglée par l'Exploitation, comme avant le lot.
import { eq } from "drizzle-orm";
import { listTeam } from "@symbola/auth";
import { recordAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { organizationSubscriptions } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import type { PlanCatalog } from "@symbola/starter-templates";
import { MODULE_KEYS } from "./module-registry";
import { closeOrganizationAtSubscriptionEnd } from "./organization-closures";
import { getPlanCatalog } from "./plan-catalog";
import { upsertOrganizationModule } from "./repository";
import { refreshStorageQuota } from "./storage-quota";
import { notifyOwners } from "./subscription-mails";
import {
  addBillingPeriod,
  cancellationEffectiveAt,
  entitledModules,
  findPlan,
  prorataCents,
  subscriptionPrice,
  trialEndsAt,
  trialReminderDue,
  validateSelection,
  type SelectionProblem,
  type SubscriptionRecord,
  type SubscriptionSelection,
} from "./subscription-rules";

export class SubscriptionForbiddenError extends Error {}
export class SubscriptionSelectionError extends Error {
  constructor(readonly problem: SelectionProblem) {
    super(problem);
  }
}
// Le forfait Pilote (ou une offre posée par l'Exploitation hors libre-service) ne se change pas ici.
export class SubscriptionManagedError extends Error {}
// L'offre choisie admet moins d'utilisateurs que l'équipe n'en compte.
export class SubscriptionSeatsError extends Error {
  constructor(readonly maxUsers: number) {
    super("seats");
  }
}
export class SubscriptionNotCancellableError extends Error {}
export class SubscriptionNotResumableError extends Error {}

export type SubscriptionView = SubscriptionRecord & {
  organizationId: string;
  readOnlySince: Date | null;
  cancelledAt: Date | null;
  cancelledByUserId: string | null;
  endedAt: Date | null;
};

type Row = typeof organizationSubscriptions.$inferSelect;

function toView(row: Row): SubscriptionView {
  return {
    organizationId: row.organizationId,
    planKey: row.planKey,
    chosenModule: row.chosenModule,
    options: row.options,
    storageUnits: row.storageUnits,
    billingPeriod: row.billingPeriod,
    status: row.status,
    trialEndsAt: row.trialEndsAt,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    readOnlySince: row.readOnlySince,
    cancelledAt: row.cancelledAt,
    cancelledByUserId: row.cancelledByUserId,
    cancelEffectiveAt: row.cancelEffectiveAt,
    endedAt: row.endedAt,
  };
}

export async function getSubscription(db: AppDatabase, organizationId: string): Promise<SubscriptionView | null> {
  const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(organizationSubscriptions).where(eq(organizationSubscriptions.organizationId, organizationId)));
  return row ? toView(row) : null;
}

// D2 : à la fin de l'essai sans offre choisie, l'organisation lit tout et exporte, sans rien changer.
export async function isOrganizationReadOnly(db: AppDatabase, organizationId: string): Promise<boolean> {
  return (await getSubscription(db, organizationId))?.status === "read_only";
}

// Les modules de l'organisation suivent ses droits (ARC-06) : relus en base à chaque requête
// (isModuleEnabled), ils changent à la connexion suivante au plus tard, sans redéploiement.
async function applyEntitlements(db: AppDatabase, organizationId: string, catalog: PlanCatalog, subscription: SubscriptionSelection): Promise<string[]> {
  const entitled = entitledModules(catalog, subscription, MODULE_KEYS);
  for (const moduleKey of MODULE_KEYS) await upsertOrganizationModule(db, { organizationId, moduleKey, enabled: entitled.has(moduleKey) });
  return [...entitled];
}

async function writeSubscription(db: AppDatabase, organizationId: string, values: Omit<typeof organizationSubscriptions.$inferInsert, "organizationId">): Promise<SubscriptionView> {
  const [row] = await withOrganization(db, organizationId, (tx) =>
    tx
      .insert(organizationSubscriptions)
      .values({ organizationId, ...values })
      .onConflictDoUpdate({ target: organizationSubscriptions.organizationId, set: values })
      .returning(),
  );
  return toView(row!);
}

async function assertOwner(db: AppDatabase, organizationId: string, userId: string): Promise<void> {
  const member = (await listTeam(db, organizationId)).find((candidate) => candidate.id === userId);
  if (!member || member.role !== "owner" || member.disabledAt) throw new SubscriptionForbiddenError();
}

async function activeSeats(db: AppDatabase, organizationId: string): Promise<number> {
  return (await listTeam(db, organizationId)).filter((member) => !member.disabledAt && (member.role === "owner" || member.role === "member")).length;
}

const NO_CANCELLATION = { cancelledAt: null, cancelledByUserId: null, cancelEffectiveAt: null };

// À l'inscription (lot 33), quand l'abonnement en libre-service est ouvert : 30 jours de suite
// complète, sans carte. Sans effet si l'organisation a déjà un abonnement.
export async function startTrial(db: AppDatabase, input: { organizationId: string; now?: Date }): Promise<SubscriptionView> {
  const now = input.now ?? new Date();
  const existing = await getSubscription(db, input.organizationId);
  if (existing) return existing;
  const catalog = await getPlanCatalog(db);
  const trial = catalog.plans.find((plan) => plan.kind === "trial")!;
  const selection: SubscriptionSelection = { planKey: trial.key, chosenModule: null, options: [], storageUnits: 0, billingPeriod: "monthly" };
  const view = await writeSubscription(db, input.organizationId, { ...selection, status: "trial", trialEndsAt: trialEndsAt(now, catalog.rules), currentPeriodStart: null, currentPeriodEnd: null, readOnlySince: null, ...NO_CANCELLATION, endedAt: null });
  const modules = await applyEntitlements(db, input.organizationId, catalog, selection);
  await recordAudit(db, { organizationId: input.organizationId, action: "hub.subscription.trial_started", objectId: input.organizationId, details: { plan: trial.key, modules: modules.join(",") }, actor: { kind: "system", id: null } });
  return view;
}

// L'Exploitation pose une offre, libre-service ou non (forfait Pilote : tout ouvert, sans payer).
export async function assignPlanByOperator(db: AppDatabase, input: { adminUserId: string; organizationId: string; planKey: string; now?: Date }): Promise<SubscriptionView> {
  const now = input.now ?? new Date();
  const catalog = await getPlanCatalog(db);
  const plan = findPlan(catalog, input.planKey);
  if (!plan) throw new SubscriptionSelectionError("unknown_plan");
  const previous = await getSubscription(db, input.organizationId);
  const keepChoice = previous && previous.planKey === plan.key ? previous.chosenModule : null;
  const selection: SubscriptionSelection = {
    planKey: plan.key,
    chosenModule: plan.moduleChoice.length > 0 ? (keepChoice ?? plan.moduleChoice[0]!) : null,
    options: plan.optionsAllowed && previous ? previous.options : [],
    storageUnits: plan.optionsAllowed && previous ? previous.storageUnits : 0,
    billingPeriod: plan.yearlyPriceCents === null ? "monthly" : (previous?.billingPeriod ?? "monthly"),
  };
  const dates =
    plan.kind === "trial"
      ? { status: "trial" as const, trialEndsAt: trialEndsAt(now, catalog.rules), currentPeriodStart: null, currentPeriodEnd: null }
      : plan.kind === "pilot"
        ? { status: "active" as const, trialEndsAt: null, currentPeriodStart: now, currentPeriodEnd: null }
        : { status: "active" as const, trialEndsAt: null, currentPeriodStart: now, currentPeriodEnd: addBillingPeriod(now, selection.billingPeriod) };
  const view = await writeSubscription(db, input.organizationId, { ...selection, ...dates, readOnlySince: null, ...NO_CANCELLATION, endedAt: null });
  const modules = await applyEntitlements(db, input.organizationId, catalog, selection);
  await recordAudit(db, { organizationId: input.organizationId, action: "hub.subscription.assigned", objectId: input.organizationId, details: { plan: plan.key, modules: modules.join(",") }, actor: { kind: "admin", id: input.adminUserId } });
  await refreshStorageQuota(db, input.organizationId, now);
  return view;
}

export type SubscriptionChange = { subscription: SubscriptionView; prorataCents: number; modules: string[] };

// « Mon abonnement » → « Changer » : effet immédiat ; l'écart au prorata va sur la facture suivante.
export async function changeSubscription(db: AppDatabase, input: { organizationId: string; userId: string; selection: SubscriptionSelection; now?: Date }): Promise<SubscriptionChange> {
  const now = input.now ?? new Date();
  await assertOwner(db, input.organizationId, input.userId);
  const catalog = await getPlanCatalog(db);
  const previous = await getSubscription(db, input.organizationId);
  if (previous) {
    const current = findPlan(catalog, previous.planKey);
    if (current?.kind === "pilot") throw new SubscriptionManagedError();
    if (previous.status === "cancelled") throw new SubscriptionNotCancellableError();
  }
  const problem = validateSelection(catalog, input.selection);
  if (problem) throw new SubscriptionSelectionError(problem);
  const plan = findPlan(catalog, input.selection.planKey)!;
  const selection: SubscriptionSelection = { ...input.selection, chosenModule: plan.moduleChoice.length > 0 ? input.selection.chosenModule : null, options: [...new Set(input.selection.options)].sort() };
  if (plan.maxUsers !== null && (await activeSeats(db, input.organizationId)) > plan.maxUsers) throw new SubscriptionSeatsError(plan.maxUsers);

  // Une période en cours, de même durée, continue ; sinon une période commence maintenant.
  const continues = previous?.status === "active" && previous.currentPeriodEnd !== null && previous.currentPeriodStart !== null && previous.currentPeriodEnd > now && previous.billingPeriod === selection.billingPeriod;
  const periodStart = continues ? previous.currentPeriodStart! : now;
  const periodEnd = continues ? previous.currentPeriodEnd! : addBillingPeriod(now, selection.billingPeriod);
  const prorata = continues
    ? prorataCents({ fromCents: subscriptionPrice(catalog, previous).totalCents, toCents: subscriptionPrice(catalog, selection).totalCents, periodStart, periodEnd, now })
    : 0;
  const subscription = await writeSubscription(db, input.organizationId, { ...selection, status: "active", trialEndsAt: previous?.trialEndsAt ?? null, currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, readOnlySince: null, ...NO_CANCELLATION, endedAt: null });
  const modules = await applyEntitlements(db, input.organizationId, catalog, selection);
  await recordAudit(db, {
    organizationId: input.organizationId,
    action: "hub.subscription.changed",
    objectId: input.organizationId,
    details: { plan: plan.key, options: selection.options.join(","), storageUnits: selection.storageUnits, period: selection.billingPeriod, prorataCents: prorata, modules: modules.join(",") },
  });
  await refreshStorageQuota(db, input.organizationId, now);
  return { subscription, prorataCents: prorata, modules };
}

// « Mon abonnement » → « Résilier » → confirmer (HUB-27 : moins de trois clics). L'accès reste
// jusqu'à la fin de la période payée ; à cette date, la fermeture du lot 35c commence.
export async function cancelSubscription(db: AppDatabase, input: { organizationId: string; userId: string; now?: Date }): Promise<SubscriptionView> {
  const now = input.now ?? new Date();
  await assertOwner(db, input.organizationId, input.userId);
  const current = await getSubscription(db, input.organizationId);
  if (!current || current.status === "cancelled") throw new SubscriptionNotCancellableError();
  const catalog = await getPlanCatalog(db);
  if (findPlan(catalog, current.planKey)?.kind === "pilot") throw new SubscriptionManagedError();
  const effectiveAt = cancellationEffectiveAt(current, now);
  const view = await writeSubscription(db, input.organizationId, {
    planKey: current.planKey,
    chosenModule: current.chosenModule,
    options: current.options,
    storageUnits: current.storageUnits,
    billingPeriod: current.billingPeriod,
    status: "cancelled",
    trialEndsAt: current.trialEndsAt,
    currentPeriodStart: current.currentPeriodStart,
    currentPeriodEnd: current.currentPeriodEnd,
    readOnlySince: current.readOnlySince,
    cancelledAt: now,
    cancelledByUserId: input.userId,
    cancelEffectiveAt: effectiveAt,
    endedAt: null,
  });
  await recordAudit(db, { organizationId: input.organizationId, action: "hub.subscription.cancelled", objectId: input.organizationId, details: { effectiveAt: effectiveAt.toISOString() } });
  await notifyOwners(db, { organizationId: input.organizationId, mail: "subscriptionCancelled", date: effectiveAt, key: `subscription:${input.organizationId}:cancelled:${now.toISOString()}` });
  if (effectiveAt <= now) await endSubscription(db, view, now);
  return view;
}

// Revenir sur une résiliation avant son échéance : l'abonnement reprend comme avant.
export async function resumeSubscription(db: AppDatabase, input: { organizationId: string; userId: string; now?: Date }): Promise<SubscriptionView> {
  const now = input.now ?? new Date();
  await assertOwner(db, input.organizationId, input.userId);
  const current = await getSubscription(db, input.organizationId);
  if (!current || current.status !== "cancelled" || current.endedAt || !current.cancelEffectiveAt || current.cancelEffectiveAt <= now) throw new SubscriptionNotResumableError();
  const status = current.currentPeriodEnd && current.currentPeriodEnd > now ? "active" : current.trialEndsAt && current.trialEndsAt > now ? "trial" : null;
  if (!status) throw new SubscriptionNotResumableError();
  const view = await writeSubscription(db, input.organizationId, {
    planKey: current.planKey,
    chosenModule: current.chosenModule,
    options: current.options,
    storageUnits: current.storageUnits,
    billingPeriod: current.billingPeriod,
    status,
    trialEndsAt: current.trialEndsAt,
    currentPeriodStart: current.currentPeriodStart,
    currentPeriodEnd: current.currentPeriodEnd,
    readOnlySince: null,
    ...NO_CANCELLATION,
    endedAt: null,
  });
  await recordAudit(db, { organizationId: input.organizationId, action: "hub.subscription.resumed", objectId: input.organizationId });
  return view;
}

// Échéance d'une résiliation : la fermeture du lot 35c (export pendant 30 jours, puis effacement).
async function endSubscription(db: AppDatabase, subscription: SubscriptionView, now: Date): Promise<void> {
  const [row] = await withOrganization(db, subscription.organizationId, (tx) =>
    tx.update(organizationSubscriptions).set({ endedAt: now }).where(eq(organizationSubscriptions.organizationId, subscription.organizationId)).returning({ organizationId: organizationSubscriptions.organizationId }),
  );
  if (!row) return;
  await recordAudit(db, { organizationId: subscription.organizationId, action: "hub.subscription.ended", objectId: subscription.organizationId, actor: { kind: "system", id: null } });
  await closeOrganizationAtSubscriptionEnd(db, { organizationId: subscription.organizationId, userId: subscription.cancelledByUserId, now });
}

export type SubscriptionPass = { reminders: number; readOnly: string[]; renewed: string[]; ended: string[]; failed: string[] };

// Passage périodique (lib/subscriptions.ts) : rappels de fin d'essai, passage en lecture seule,
// reconduction des périodes, échéance des résiliations. Rejouable : chaque e-mail a sa clé.
export async function runSubscriptionPass(db: AppDatabase, input: { organizationIds: string[]; now?: Date }): Promise<SubscriptionPass> {
  const now = input.now ?? new Date();
  const pass: SubscriptionPass = { reminders: 0, readOnly: [], renewed: [], ended: [], failed: [] };
  const catalog = await getPlanCatalog(db);
  for (const organizationId of input.organizationIds) {
    try {
      const subscription = await getSubscription(db, organizationId);
      if (!subscription) continue;
      if (subscription.status === "trial" && subscription.trialEndsAt) {
        if (now >= subscription.trialEndsAt) {
          await withOrganization(db, organizationId, (tx) => tx.update(organizationSubscriptions).set({ status: "read_only", readOnlySince: now }).where(eq(organizationSubscriptions.organizationId, organizationId)));
          await recordAudit(db, { organizationId, action: "hub.subscription.read_only", objectId: organizationId, actor: { kind: "system", id: null } });
          await notifyOwners(db, { organizationId, mail: "subscriptionTrialEnded", date: subscription.trialEndsAt, key: `subscription:${organizationId}:trial-ended:${subscription.trialEndsAt.toISOString()}` });
          pass.readOnly.push(organizationId);
        } else {
          const days = trialReminderDue(subscription.trialEndsAt, now, catalog.rules);
          if (days !== null) {
            await notifyOwners(db, { organizationId, mail: "subscriptionTrialReminder", date: subscription.trialEndsAt, days, key: `subscription:${organizationId}:trial:${subscription.trialEndsAt.toISOString()}:${days}` });
            pass.reminders += 1;
          }
        }
      } else if (subscription.status === "active" && subscription.currentPeriodEnd && now >= subscription.currentPeriodEnd) {
        let start = subscription.currentPeriodEnd;
        let end = addBillingPeriod(start, subscription.billingPeriod);
        while (now >= end) {
          start = end;
          end = addBillingPeriod(start, subscription.billingPeriod);
        }
        await withOrganization(db, organizationId, (tx) => tx.update(organizationSubscriptions).set({ currentPeriodStart: start, currentPeriodEnd: end }).where(eq(organizationSubscriptions.organizationId, organizationId)));
        pass.renewed.push(organizationId);
      } else if (subscription.status === "cancelled" && subscription.cancelEffectiveAt && !subscription.endedAt && now >= subscription.cancelEffectiveAt) {
        await endSubscription(db, subscription, now);
        pass.ended.push(organizationId);
      }
    } catch (error) {
      // Une organisation en échec n'empêche pas les autres ; elle est reprise au passage suivant.
      pass.failed.push(organizationId);
      console.error("passage des abonnements échoué", { organizationId, error: error instanceof Error ? error.name : "inconnue" });
    }
  }
  return pass;
}
