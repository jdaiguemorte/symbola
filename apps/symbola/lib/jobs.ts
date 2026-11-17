// Lot 40b (ARC-10, décision D9, ADR 0076) — worker de la file des tâches de fond : toutes les
// 30 secondes, pour chaque organisation, les e-mails à reprendre, les envois interrompus et la purge
// des lignes terminées depuis 30 jours (modules/hub/jobs.ts). Lancé par instrumentation.ts, derrière
// le verrou des tâches périodiques (lib/scheduler-lock.ts).
import { appDatabase } from "@symbola/db/client";
import { listOrganizations, runDueJobs } from "@/modules/hub/service";

const POLL_INTERVAL_MS = 30_000;

export async function runJobsOnce(now: Date = new Date()): Promise<void> {
  for (const organization of await listOrganizations(appDatabase())) {
    await runDueJobs(organization.id, now).catch((error: unknown) => {
      console.error("file des tâches : passage échoué", organization.id, error instanceof Error ? error.name : "inconnue");
    });
  }
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
