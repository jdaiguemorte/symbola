// Lot 37b (DOC-12 ; D12, D13 ; ADR 0071) — relevé mensuel du stockage, côté hub : la part du hub (le
// logo), l'écriture du relevé (un par organisation, par mois et par nature, en ajout seul) et sa
// lecture (la titulaire dans Paramètres, l'Admin en totaux). Des nombres seulement, jamais un nom
// de fichier (SEC-09). Exposé seulement par service.ts (ADR 0011).
import { and, desc, eq, inArray } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { organizationProfiles, storageSnapshots } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, statPrivateObject } from "@symbola/files";
import { STORAGE_NATURES, type StorageNature, type StorageUsageRow } from "@symbola/contracts";
import { signaturePhotoUsage } from "./email-branding";

export type StorageTotals = Record<StorageNature, { files: number; bytes: number }>;
export type StorageSnapshotMonth = { month: string; takenAt: string; natures: StorageTotals; files: number; bytes: number };
export type OrganizationStorageTotal = { month: string; takenAt: string; files: number; bytes: number };

export function emptyStorageTotals(): StorageTotals {
  return Object.fromEntries(STORAGE_NATURES.map((nature) => [nature, { files: 0, bytes: 0 }])) as StorageTotals;
}

// Le logo de l'organisation (images). D13 : un logo déposé avant le lot 37b a sa taille lue une fois
// au stockage, puis gardée. Lot 66c (ADR 0113) : les photos des signatures comptent aussi en images.
export async function measureHubStorage(organizationId: string): Promise<StorageUsageRow[]> {
  const [logo, photos] = await Promise.all([measureLogo(organizationId), signaturePhotoUsage(organizationId)]);
  const files = (logo ? 1 : 0) + photos.files;
  if (files === 0) return [];
  return [{ nature: "images", eventId: null, files, bytes: (logo ?? 0) + photos.bytes }];
}

async function measureLogo(organizationId: string): Promise<number | null> {
  const db = appDatabase();
  const [profile] = await db.select({ logoKey: organizationProfiles.logoKey, logoSizeBytes: organizationProfiles.logoSizeBytes }).from(organizationProfiles).where(eq(organizationProfiles.organizationId, organizationId));
  if (!profile?.logoKey) return null;
  let size = profile.logoSizeBytes;
  if (size === null) {
    size = await statPrivateObject(createStorageClient(), profile.logoKey);
    if (size === null) {
      console.warn(`relevé de stockage : logo absent du stockage (organisation ${organizationId})`);
      return null;
    }
    await db.update(organizationProfiles).set({ logoSizeBytes: size }).where(eq(organizationProfiles.organizationId, organizationId));
  }
  return size;
}

export async function hasStorageSnapshot(organizationId: string, month: string): Promise<boolean> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ id: storageSnapshots.id }).from(storageSnapshots).where(eq(storageSnapshots.month, month)).limit(1));
  return rows.length > 0;
}

// Quatre lignes, une par nature (zéro compris) ; un relevé déjà pris pour ce mois n'est pas refait.
export async function recordStorageSnapshot(organizationId: string, month: string, totals: StorageTotals, takenAt: Date): Promise<boolean> {
  const inserted = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .insert(storageSnapshots)
      .values(STORAGE_NATURES.map((nature) => ({ organizationId, month, nature, fileCount: totals[nature].files, totalBytes: totals[nature].bytes, takenAt })))
      .onConflictDoNothing()
      .returning({ id: storageSnapshots.id }),
  );
  return inserted.length > 0;
}

function byMonth(rows: (typeof storageSnapshots.$inferSelect)[]): StorageSnapshotMonth[] {
  const months = new Map<string, StorageSnapshotMonth>();
  for (const row of rows) {
    const entry = months.get(row.month) ?? { month: row.month, takenAt: row.takenAt.toISOString(), natures: emptyStorageTotals(), files: 0, bytes: 0 };
    entry.natures[row.nature] = { files: row.fileCount, bytes: row.totalBytes };
    entry.files += row.fileCount;
    entry.bytes += row.totalBytes;
    if (row.takenAt.toISOString() < entry.takenAt) entry.takenAt = row.takenAt.toISOString();
    months.set(row.month, entry);
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}

// Les derniers relevés de l'organisation, le plus récent d'abord.
export async function listStorageSnapshots(organizationId: string, limit = 12): Promise<StorageSnapshotMonth[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(storageSnapshots).orderBy(desc(storageSnapshots.month)).limit(limit * STORAGE_NATURES.length));
  return byMonth(rows).slice(0, limit);
}

// Console de l'Admin : le dernier relevé de chaque organisation, en totaux (nombres seulement).
export async function getLatestStorageTotals(organizationIds: string[]): Promise<Record<string, OrganizationStorageTotal | null>> {
  const result: Record<string, OrganizationStorageTotal | null> = {};
  for (const organizationId of organizationIds) {
    const latest = await withOrganization(appDatabase(), organizationId, async (tx) => {
      const [last] = await tx.select({ month: storageSnapshots.month }).from(storageSnapshots).orderBy(desc(storageSnapshots.month)).limit(1);
      if (!last) return null;
      return byMonth(await tx.select().from(storageSnapshots).where(and(eq(storageSnapshots.month, last.month), inArray(storageSnapshots.nature, [...STORAGE_NATURES]))))[0] ?? null;
    });
    result[organizationId] = latest ? { month: latest.month, takenAt: latest.takenAt, files: latest.files, bytes: latest.bytes } : null;
  }
  return result;
}
