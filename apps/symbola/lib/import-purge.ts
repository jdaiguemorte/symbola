// Lot 5 — purge horaire : lignes en attente des imports en cours expirés
// (IMP-01) et valeurs gardées pour l'annulation des imports confirmés passé
// le délai d'annulation (IMP-05). Données personnelles effacées, le journal
// reste.
import { appDatabase } from "@symbola/db/client";
import { listOrganizations, purgeExpiredImportDrafts, purgeExpiredImportUndoValues } from "@/modules/hub/service";

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // toutes les heures

export async function purgeAllExpiredImportDrafts(now: Date = new Date()): Promise<number> {
  const db = appDatabase();
  const organizations = await listOrganizations(db);
  const organizationIds = organizations.map((organization) => organization.id);
  const drafts = await purgeExpiredImportDrafts(db, organizationIds, now);
  await purgeExpiredImportUndoValues(db, organizationIds, now);
  return drafts;
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
