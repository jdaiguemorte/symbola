// Lot 40b (ARC-10, décision D9, ADR 0076) — worker de la file des tâches de fond : toutes les
// 30 secondes, les e-mails à reprendre, les envois interrompus et la purge des lignes terminées
// depuis 30 jours (modules/hub/jobs.ts). Lancé par instrumentation.ts, derrière le verrou des tâches
// périodiques (lib/scheduler-lock.ts).
// NFR-02 (lot 65, ADR 0114) : le passage des 30 secondes ne visite que les organisations dont une
// tâche est due, connues du processus ; toutes les cinq minutes (et au démarrage), un tour complet
// visite chaque organisation ; la purge n'a lieu qu'une fois par heure.
import { appDatabase } from "@symbola/db/client";
import { listOrganizationsIncludingClosed, runDueJobs, takeOrganizationsWithDueJobs } from "@/modules/hub/service";

const POLL_INTERVAL_MS = 30_000;
export const JOBS_FULL_SCAN_INTERVAL_MS = 5 * 60_000;
export const JOBS_PURGE_INTERVAL_MS = 60 * 60_000;

let lastFullScanAt: number | null = null;
let lastPurgeAt: number | null = null;

// Pour les tests : le prochain passage repart comme au démarrage (tour complet et purge).
export function resetJobsScan(): void {
  lastFullScanAt = null;
  lastPurgeAt = null;
}

export async function runJobsOnce(now: Date = new Date()): Promise<{ visited: number; full: boolean }> {
  const at = now.getTime();
  const full = lastFullScanAt === null || at - lastFullScanAt >= JOBS_FULL_SCAN_INTERVAL_MS;
  // La purge accompagne un tour complet, au plus une fois par heure.
  const purge = full && (lastPurgeAt === null || at - lastPurgeAt >= JOBS_PURGE_INTERVAL_MS);
  // Les organisations signalées sont prises dans tous les cas : un tour complet les contient.
  const signalled = takeOrganizationsWithDueJobs(now);
  // Lot 35c : un espace fermé garde ses e-mails de fermeture (les autres attendent, runJob).
  const organizationIds = full ? (await listOrganizationsIncludingClosed(appDatabase())).map((organization) => organization.id) : signalled;
  if (full) lastFullScanAt = at;
  if (purge) lastPurgeAt = at;
  const visited = new Set([...organizationIds, ...signalled]);
  for (const organizationId of visited) {
    await runDueJobs(organizationId, now, { purge }).catch((error: unknown) => {
      console.error("file des tâches : passage échoué", organizationId, error instanceof Error ? error.name : "inconnue");
    });
  }
  return { visited: visited.size, full };
}

export function scheduleJobs(): void {
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    runJobsOnce()
      .catch((error: unknown) => {
        console.error("file des tâches : passage échoué", error instanceof Error ? error.name : "inconnue");
      })
      .finally(() => {
        running = false;
      });
  };
  run();
  setInterval(run, POLL_INTERVAL_MS).unref();
}
