// Lot 52 (HUB-05, SEC-08 ; ADR 0094) — tâches de fond de la sécurité des comptes, chaque heure :
// - reprise des alertes de changement d'identité reçues mais pas envoyées (l'ancienne adresse n'est
//   gardée que jusqu'à l'envoi) ;
// - purge (DPO) : appareils connus inactifs depuis 30 jours, alertes de plus de 30 jours.
import { listUnsentIdentityAlerts, purgeIdentityAlerts, purgeKnownDevices } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { sendIdentityAlert } from "./account-alerts";
import { accountCenterUrl } from "./identity";

const INTERVAL_MS = 60 * 60 * 1000;

export async function runAccountSecurityJobs(now: Date = new Date()): Promise<{ resent: number; devices: number; alerts: number }> {
  const db = appDatabase();
  let resent = 0;
  for (const alert of await listUnsentIdentityAlerts(db)) if (await sendIdentityAlert(alert, accountCenterUrl(), now)) resent += 1;
  return { resent, devices: await purgeKnownDevices(db, now), alerts: await purgeIdentityAlerts(db, now) };
}

// Lancé une fois au démarrage du serveur (instrumentation.ts).
export function scheduleAccountSecurityJobs(): void {
  const run = () => {
    runAccountSecurityJobs().catch((error: unknown) => {
      console.error("tâches de sécurité des comptes échouées", error instanceof Error ? error.name : "erreur");
    });
  };
  run();
  setInterval(run, INTERVAL_MS).unref();
}
