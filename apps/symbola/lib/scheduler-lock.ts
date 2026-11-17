// Lot 40b (ARC-10, décision D9, ADR 0076) — une tâche périodique ne tourne jamais deux fois en même
// temps : seul le processus qui tient le verrou consultatif de PostgreSQL « symbola:taches-periodiques »,
// sur une connexion à lui, les lance. Au déploiement, l'ancien conteneur et le nouveau peuvent tourner
// un instant ensemble : le nouveau réessaie jusqu'à ce que l'ancien s'arrête (sa connexion fermée
// libère le verrou), puis lance les tâches. Une base injoignable au démarrage est réessayée de même.
import { createAppConnection } from "@symbola/db/client";

export const SCHEDULER_LOCK_NAME = "symbola:taches-periodiques";
const RETRY_MS = 30_000;

export type SchedulerLock = { held(): boolean; release(): Promise<void> };

export function whenSchedulerLockHeld(start: () => void, options: { retryMs?: number; lockName?: string } = {}): SchedulerLock {
  const retryMs = options.retryMs ?? RETRY_MS;
  const lockName = options.lockName ?? SCHEDULER_LOCK_NAME;
  // Une connexion dédiée, gardée tant que le processus vit : le verrou vit avec elle.
  const { sql } = createAppConnection();
  let held = false;
  let released = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const attempt = async () => {
    if (released) return;
    try {
      const [row] = await sql<{ locked: boolean }[]>`select pg_try_advisory_lock(hashtext(${lockName})) as locked`;
      if (row?.locked) {
        held = true;
        start();
        return;
      }
    } catch (error) {
      console.error("tâches périodiques : verrou indisponible", error instanceof Error ? error.name : "inconnue");
    }
    if (!released) {
      timer = setTimeout(() => void attempt(), retryMs);
      timer.unref?.();
    }
  };
  // Une seule connexion dans la réserve : le verrou est pris et gardé sur la même.
  void attempt();

  return {
    held: () => held,
    async release() {
      released = true;
      if (timer) clearTimeout(timer);
      await sql.end();
    },
  };
}
