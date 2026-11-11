// Lot 23 (SEC-19, décision D5, ADR 0060) — purge quotidienne des adresses IP
// des connexions, passé la durée réglée par l'Admin
// (platform_settings.connection_trace_retention_months, 12 mois par défaut,
// à confirmer par le DPO). Les lignes du journal d'audit restent.
import { purgeConnectionTraces } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { getPlatformSettings } from "@/modules/hub/service";

const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function connectionTraceCutoff(now: Date, retentionMonths: number): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - retentionMonths);
  return cutoff;
}

export async function purgeExpiredConnectionTraces(now: Date = new Date()): Promise<number> {
  const db = appDatabase();
  const { connectionTraceRetentionMonths } = await getPlatformSettings(db);
  return purgeConnectionTraces(db, connectionTraceCutoff(now, connectionTraceRetentionMonths));
}

// Lancé une fois au démarrage du serveur (instrumentation.ts).
export function scheduleConnectionTracePurge(): void {
  const run = () => {
    purgeExpiredConnectionTraces().catch((error: unknown) => {
      console.error("purge des adresses de connexion échouée", error instanceof Error ? error.message : error);
    });
  };
  run();
  setInterval(run, PURGE_INTERVAL_MS).unref();
}
