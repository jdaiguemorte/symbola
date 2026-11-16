// Lot 37b (DOC-12 ; D12, D13 ; ADR 0071) — relevé mensuel du stockage de chaque organisation, par
// nature : chaque module rend ses fichiers (nombre et volume, par évènement), les évènements d'essai
// sont écartés, et le hub garde la somme pour le mois. Pris le premier du mois (heure de Paris), ou
// au premier passage du mois si le serveur était arrêté ; jamais deux fois le même mois. Il
// alimentera le calcul des quotas (DOC-06). Des nombres seulement : aucun nom de fichier ni dans le
// relevé ni dans les journaux.
import { parisToday } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import type { StorageUsageRow } from "@symbola/contracts";
import { measureBudgetStorage } from "@/modules/budget/service";
import { listDemoEventIds, measureEventsStorage } from "@/modules/events/service";
import { emptyStorageTotals, hasStorageSnapshot, listOrganizations, measureHubStorage, recordStorageSnapshot, type StorageTotals } from "@/modules/hub/service";
import { measureQuotesStorage } from "@/modules/quotes/service";
import { measureVendorsStorage } from "@/modules/vendors/service";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Premier jour du mois civil de Paris (« AAAA-MM-01 »).
export function snapshotMonth(now: Date): string {
  return `${parisToday(now).slice(0, 7)}-01`;
}

export function sumStorage(rows: StorageUsageRow[], excludedEventIds: ReadonlySet<string>): StorageTotals {
  const totals = emptyStorageTotals();
  for (const row of rows) {
    if (row.eventId !== null && excludedEventIds.has(row.eventId)) continue;
    totals[row.nature].files += row.files;
    totals[row.nature].bytes += row.bytes;
  }
  return totals;
}

export async function measureOrganizationStorage(organizationId: string): Promise<StorageTotals> {
  const [demoEventIds, ...parts] = await Promise.all([
    listDemoEventIds(organizationId),
    measureEventsStorage(organizationId),
    measureBudgetStorage(organizationId),
    measureVendorsStorage(organizationId),
    measureQuotesStorage(organizationId),
    measureHubStorage(organizationId),
  ]);
  return sumStorage(parts.flat(), new Set(demoEventIds));
}

export type StorageSnapshotRun = { month: string; taken: string[]; failed: string[] };

export async function takeStorageSnapshots(options: { now?: Date; organizationIds?: string[] } = {}): Promise<StorageSnapshotRun> {
  const now = options.now ?? new Date();
  const month = snapshotMonth(now);
  const organizationIds = options.organizationIds ?? (await listOrganizations(appDatabase())).map((organization) => organization.id);
  const run: StorageSnapshotRun = { month, taken: [], failed: [] };
  for (const organizationId of organizationIds) {
    try {
      if (await hasStorageSnapshot(organizationId, month)) continue;
      const totals = await measureOrganizationStorage(organizationId);
      if (await recordStorageSnapshot(organizationId, month, totals, now)) run.taken.push(organizationId);
    } catch (error) {
      // Une organisation en échec n'empêche pas les autres ; elle est reprise au passage suivant.
      run.failed.push(organizationId);
      console.error("relevé de stockage échoué (organisation %s) : %s", organizationId, error instanceof Error ? error.message : String(error));
    }
  }
  return run;
}

// Lancé au démarrage du serveur (instrumentation.ts), puis chaque heure : le relevé du mois est pris
// dès le premier passage du mois.
export function scheduleStorageSnapshots(): void {
  const run = () => {
    takeStorageSnapshots().catch((error: unknown) => {
      console.error("relevé de stockage échoué", error instanceof Error ? error.message : error);
    });
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS).unref();
}
