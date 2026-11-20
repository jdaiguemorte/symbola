// Lot 54 (NFR-26, ARC-06 ; ADR 0101) — interrupteurs par fonction. Une fonction nouvelle déclare sa
// clé ici ; elle est fermée pour toutes les organisations tant que l'Exploitation ne l'ouvre pas :
// d'abord à la pilote (la pilote teste avant tous les autres), puis à tous. Sans redéploiement :
// l'état est relu en base à chaque requête. Une clé inconnue est fermée (refus par défaut).
import { and, eq } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import type { AppDatabase } from "@symbola/db/client";
import { featureFlagOrganizations, featureFlags } from "@symbola/db/schema/hub";
import { withActorContext } from "@symbola/db/with-organization";

// Les fonctions derrière un interrupteur. « subscription_self_service » : l'abonnement en libre-service
// (HUB-27), requis seulement à l'ouverture commerciale ; ouvert, il démarre l'essai à l'inscription et
// montre « Mon abonnement ».
export const FEATURE_FLAG_KEYS = ["subscription_self_service"] as const;
export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export function isFeatureFlagKey(value: string): value is FeatureFlagKey {
  return (FEATURE_FLAG_KEYS as readonly string[]).includes(value);
}

export async function isFeatureEnabled(db: AppDatabase, organizationId: string | null, key: string): Promise<boolean> {
  if (!isFeatureFlagKey(key)) return false;
  const [flag] = await db.select({ openToAll: featureFlags.openToAll }).from(featureFlags).where(eq(featureFlags.key, key));
  if (flag?.openToAll) return true;
  if (!organizationId || !flag) return false;
  const [opened] = await db
    .select({ organizationId: featureFlagOrganizations.organizationId })
    .from(featureFlagOrganizations)
    .where(and(eq(featureFlagOrganizations.flagKey, key), eq(featureFlagOrganizations.organizationId, organizationId)));
  return Boolean(opened);
}

export type FeatureFlagView = { key: FeatureFlagKey; openToAll: boolean; organizationIds: string[] };

export async function listFeatureFlags(db: AppDatabase): Promise<FeatureFlagView[]> {
  const [flags, opened] = await Promise.all([db.select().from(featureFlags), db.select().from(featureFlagOrganizations)]);
  return FEATURE_FLAG_KEYS.map((key) => ({
    key,
    openToAll: flags.find((flag) => flag.key === key)?.openToAll ?? false,
    organizationIds: opened.filter((row) => row.flagKey === key).map((row) => row.organizationId),
  }));
}

export class UnknownFeatureFlagError extends Error {}

async function ensureFlag(tx: Parameters<Parameters<AppDatabase["transaction"]>[0]>[0], key: FeatureFlagKey): Promise<void> {
  await tx.insert(featureFlags).values({ key }).onConflictDoNothing();
}

// L'Exploitation ouvre (ou referme) une fonction pour une organisation.
export async function setFeatureFlagForOrganization(db: AppDatabase, input: { adminUserId: string; key: string; organizationId: string; open: boolean }): Promise<void> {
  if (!isFeatureFlagKey(input.key)) throw new UnknownFeatureFlagError();
  const key = input.key;
  await withActorContext(db, async (tx) => {
    await ensureFlag(tx, key);
    if (input.open) await tx.insert(featureFlagOrganizations).values({ flagKey: key, organizationId: input.organizationId }).onConflictDoNothing();
    else await tx.delete(featureFlagOrganizations).where(and(eq(featureFlagOrganizations.flagKey, key), eq(featureFlagOrganizations.organizationId, input.organizationId)));
  });
  await recordAudit(db, {
    organizationId: input.organizationId,
    action: input.open ? "hub.feature_flag.opened" : "hub.feature_flag.closed",
    objectId: input.organizationId,
    details: { feature: key },
    actor: { kind: "admin", id: input.adminUserId },
  });
}

// L'Exploitation ouvre (ou referme) une fonction à toutes les organisations.
export async function setFeatureFlagOpenToAll(db: AppDatabase, input: { adminUserId: string; key: string; open: boolean }): Promise<void> {
  if (!isFeatureFlagKey(input.key)) throw new UnknownFeatureFlagError();
  const key = input.key;
  await withActorContext(db, async (tx) => {
    await ensureFlag(tx, key);
    await tx.update(featureFlags).set({ openToAll: input.open }).where(eq(featureFlags.key, key));
  });
  await recordAudit(db, { organizationId: null, action: input.open ? "hub.feature_flag.opened" : "hub.feature_flag.closed", details: { feature: key, scope: "all" }, actor: { kind: "admin", id: input.adminUserId } });
}
