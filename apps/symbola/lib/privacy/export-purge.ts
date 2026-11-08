// RGPD-02 — purge horaire des exports RGPD expirés : PDF et archive effacés
// du stockage privé, la trace de l'export reste (sans donnée personnelle).
import { appDatabase } from "@symbola/db/client";
import { listOrganizations, purgeExpiredPrivacyExports } from "@/modules/hub/service";

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // toutes les heures

export async function purgeAllExpiredPrivacyExports(now: Date = new Date()): Promise<number> {
  const db = appDatabase();
  const organizations = await listOrganizations(db);
  return await purgeExpiredPrivacyExports(
    db,
    organizations.map((organization) => organization.id),
    now,
  );
}

// Lancé une fois au démarrage du serveur (instrumentation.ts), comme la purge
// des imports.
export function schedulePrivacyExportPurge(): void {
  const run = () => {
    purgeAllExpiredPrivacyExports().catch((error: unknown) => {
      console.error("purge des exports RGPD expirés échouée", error instanceof Error ? error.message : error);
    });
  };
  run();
  setInterval(run, PURGE_INTERVAL_MS).unref();
}
