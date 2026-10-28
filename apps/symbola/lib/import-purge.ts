// Lot 5 (IMP-01) — purge horaire des imports en cours expirés : leurs lignes
// en attente (données personnelles) sont effacées, l'entrée reste au journal.
import { createAppConnection } from "@symbola/db/client";
import { listOrganizations, purgeExpiredImportDrafts } from "@/modules/hub/service";

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // toutes les heures

export async function purgeAllExpiredImportDrafts(now: Date = new Date()): Promise<number> {
  const { sql, db } = createAppConnection();
  try {
    const organizations = await listOrganizations(db);
    return await purgeExpiredImportDrafts(
      db,
      organizations.map((organization) => organization.id),
      now,
    );
  } finally {
    await sql.end();
  }
}

// Lancé une fois au démarrage du serveur (instrumentation.ts), comme la purge
// des essais guidés.
export function scheduleImportPurge(): void {
  const run = () => {
    purgeAllExpiredImportDrafts().catch((error: unknown) => {
      console.error("purge des imports expirés échouée", error instanceof Error ? error.message : error);
    });
  };
  run();
  setInterval(run, PURGE_INTERVAL_MS).unref();
}
