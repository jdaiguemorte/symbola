// Lot 54 (DOC-06 ; ADR 0101) — quota de stockage de l'offre, visible dans « Mon abonnement ». Chaque
// passage (lib/subscriptions.ts) mesure le stockage d'une organisation abonnée, par module, données
// d'essai (is_demo) exclues : à 80 % puis à 95 %, un bandeau et un e-mail préviennent la Propriétaire ;
// à 100 %, un préavis de sept jours commence, puis seulement les nouveaux dépôts sont refusés. La
// lecture et l'export restent toujours possibles. Une organisation sans abonnement n'a pas de quota.
// Des nombres seulement, jamais un nom de fichier.
import { eq } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import { organizationSubscriptions, storageQuotaStates } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { registerUploadGuard } from "@symbola/files";
import { getPlanCatalog } from "./plan-catalog";
import { initialQuotaState, nextQuotaState, quotaPercent, storageQuotaBytes, uploadsBlocked, type QuotaState } from "./subscription-rules";
import { notifyOwners } from "./subscription-mails";

export type StorageQuotaView = {
  measuredAt: Date;
  usedBytes: number;
  usedByModule: Record<string, number>;
  quotaBytes: number | null;
  percent: number | null;
  alertedPercents: number[];
  fullSince: Date | null;
  uploadsBlockedFrom: Date | null;
  blocked: boolean;
};

type StateRow = typeof storageQuotaStates.$inferSelect;

function toView(row: StateRow, now: Date): StorageQuotaView {
  return {
    measuredAt: row.measuredAt,
    usedBytes: row.usedBytes,
    usedByModule: row.usedByModule,
    quotaBytes: row.quotaBytes,
    percent: quotaPercent(row.usedBytes, row.quotaBytes),
    alertedPercents: row.alertedPercents,
    fullSince: row.fullSince,
    uploadsBlockedFrom: row.uploadsBlockedFrom,
    blocked: uploadsBlocked(row, now),
  };
}

async function readState(db: AppDatabase, organizationId: string): Promise<{ state: StateRow | null; subscription: typeof organizationSubscriptions.$inferSelect | null }> {
  return withOrganization(db, organizationId, async (tx) => {
    const [state] = await tx.select().from(storageQuotaStates).where(eq(storageQuotaStates.organizationId, organizationId));
    const [subscription] = await tx.select().from(organizationSubscriptions).where(eq(organizationSubscriptions.organizationId, organizationId));
    return { state: state ?? null, subscription: subscription ?? null };
  });
}

export async function getStorageQuota(db: AppDatabase, organizationId: string, now: Date = new Date()): Promise<StorageQuotaView | null> {
  const { state, subscription } = await readState(db, organizationId);
  if (!state || !subscription) return null;
  return toView(state, now);
}

// La garde des dépôts : refusés seulement après le préavis (DOC-06), jamais pour une organisation
// sans abonnement.
export async function isUploadBlocked(db: AppDatabase, organizationId: string, now: Date = new Date()): Promise<boolean> {
  const { state, subscription } = await readState(db, organizationId);
  return Boolean(state && subscription && uploadsBlocked(state, now));
}

registerUploadGuard((organizationId) => isUploadBlocked(appDatabase(), organizationId));

// Une mesure (ou une offre changée, avec la dernière mesure) : nouvel état, alertes à la Propriétaire.
async function applyMeasure(db: AppDatabase, input: { organizationId: string; usedBytes: number; usedByModule: Record<string, number>; measuredAt: Date; now: Date }): Promise<StorageQuotaView | null> {
  const { state, subscription } = await readState(db, input.organizationId);
  if (!subscription) return null;
  const catalog = await getPlanCatalog(db);
  const quotaBytes = storageQuotaBytes(catalog, subscription);
  const previous: QuotaState = state ? { alertedPercents: state.alertedPercents, fullSince: state.fullSince, uploadsBlockedFrom: state.uploadsBlockedFrom } : initialQuotaState();
  const { state: next, alerts } = nextQuotaState(previous, { usedBytes: input.usedBytes, quotaBytes, now: input.now, rules: catalog.rules });
  const values = { measuredAt: input.measuredAt, usedBytes: input.usedBytes, usedByModule: input.usedByModule, quotaBytes, alertedPercents: next.alertedPercents, fullSince: next.fullSince, uploadsBlockedFrom: next.uploadsBlockedFrom };
  const [row] = await withOrganization(db, input.organizationId, (tx) =>
    tx
      .insert(storageQuotaStates)
      .values({ organizationId: input.organizationId, ...values })
      .onConflictDoUpdate({ target: storageQuotaStates.organizationId, set: values })
      .returning(),
  );
  for (const percent of alerts) {
    await recordAudit(db, { organizationId: input.organizationId, action: "hub.storage_quota.alerted", objectId: input.organizationId, details: { percent }, actor: { kind: "system", id: null } });
    const key = `storage-quota:${input.organizationId}:${percent}:${(next.fullSince ?? input.now).toISOString()}`;
    if (percent >= 100) await notifyOwners(db, { organizationId: input.organizationId, mail: "storageQuotaFull", date: next.uploadsBlockedFrom, percent, key });
    else await notifyOwners(db, { organizationId: input.organizationId, mail: "storageQuotaAlert", date: null, percent, key });
  }
  return toView(row!, input.now);
}

export async function recordStorageMeasure(db: AppDatabase, input: { organizationId: string; usedBytes: number; usedByModule: Record<string, number>; now?: Date }): Promise<StorageQuotaView | null> {
  const now = input.now ?? new Date();
  return applyMeasure(db, { ...input, measuredAt: now, now });
}

// Après un changement d'offre ou de tranches : le nouveau quota s'applique à la dernière mesure.
export async function refreshStorageQuota(db: AppDatabase, organizationId: string, now: Date = new Date()): Promise<void> {
  const { state } = await readState(db, organizationId);
  if (!state) return;
  await applyMeasure(db, { organizationId, usedBytes: state.usedBytes, usedByModule: state.usedByModule, measuredAt: state.measuredAt, now });
}

// Une mesure plus vieille que ce délai est refaite au passage suivant.
export async function storageMeasureIsStale(db: AppDatabase, organizationId: string, now: Date, maxAgeMs: number): Promise<boolean> {
  const { state } = await readState(db, organizationId);
  return !state || now.getTime() - state.measuredAt.getTime() >= maxAgeMs;
}
