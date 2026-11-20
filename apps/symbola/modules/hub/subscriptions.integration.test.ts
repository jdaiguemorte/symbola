// Lot 54 (HUB-27, ARC-06, NFR-26, DOC-06 ; décisions D1 à D3 de Julien du 19/11/2026 ; ADR 0101) —
// abonnement en libre-service, forfaits par module, interrupteurs par fonction et quota de stockage,
// contre un vrai PostgreSQL, à l'horloge simulée. Les montants et quotas viennent du catalogue de
// départ (plans.json), jamais d'une valeur écrite ici (HUB-20).
import { randomUUID } from "node:crypto";
import { like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { jobs, organizationSubscriptions, storageQuotaStates } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { uploadFile } from "@symbola/files";
import { starterPlanCatalog } from "@symbola/starter-templates";
import { runSubscriptionsOnce } from "@/lib/subscriptions";
import { startTrialAtSignup } from "@/lib/signup-trial";
import {
  assignPlanByOperator,
  cancelSubscription,
  changeSubscription,
  getOrganizationClosure,
  getPlanCatalog,
  getStorageQuota,
  getSubscription,
  InvalidPlanCatalogError,
  isFeatureEnabled,
  isModuleEnabled,
  isOrganizationReadOnly,
  isUploadBlocked,
  listFeatureFlags,
  MODULE_KEYS,
  recordStorageMeasure,
  reopenOrganization,
  resumeSubscription,
  runSubscriptionPass,
  savePlanCatalog,
  setFeatureFlagForOrganization,
  setFeatureFlagOpenToAll,
  startTrial,
  SubscriptionForbiddenError,
  SubscriptionManagedError,
  SubscriptionNotResumableError,
  SubscriptionSeatsError,
  SubscriptionSelectionError,
  type SubscriptionSelection,
} from "./service";

const db = appDatabase();
const DAY_MS = 86_400_000;
const catalog = starterPlanCatalog();
const plan = (key: string) => catalog.plans.find((entry) => entry.key === key)!;
const option = (key: string) => catalog.options.find((entry) => entry.key === key)!;
const solo: SubscriptionSelection = { planKey: "solo", chosenModule: null, options: [], storageUnits: 0, billingPeriod: "monthly" };
let adminUserId: string;

beforeAll(async () => {
  adminUserId = (await createUser(db, { organizationId: null, email: `exploitation-${randomUUID()}@example.test`, role: "admin" })).id;
});

afterAll(async () => {
  // Le catalogue et l'interrupteur sont communs à la base : rendus comme au départ.
  await savePlanCatalog(db, { adminUserId, catalog: starterPlanCatalog() });
  await setFeatureFlagOpenToAll(db, { adminUserId, key: "subscription_self_service", open: false });
});

async function atelier(options: { open?: boolean } = {}) {
  const organization = await createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`);
  const owner = await createUser(db, { organizationId: organization.id, email: `titulaire-${randomUUID()}@example.test`, role: "owner" });
  if (options.open !== false) await setFeatureFlagForOrganization(db, { adminUserId, key: "subscription_self_service", organizationId: organization.id, open: true });
  return { organizationId: organization.id, ownerId: owner.id };
}

async function member(organizationId: string, role: "member" | "accountant" = "member"): Promise<string> {
  return (await createUser(db, { organizationId, email: `${role}-${randomUUID()}@example.test`, role })).id;
}

async function mailKeys(organizationId: string, prefix: string): Promise<string[]> {
  const rows = await withOrganization(db, organizationId, (tx) => tx.select({ key: jobs.idempotencyKey }).from(jobs).where(like(jobs.idempotencyKey, `${prefix}%`)));
  return rows.map((row) => row.key).sort();
}

async function openModules(organizationId: string): Promise<string[]> {
  const states = await Promise.all(MODULE_KEYS.map(async (moduleKey) => [moduleKey, await isModuleEnabled(db, organizationId, moduleKey)] as const));
  return states.filter(([, enabled]) => enabled).map(([moduleKey]) => moduleKey).sort();
}

describe("ARC-06 — Droits d'usage pilotés par l'abonnement", () => {
  it("l'essai ouvre la suite complète ; passer à la suite Solo ferme les autres apps à la requête suivante, sans redéploiement", async () => {
    const { organizationId, ownerId } = await atelier();
    await startTrial(db, { organizationId });
    expect(await openModules(organizationId)).toEqual([...MODULE_KEYS].sort());
    await changeSubscription(db, { organizationId, userId: ownerId, selection: solo });
    expect(await openModules(organizationId)).toEqual(plan("solo").modules.filter((key) => (MODULE_KEYS as readonly string[]).includes(key)).sort());
    expect(await isModuleEnabled(db, organizationId, "guests")).toBe(false);
  });

  it("ajouter une option ouvre son module ; la retirer le ferme", async () => {
    const { organizationId, ownerId } = await atelier();
    await changeSubscription(db, { organizationId, userId: ownerId, selection: { ...solo, options: ["guests"] } });
    expect(await isModuleEnabled(db, organizationId, "guests")).toBe(true);
    await changeSubscription(db, { organizationId, userId: ownerId, selection: solo });
    expect(await isModuleEnabled(db, organizationId, "guests")).toBe(false);
  });

  it("l'App seule n'ouvre que l'app choisie", async () => {
    const { organizationId, ownerId } = await atelier();
    await changeSubscription(db, { organizationId, userId: ownerId, selection: { planKey: "app", chosenModule: "appointments", options: [], storageUnits: 0, billingPeriod: "monthly" } });
    expect(await openModules(organizationId)).toEqual(["appointments"]);
  });

  it("le forfait Pilote, posé par l'Exploitation, ouvre tout sans payer ; la Propriétaire ne peut ni le changer ni le résilier ici", async () => {
    const { organizationId, ownerId } = await atelier();
    await assignPlanByOperator(db, { adminUserId, organizationId, planKey: "pilot" });
    expect(await openModules(organizationId)).toEqual([...MODULE_KEYS].sort());
    expect((await getSubscription(db, organizationId))?.currentPeriodEnd).toBeNull();
    await expect(changeSubscription(db, { organizationId, userId: ownerId, selection: solo })).rejects.toBeInstanceOf(SubscriptionManagedError);
    await expect(cancelSubscription(db, { organizationId, userId: ownerId })).rejects.toBeInstanceOf(SubscriptionManagedError);
  });

  it("une organisation sans abonnement garde ses réglages de l'Exploitation (comme avant le lot)", async () => {
    const { organizationId } = await atelier({ open: false });
    expect(await getSubscription(db, organizationId)).toBeNull();
    expect(await isModuleEnabled(db, organizationId, "events")).toBe(true);
    expect(await isOrganizationReadOnly(db, organizationId)).toBe(false);
  });
});

describe("NFR-26 — Fonctions nouvelles derrière un interrupteur", () => {
  it("fermée pour tous ; ouverte d'abord à la pilote, elle reste fermée pour les autres ; une clé inconnue est fermée", async () => {
    const pilot = await atelier({ open: false });
    const other = await atelier({ open: false });
    expect(await isFeatureEnabled(db, pilot.organizationId, "subscription_self_service")).toBe(false);
    await setFeatureFlagForOrganization(db, { adminUserId, key: "subscription_self_service", organizationId: pilot.organizationId, open: true });
    expect(await isFeatureEnabled(db, pilot.organizationId, "subscription_self_service")).toBe(true);
    expect(await isFeatureEnabled(db, other.organizationId, "subscription_self_service")).toBe(false);
    expect(await isFeatureEnabled(db, pilot.organizationId, "fonction_inconnue")).toBe(false);
    expect((await listFeatureFlags(db)).find((flag) => flag.key === "subscription_self_service")?.organizationIds).toContain(pilot.organizationId);
    await setFeatureFlagForOrganization(db, { adminUserId, key: "subscription_self_service", organizationId: pilot.organizationId, open: false });
    expect(await isFeatureEnabled(db, pilot.organizationId, "subscription_self_service")).toBe(false);
  });

  it("ouverte à tous puis refermée ; l'essai ne commence à l'inscription que si la fonction est ouverte", async () => {
    const closed = await atelier({ open: false });
    expect(await startTrialAtSignup(closed.organizationId)).toBe(false);
    expect(await getSubscription(db, closed.organizationId)).toBeNull();
    await setFeatureFlagOpenToAll(db, { adminUserId, key: "subscription_self_service", open: true });
    try {
      const opened = await atelier({ open: false });
      expect(await isFeatureEnabled(db, opened.organizationId, "subscription_self_service")).toBe(true);
      expect(await startTrialAtSignup(opened.organizationId)).toBe(true);
      expect((await getSubscription(db, opened.organizationId))?.status).toBe("trial");
    } finally {
      await setFeatureFlagOpenToAll(db, { adminUserId, key: "subscription_self_service", open: false });
    }
    expect(await isFeatureEnabled(db, closed.organizationId, "subscription_self_service")).toBe(false);
  });
});

describe("HUB-27 — Abonnement en libre-service", () => {
  it("essai de 30 jours : rappel à J-7 puis à J-1, une fois chacun ; à la fin, lecture seule sans rien effacer, puis une offre lève la lecture seule", async () => {
    const { organizationId, ownerId } = await atelier();
    const start = new Date();
    const trial = await startTrial(db, { organizationId, now: start });
    const end = trial.trialEndsAt!;
    const prefix = `subscription:${organizationId}:trial:`;
    await runSubscriptionPass(db, { organizationIds: [organizationId], now: new Date(end.getTime() - 8 * DAY_MS) });
    expect(await mailKeys(organizationId, prefix)).toEqual([]);
    for (const at of [end.getTime() - 7 * DAY_MS + 3_600_000, end.getTime() - 6 * DAY_MS]) await runSubscriptionPass(db, { organizationIds: [organizationId], now: new Date(at) });
    expect(await mailKeys(organizationId, prefix)).toEqual([`${prefix}${end.toISOString()}:7:${ownerId}`]);
    await runSubscriptionPass(db, { organizationIds: [organizationId], now: new Date(end.getTime() - 3_600_000) });
    expect((await mailKeys(organizationId, prefix)).length).toBe(2);
    expect(await isOrganizationReadOnly(db, organizationId)).toBe(false);

    const pass = await runSubscriptionPass(db, { organizationIds: [organizationId], now: new Date(end.getTime() + 60_000) });
    expect(pass.readOnly).toEqual([organizationId]);
    expect(await isOrganizationReadOnly(db, organizationId)).toBe(true);
    expect(await mailKeys(organizationId, `subscription:${organizationId}:trial-ended:`)).toHaveLength(1);
    // Rien n'est effacé ni fermé : les apps restent lisibles.
    expect(await isModuleEnabled(db, organizationId, "events")).toBe(true);
    expect(await getOrganizationClosure(db, organizationId)).toBeNull();

    await changeSubscription(db, { organizationId, userId: ownerId, selection: solo, now: new Date(end.getTime() + DAY_MS) });
    expect(await isOrganizationReadOnly(db, organizationId)).toBe(false);
    expect((await getSubscription(db, organizationId))?.status).toBe("active");
  });

  it("changer d'offre en cours de période : effet immédiat, écart au prorata ; une période passée est reconduite", async () => {
    const { organizationId, ownerId } = await atelier();
    const start = new Date();
    const first = await changeSubscription(db, { organizationId, userId: ownerId, selection: solo, now: start });
    expect(first.prorataCents).toBe(0);
    const period = first.subscription;
    const middle = new Date((period.currentPeriodStart!.getTime() + period.currentPeriodEnd!.getTime()) / 2);
    const upgrade = await changeSubscription(db, { organizationId, userId: ownerId, selection: { ...solo, planKey: "agency" }, now: middle });
    expect(upgrade.prorataCents).toBeGreaterThan(0);
    expect(upgrade.prorataCents).toBeLessThan(plan("agency").monthlyPriceCents - plan("solo").monthlyPriceCents);
    expect(upgrade.subscription.currentPeriodEnd).toEqual(period.currentPeriodEnd);

    const pass = await runSubscriptionPass(db, { organizationIds: [organizationId], now: new Date(period.currentPeriodEnd!.getTime() + 40 * DAY_MS) });
    expect(pass.renewed).toEqual([organizationId]);
    const renewed = await getSubscription(db, organizationId);
    expect(renewed!.currentPeriodEnd!.getTime()).toBeGreaterThan(period.currentPeriodEnd!.getTime() + 40 * DAY_MS);
  });

  it("résilier : l'accès reste jusqu'à la fin de la période payée, on peut revenir dessus ; à l'échéance, la fermeture du lot 35c commence", async () => {
    const { organizationId, ownerId } = await atelier();
    const { subscription } = await changeSubscription(db, { organizationId, userId: ownerId, selection: solo });
    const cancelled = await cancelSubscription(db, { organizationId, userId: ownerId });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelEffectiveAt).toEqual(subscription.currentPeriodEnd);
    expect(await isModuleEnabled(db, organizationId, "events")).toBe(true);
    expect(await mailKeys(organizationId, `subscription:${organizationId}:cancelled:`)).toHaveLength(1);

    expect((await resumeSubscription(db, { organizationId, userId: ownerId })).status).toBe("active");
    await cancelSubscription(db, { organizationId, userId: ownerId });

    // La veille de l'échéance, rien ne se ferme ; à l'échéance, l'espace est fermé (export 30 jours).
    const end = subscription.currentPeriodEnd!;
    expect((await runSubscriptionPass(db, { organizationIds: [organizationId], now: new Date(end.getTime() - 60_000) })).ended).toEqual([]);
    expect(await getOrganizationClosure(db, organizationId)).toBeNull();
    const pass = await runSubscriptionPass(db, { organizationIds: [organizationId], now: end });
    expect(pass.ended).toEqual([organizationId]);
    const closure = await getOrganizationClosure(db, organizationId);
    expect(closure?.closedByUserId).toBe(ownerId);
    expect(closure!.deletionDueAt.getTime() - end.getTime()).toBeGreaterThan(29 * DAY_MS);
    await expect(resumeSubscription(db, { organizationId, userId: ownerId, now: new Date(end.getTime() + 1) })).rejects.toBeInstanceOf(SubscriptionNotResumableError);
    // Rejouer le passage ne refait rien.
    expect((await runSubscriptionPass(db, { organizationIds: [organizationId], now: new Date(end.getTime() + DAY_MS) })).ended).toEqual([]);

    // Rouvrir l'espace avant la suppression : il revient en lecture seule, une offre à choisir.
    await reopenOrganization(db, { organizationId, userId: ownerId, mfaVerified: true, now: new Date(end.getTime() + 2 * DAY_MS) });
    expect(await isOrganizationReadOnly(db, organizationId)).toBe(true);
  });

  it("résilier en lecture seule (fin d'essai) ferme l'espace tout de suite, l'export restant possible 30 jours", async () => {
    const { organizationId, ownerId } = await atelier();
    const trial = await startTrial(db, { organizationId });
    await runSubscriptionPass(db, { organizationIds: [organizationId], now: new Date(trial.trialEndsAt!.getTime() + 1) });
    await cancelSubscription(db, { organizationId, userId: ownerId, now: new Date(trial.trialEndsAt!.getTime() + 2) });
    expect((await getSubscription(db, organizationId))?.endedAt).not.toBeNull();
    expect(await getOrganizationClosure(db, organizationId)).not.toBeNull();
  });

  it("un choix hors du catalogue en libre-service est refusé : forfait Pilote, App seule sans app, option sur l'App seule", async () => {
    const { organizationId, ownerId } = await atelier();
    const refused = async (selection: SubscriptionSelection) => {
      const error = await changeSubscription(db, { organizationId, userId: ownerId, selection }).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(SubscriptionSelectionError);
      return (error as SubscriptionSelectionError).problem;
    };
    expect(await refused({ ...solo, planKey: "pilot" })).toBe("not_self_service");
    expect(await refused({ ...solo, planKey: "app" })).toBe("module_choice_required");
    expect(await refused({ ...solo, planKey: "app", chosenModule: "quotes", options: ["guests"] })).toBe("options_not_allowed");
    expect(await getSubscription(db, organizationId)).toBeNull();
  });

  it("une offre qui admet moins d'utilisateurs que l'équipe n'en compte est refusée", async () => {
    const { organizationId, ownerId } = await atelier();
    for (let index = 0; index < plan("solo").maxUsers!; index += 1) await member(organizationId);
    await expect(changeSubscription(db, { organizationId, userId: ownerId, selection: solo })).rejects.toBeInstanceOf(SubscriptionSeatsError);
    await changeSubscription(db, { organizationId, userId: ownerId, selection: { ...solo, planKey: "agency" } });
  });
});

describe("DOC-06 — Quota de stockage par offre, visible", () => {
  const GB = 1024 ** 3;

  it("80 % puis 95 % préviennent la Propriétaire ; à 100 %, les dépôts ne sont refusés qu'après sept jours de préavis ; une tranche ajoutée lève le refus", async () => {
    const { organizationId, ownerId } = await atelier();
    await changeSubscription(db, { organizationId, userId: ownerId, selection: solo });
    const quota = plan("solo").storageQuotaBytes!;
    const t0 = new Date();
    await recordStorageMeasure(db, { organizationId, usedBytes: Math.ceil(quota * 0.81), usedByModule: { events: Math.ceil(quota * 0.81) }, now: t0 });
    expect(await mailKeys(organizationId, `storage-quota:${organizationId}:80:`)).toHaveLength(1);
    await recordStorageMeasure(db, { organizationId, usedBytes: Math.ceil(quota * 0.96), usedByModule: { events: Math.ceil(quota * 0.96) }, now: t0 });
    expect(await mailKeys(organizationId, `storage-quota:${organizationId}:95:`)).toHaveLength(1);

    const full = await recordStorageMeasure(db, { organizationId, usedBytes: quota + GB, usedByModule: { events: quota + GB }, now: t0 });
    expect(full?.uploadsBlockedFrom).not.toBeNull();
    expect(await mailKeys(organizationId, `storage-quota:${organizationId}:100:`)).toHaveLength(1);
    const blockedFrom = full!.uploadsBlockedFrom!;
    expect(blockedFrom.getTime() - t0.getTime()).toBeGreaterThan(6 * DAY_MS);
    // Pendant le préavis, rien n'est refusé.
    expect(await isUploadBlocked(db, organizationId, new Date(blockedFrom.getTime() - 1))).toBe(false);
    expect(await isUploadBlocked(db, organizationId, blockedFrom)).toBe(true);
    expect((await getStorageQuota(db, organizationId, blockedFrom))?.blocked).toBe(true);

    // Une tranche de stockage ajoutée : le nouveau quota s'applique à la dernière mesure.
    await changeSubscription(db, { organizationId, userId: ownerId, selection: { ...solo, storageUnits: 1 } });
    expect((await getStorageQuota(db, organizationId))?.quotaBytes).toBe(quota + option("storage").storageUnitBytes!);
    expect(await isUploadBlocked(db, organizationId, new Date(blockedFrom.getTime() + DAY_MS))).toBe(false);
  });

  it("dépôt refusé après le préavis (raison storage_full) ; une pièce légale exemptée ne l'est pas ; une autre organisation n'est pas touchée", async () => {
    const full = await atelier();
    const other = await atelier();
    await changeSubscription(db, { organizationId: full.organizationId, userId: full.ownerId, selection: solo });
    await changeSubscription(db, { organizationId: other.organizationId, userId: other.ownerId, selection: solo });
    const quota = plan("solo").storageQuotaBytes!;
    await recordStorageMeasure(db, { organizationId: full.organizationId, usedBytes: quota, usedByModule: { quotes: quota }, now: new Date(Date.now() - 8 * DAY_MS) });
    expect(await isUploadBlocked(db, full.organizationId)).toBe(true);
    const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
    expect(await uploadFile({ organizationId: full.organizationId, buffer: png, maxSizeBytes: 1024 })).toEqual({ status: "rejected", reason: "storage_full" });
    const exempt = await uploadFile({ organizationId: full.organizationId, buffer: png, maxSizeBytes: 1024, quotaExempt: true });
    expect(exempt).not.toEqual({ status: "rejected", reason: "storage_full" });
    expect(await isUploadBlocked(db, other.organizationId)).toBe(false);
  });

  it("sans abonnement, ni quota ni refus ; le passage horaire mesure les seules organisations abonnées", async () => {
    const managed = await atelier({ open: false });
    expect(await recordStorageMeasure(db, { organizationId: managed.organizationId, usedBytes: 999 * GB, usedByModule: {} })).toBeNull();
    expect(await isUploadBlocked(db, managed.organizationId, new Date(Date.now() + 30 * DAY_MS))).toBe(false);

    const subscribed = await atelier();
    await startTrial(db, { organizationId: subscribed.organizationId });
    const measured: string[] = [];
    const run = await runSubscriptionsOnce({
      organizationIds: [managed.organizationId, subscribed.organizationId],
      measure: async (organizationId) => {
        measured.push(organizationId);
        return { usedBytes: GB, usedByModule: { events: GB } };
      },
    });
    expect(measured).toEqual([subscribed.organizationId]);
    expect(run.measured).toEqual([subscribed.organizationId]);
    expect((await getStorageQuota(db, subscribed.organizationId))?.usedByModule).toEqual({ events: GB });
    // Une mesure fraîche n'est pas refaite au passage suivant.
    await runSubscriptionsOnce({ organizationIds: [subscribed.organizationId], measure: async () => ({ usedBytes: 2 * GB, usedByModule: {} }) });
    expect((await getStorageQuota(db, subscribed.organizationId))?.usedBytes).toBe(GB);
  });
});

describe("HUB-27 — Isolation et abus", () => {
  it("une organisation ne change ni ne résilie l'abonnement d'une autre", async () => {
    const a = await atelier();
    const b = await atelier();
    await startTrial(db, { organizationId: b.organizationId });
    await expect(changeSubscription(db, { organizationId: b.organizationId, userId: a.ownerId, selection: solo })).rejects.toBeInstanceOf(SubscriptionForbiddenError);
    await expect(cancelSubscription(db, { organizationId: b.organizationId, userId: a.ownerId })).rejects.toBeInstanceOf(SubscriptionForbiddenError);
    expect((await getSubscription(db, b.organizationId))?.status).toBe("trial");
  });

  it("seule la Propriétaire change l'abonnement : une Planner et un Comptable sont refusés", async () => {
    const { organizationId } = await atelier();
    await startTrial(db, { organizationId });
    for (const role of ["member", "accountant"] as const) {
      const userId = await member(organizationId, role);
      await expect(changeSubscription(db, { organizationId, userId, selection: solo })).rejects.toBeInstanceOf(SubscriptionForbiddenError);
      await expect(cancelSubscription(db, { organizationId, userId })).rejects.toBeInstanceOf(SubscriptionForbiddenError);
    }
  });

  it("la base ne laisse lire que l'abonnement et le quota de sa propre organisation (RLS)", async () => {
    const a = await atelier();
    const b = await atelier();
    await startTrial(db, { organizationId: a.organizationId });
    await startTrial(db, { organizationId: b.organizationId });
    await recordStorageMeasure(db, { organizationId: a.organizationId, usedBytes: 1, usedByModule: {} });
    await recordStorageMeasure(db, { organizationId: b.organizationId, usedBytes: 2, usedByModule: {} });
    const seen = await withOrganization(db, a.organizationId, async (tx) => ({
      subscriptions: await tx.select({ organizationId: organizationSubscriptions.organizationId }).from(organizationSubscriptions),
      quotas: await tx.select({ organizationId: storageQuotaStates.organizationId }).from(storageQuotaStates),
    }));
    expect(seen.subscriptions.map((row) => row.organizationId)).toEqual([a.organizationId]);
    expect(seen.quotas.map((row) => row.organizationId)).toEqual([a.organizationId]);
    await expect(
      withOrganization(db, a.organizationId, (tx) => tx.insert(organizationSubscriptions).values({ organizationId: b.organizationId, planKey: "pilot", status: "active" })),
    ).rejects.toThrow();
  });

  it("l'Exploitation règle le catalogue sans code : un prix changé vaut aussitôt ; le Pilote n'entre jamais en libre-service ; rien ne se supprime", async () => {
    const changed = starterPlanCatalog();
    changed.plans = changed.plans.map((entry) => (entry.key === "solo" ? { ...entry, monthlyPriceCents: entry.monthlyPriceCents + 100 } : entry));
    await savePlanCatalog(db, { adminUserId, catalog: changed });
    expect((await getPlanCatalog(db)).plans.find((entry) => entry.key === "solo")?.monthlyPriceCents).toBe(plan("solo").monthlyPriceCents + 100);
    const pilotOpen = starterPlanCatalog();
    pilotOpen.plans = pilotOpen.plans.map((entry) => (entry.kind === "pilot" ? { ...entry, selfService: true } : entry));
    await expect(savePlanCatalog(db, { adminUserId, catalog: pilotOpen })).rejects.toBeInstanceOf(InvalidPlanCatalogError);
    const shorter = starterPlanCatalog();
    shorter.options = shorter.options.filter((entry) => entry.key !== "storage");
    await expect(savePlanCatalog(db, { adminUserId, catalog: shorter })).rejects.toBeInstanceOf(InvalidPlanCatalogError);
    await savePlanCatalog(db, { adminUserId, catalog: starterPlanCatalog() });
    expect((await getPlanCatalog(db)).plans.find((entry) => entry.key === "solo")?.monthlyPriceCents).toBe(plan("solo").monthlyPriceCents);
  });
});
