// AIDE-02, ADR 0008 — « étant donné un essai abandonné, ses données sont
// supprimées après 24 h ». Parcourt les organisations (le hub les liste)
// et demande à chaque module de purger ses essais expirés ; la RLS impose
// de le faire organisation par organisation.
import { createAppConnection } from "@symbola/db/client";
import { purgeExpiredDemoEventsForOrganizations } from "@/modules/events/service";
import { listOrganizations } from "@/modules/hub/service";

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // toutes les heures

export async function purgeAllExpiredDemoData(now: Date = new Date()): Promise<number> {
  const { sql, db } = createAppConnection();
  let organizations;
  try {
    organizations = await listOrganizations(db);
  } finally {
    await sql.end();
  }
  return purgeExpiredDemoEventsForOrganizations(
    organizations.map((organization) => organization.id),
    now,
  );
}

// Lancé une fois au démarrage du serveur (instrumentation.ts) : un seul
// processus applicatif par environnement (ADR 0011), donc pas de verrou.
export function scheduleDemoPurge(): void {
  const run = () => {
    purgeAllExpiredDemoData().catch((error: unknown) => {
      console.error("purge des essais expirés échouée", error instanceof Error ? error.message : error);
    });
  };
  run();
  setInterval(run, PURGE_INTERVAL_MS).unref();
}
